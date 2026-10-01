import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { WebSocket, WebSocketServer } from 'ws'

const app = express()
const port = Number(process.env.PORT) || 3001
const shimDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'shim')
const allowedOrigins = (process.env.FRONTEND_URL || 'https://web-based-c-compiler.vercel.app')
  .split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean)
const isAllowedOrigin = (origin) => !!origin && allowedOrigins.includes(origin)
const maxSourceBytes = 65_536
const maxInputBytes = 65_536
const maxOutputBytes = 1_048_576
const maxActiveRuns = 1
let activeRuns = 0

app.use(express.json({ limit: '1mb' }))

app.use('/api', (req, res, next) => {
  const origin = req.get('origin')
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }

  if (req.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) return res.sendStatus(403)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.sendStatus(204)
  }

  next()
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'cppad-live' })
})

const server = app.listen(port, () => {
  console.log(`CppPad compiler API listening on port ${port}`)
})

const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024, perMessageDeflate: false })

server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost')
  const origin = request.headers.origin
  const localOrigin = process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin ?? '')

  if (requestUrl.pathname !== '/ws/run' || (!isAllowedOrigin(origin) && !localOrigin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
    socket.destroy()
    return
  }

  websocketServer.handleUpgrade(request, socket, head, (websocket) => {
    websocketServer.emit('connection', websocket)
  })
})

function send(websocket, message) {
  if (websocket.readyState === WebSocket.OPEN) websocket.send(JSON.stringify(message))
}

const HINTS = [
  [/'(conio|windows)\.h' file not found/, 'Hint: Windows-only header. Not available here; use <iostream> instead.'],
  [/cannot use '(throw|try)' with exceptions disabled/, 'Hint: C++ exceptions are disabled in this runner. Remove try/catch/throw and use return codes.'],
  [/<thread> is not supported|'(thread|mutex|atomic)' file not found/, 'Hint: threads are not supported in this WASI runner.'],
  [/'(filesystem|sys\/socket\.h|unistd\.h)' file not found/, 'Hint: no host filesystem or network access in this sandbox.']
]

function startWasiRun(websocket, code, session) {
  session.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpppad-'))
  const sourcePath = path.join(session.tempDir, 'main.cpp')
  const wasmPath = path.join(session.tempDir, 'main.wasm')
  fs.writeFileSync(sourcePath, code)

  const cleanup = () => {
    clearTimeout(session.timer)
    if (session.tempDir) fs.rmSync(session.tempDir, { recursive: true, force: true })
    session.tempDir = null
    activeRuns = Math.max(0, activeRuns - 1)
  }

  const finish = (exitCode) => {
    if (session.finished) return
    session.finished = true
    cleanup()
    send(websocket, { type: 'exit', code: Number(exitCode ?? 1) })
    websocket.close(1000)
  }

  const fail = (message) => {
    if (session.finished) return
    session.finished = true
    clearTimeout(session.timer)
    session.process?.kill('SIGKILL')
    if (session.tempDir) fs.rmSync(session.tempDir, { recursive: true, force: true })
    session.tempDir = null
    activeRuns = Math.max(0, activeRuns - 1)
    send(websocket, { type: 'error', message })
    websocket.close(1011, 'Run failed')
  }

  const writeOutput = (chunk) => {
    session.outputBytes += chunk.length
    if (session.outputBytes > maxOutputBytes) {
      fail('Program output exceeded the 1 MB limit.')
      return
    }
    if (websocket.bufferedAmount > 256 * 1024) {
      fail('Output is being produced too quickly. Run stopped.')
      return
    }
    send(websocket, { type: 'output', data: chunk.toString() })
  }

  send(websocket, { type: 'status', message: 'Compiling C++ to WebAssembly…\r\n' })
  const compiler = spawn('/opt/wasi-sdk/bin/clang++', [
      '-std=c++17', '-O2', '-fno-exceptions', '-isystem', shimDir, '-Wl,-z,stack-size=1048576', sourcePath, '-o', wasmPath
  ], {
    cwd: session.tempDir,
    env: { PATH: '/opt/wasi-sdk/bin:/usr/local/bin:/usr/bin:/bin', HOME: '/tmp', LANG: 'C.UTF-8' },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  session.process = compiler
  session.timer = setTimeout(() => fail('Compilation exceeded the 20 second limit.'), 20_000)
  let compilerText = ''
  const onCompilerData = (chunk) => {
    compilerText += chunk.toString()
    writeOutput(chunk)
  }
  compiler.stdout.on('data', onCompilerData)
  compiler.stderr.on('data', onCompilerData)
  compiler.on('error', (error) => fail(`Compiler error: ${error.message}`))
  compiler.on('close', (exitCode) => {
    if (session.finished) return
    clearTimeout(session.timer)
    if (exitCode !== 0) {
      for (const [pattern, hint] of HINTS) {
        if (pattern.test(compilerText)) send(websocket, { type: 'output', data: `\r\n\x1b[33m${hint}\x1b[0m\r\n` })
      }
      return finish(exitCode)
    }

    send(websocket, { type: 'status', message: 'Program started. Type input in the terminal.\r\n' })
    const program = spawn('/usr/local/bin/wasmtime', [
        'run', '-W', 'fuel=1000000000', '-W', 'max-memory-size=268435456', wasmPath
    ], {
      cwd: session.tempDir,
      env: { PATH: '/usr/local/bin:/usr/bin:/bin', LANG: 'C.UTF-8' },
      stdio: ['pipe', 'pipe', 'pipe']
    })
    session.process = program
    session.running = true
    session.timer = setTimeout(() => fail('Program exceeded the 120 second limit.'), 120_000)
    program.stdout.on('data', writeOutput)
    program.stderr.on('data', writeOutput)
    program.stdin.on('error', () => {})
    program.on('error', (error) => fail(`Runtime error: ${error.message}`))
    program.on('close', (exitCode) => {
      session.running = false
      finish(exitCode)
    })
    if (session.inputQueue) {
      program.stdin.write(session.inputQueue)
      session.inputQueue = ''
    }
  })
}

websocketServer.on('connection', (websocket) => {
  const session = { process: null, timer: null, tempDir: null, inputQueue: '', inputBytes: 0, outputBytes: 0, finished: false, running: false }
  let started = false
  const startTimer = setTimeout(() => websocket.close(1008, 'Start message required'), 10_000)

  websocket.on('message', (frame, isBinary) => {
    if (isBinary) {
      websocket.close(1003, 'Text messages only')
      return
    }

    let message
    try {
      message = JSON.parse(frame.toString())
    } catch {
      websocket.close(1007, 'Invalid JSON')
      return
    }

    if (!started) {
      if (message.type !== 'start' || typeof message.code !== 'string' || !message.code.trim()) {
        websocket.close(1008, 'A C++ source file is required')
        return
      }
      if (Buffer.byteLength(message.code) > maxSourceBytes) {
        send(websocket, { type: 'error', message: 'Source is too large (maximum 64 KB).' })
        websocket.close(1009, 'Source too large')
        return
      }
      if (activeRuns >= maxActiveRuns) {
        send(websocket, { type: 'error', message: 'The compiler is busy. Try again shortly.' })
        websocket.close(1013, 'Compiler busy')
        return
      }

      started = true
      clearTimeout(startTimer)
      activeRuns += 1
      startWasiRun(websocket, message.code, session)
      return
    }

    if (message.type !== 'input' || typeof message.data !== 'string') return
    const inputLength = Buffer.byteLength(message.data)
    session.inputBytes += inputLength
    if (session.inputBytes > maxInputBytes) {
      if (!session.finished) {
        session.finished = true
        clearTimeout(session.timer)
        session.process?.kill('SIGKILL')
        if (session.tempDir) fs.rmSync(session.tempDir, { recursive: true, force: true })
        session.tempDir = null
        activeRuns = Math.max(0, activeRuns - 1)
        send(websocket, { type: 'error', message: 'Program input exceeded the 64 KB limit.' })
        websocket.close(1009, 'Input too large')
      }
      return
    }

    const input = message.data.replace(/\r/g, '\n')
    if (session.running && session.process?.stdin) {
      session.process.stdin.write(input)
    } else {
      session.inputQueue += input
    }
  })

  websocket.on('close', () => {
    clearTimeout(startTimer)
    if (session.finished) return
    session.finished = true
    clearTimeout(session.timer)
    session.process?.kill('SIGKILL')
    if (session.tempDir) fs.rmSync(session.tempDir, { recursive: true, force: true })
    session.tempDir = null
    if (started) activeRuns = Math.max(0, activeRuns - 1)
  })
  websocket.on('error', () => {})
})
