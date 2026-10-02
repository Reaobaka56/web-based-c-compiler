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
const maxActiveRuns = Number(process.env.MAX_ACTIVE_RUNS) || 10
const maxRunsPerIp = Number(process.env.MAX_RUNS_PER_IP) || 3
const maxConcurrentCompiles = Number(process.env.MAX_CONCURRENT_COMPILES) || 2
const maxQueuedCompiles = 20
const runMemoryBytes = (Number(process.env.RUN_MEMORY_MB) || 64) * 1024 * 1024
const maxProjectFiles = 20
const maxProjectBytes = 262_144
let activeRuns = 0
let activeCompiles = 0
const compileQueue = []
const runsByIp = new Map()

function acquireCompileSlot(session, start) {
  if (activeCompiles < maxConcurrentCompiles) {
    activeCompiles += 1
    session.hasSlot = true
    start()
  } else {
    compileQueue.push({ session, start })
  }
}

function releaseCompileSlot(session) {
  if (!session.hasSlot) return
  session.hasSlot = false
  activeCompiles = Math.max(0, activeCompiles - 1)
  while (activeCompiles < maxConcurrentCompiles && compileQueue.length) {
    const next = compileQueue.shift()
    if (next.session.finished) continue
    activeCompiles += 1
    next.session.hasSlot = true
    next.start()
  }
}

const SAFE_PATH = /^[A-Za-z0-9_][A-Za-z0-9_.\-/]*$/
const SOURCE_EXT = /\.(cpp|cc|cxx)$/i
const ANY_EXT = /\.(cpp|cc|cxx|h|hpp|hh|inl)$/i

function cleanPath(raw) {
  if (typeof raw !== 'string') return null
  const normalized = path.posix.normalize(raw.replace(/^\/+/, ''))
  if (normalized.length > 100 || normalized.startsWith('..') || normalized.includes('/../')) return null
  if (!SAFE_PATH.test(normalized) || !ANY_EXT.test(normalized)) return null
  return normalized
}

function hasUnsafeInclude(text) {
  if (/#\s*(?:include|include_next|import)\s*(?![\s"<])/.test(text)) return true
  for (const match of text.matchAll(/#\s*(?:include|include_next|import)\s*["<]([^">\n]*)[">]/g)) {
    const target = match[1].trim()
    if (target.startsWith('/') || target.startsWith('~') || target.includes('..')) return true
  }
  return false
}

// Accepts { files: {path: text}, entry } or legacy { code }. Returns { files, entry } or { error }.
function parseProject(message) {
  const rawFiles = message.files && typeof message.files === 'object' && !Array.isArray(message.files)
    ? message.files
    : typeof message.code === 'string' ? { [message.entry || 'main.cpp']: message.code } : null
  if (!rawFiles) return { error: 'No source files were sent.' }

  const files = {}
  let total = 0
  for (const [rawName, content] of Object.entries(rawFiles)) {
    const name = cleanPath(rawName)
    if (!name || typeof content !== 'string') continue
    const size = Buffer.byteLength(content)
    if (size > maxSourceBytes) return { error: `${name} is too large (maximum 64 KB per file).` }
    total += size
    files[name] = content
  }
  const names = Object.keys(files)
  if (names.length === 0) return { error: 'No valid C++ files (.cpp, .h, .hpp) to compile.' }
  if (names.length > maxProjectFiles) return { error: `Too many files (maximum ${maxProjectFiles}).` }
  if (total > maxProjectBytes) return { error: 'Project is too large (maximum 256 KB).' }

  const entry = cleanPath(message.entry) ?? (files['main.cpp'] !== undefined ? 'main.cpp' : names.find((n) => SOURCE_EXT.test(n)))
  if (!entry || files[entry] === undefined || !SOURCE_EXT.test(entry)) return { error: 'Open a .cpp file to run.' }
  if (!files[entry].trim()) return { error: 'The file is empty.' }
  for (const name of names) {
    if (hasUnsafeInclude(files[name])) return { error: `${name}: absolute or parent-directory #include paths are not allowed.` }
  }

  // Compile the entry plus every other .cpp that does not define its own main().
  const sources = [entry, ...names.filter((n) => n !== entry && SOURCE_EXT.test(n) && !/\bmain\s*\(/.test(files[n]))]
  return { files, entry, sources }
}

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
    websocketServer.emit('connection', websocket, request)
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

function startWasiRun(websocket, project, session) {
  session.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpppad-'))
  const wasmPath = path.join(session.tempDir, 'main.wasm')
  for (const [name, content] of Object.entries(project.files)) {
    const target = path.join(session.tempDir, name)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, content)
  }
  const sourcePaths = project.sources.map((name) => path.join(session.tempDir, name))

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

  if (compileQueue.length >= maxQueuedCompiles) {
    fail('The compiler is busy. Try again shortly.')
    return
  }
  if (activeCompiles >= maxConcurrentCompiles) {
    send(websocket, { type: 'status', message: 'Waiting for a free compiler slot…\r\n' })
  }
  acquireCompileSlot(session, () => {
  send(websocket, { type: 'status', message: 'Compiling C++ to WebAssembly…\r\n' })
  const compiler = spawn('/opt/wasi-sdk/bin/clang++', [
      '-std=c++17', '-O2', '-fno-exceptions', '-isystem', shimDir, '-I', session.tempDir, '-Wl,-z,stack-size=1048576', ...sourcePaths, '-o', wasmPath
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
  compiler.on('error', (error) => {
    releaseCompileSlot(session)
    fail(`Compiler error: ${error.message}`)
  })
  compiler.on('close', (exitCode) => {
    releaseCompileSlot(session)
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
      'run', '-W', 'fuel=1000000000', '-W', `max-memory-size=${runMemoryBytes}`, wasmPath
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
  })
}

function clientIp(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwarded || request.socket.remoteAddress || 'unknown'
}

websocketServer.on('connection', (websocket, request) => {
  const ip = clientIp(request)
  const session = { process: null, timer: null, tempDir: null, inputQueue: '', inputBytes: 0, outputBytes: 0, finished: false, running: false }
  let started = false
  let counted = false
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
      if (message.type !== 'start') {
        websocket.close(1008, 'A start message is required')
        return
      }
      const project = parseProject(message)
      if (project.error) {
        send(websocket, { type: 'error', message: project.error })
        websocket.close(1008, 'Invalid project')
        return
      }
      if (activeRuns >= maxActiveRuns) {
        send(websocket, { type: 'error', message: 'The compiler is busy. Try again shortly.' })
        websocket.close(1013, 'Compiler busy')
        return
      }
      if ((runsByIp.get(ip) || 0) >= maxRunsPerIp) {
        send(websocket, { type: 'error', message: `Too many runs from your connection (maximum ${maxRunsPerIp} at once). Stop one first.` })
        websocket.close(1013, 'Too many runs')
        return
      }

      started = true
      counted = true
      clearTimeout(startTimer)
      activeRuns += 1
      runsByIp.set(ip, (runsByIp.get(ip) || 0) + 1)
      startWasiRun(websocket, project, session)
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
    if (counted) {
      counted = false
      const remaining = (runsByIp.get(ip) || 1) - 1
      if (remaining <= 0) runsByIp.delete(ip)
      else runsByIp.set(ip, remaining)
    }
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
