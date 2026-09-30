import express from 'express'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const app = express()
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const port = Number(process.env.PORT) || 3001

app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'cpppad-compiler' })
})

app.post('/api/compile', (req, res) => {
  const body = req.body ?? {}
  const sourceCode = typeof body.code === 'string' ? body.code : ''
  const stdin = typeof body.stdin === 'string' ? body.stdin : ''

  if (!sourceCode.trim()) {
    return res.status(400).json({ error: 'C++ source code is required.' })
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpppad-'))
  const sourcePath = path.join(tempDir, 'main.cpp')
  const binaryPath = path.join(tempDir, 'main')

  fs.writeFileSync(sourcePath, sourceCode)

  const compile = spawn('g++', ['-std=c++17', '-O2', sourcePath, '-o', binaryPath], {
    cwd: tempDir,
    env: process.env
  })

  let compilerOutput = ''
  let compilerError = ''

  compile.stdout.on('data', (chunk) => {
    compilerOutput += chunk.toString()
  })

  compile.stderr.on('data', (chunk) => {
    compilerError += chunk.toString()
  })

  compile.on('error', (error) => {
    compilerError += error.message
  })

  compile.on('close', (compileCode) => {
    const cleanup = () => {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true })
      } catch {
        // ignore cleanup failures
      }
    }

    if (compileCode !== 0) {
      cleanup()
      return res.status(200).json({
        status: Number(compileCode ?? 1),
        compilerOutput,
        compilerError,
        output: '',
        programError: ''
      })
    }

    const program = spawn(binaryPath, {
      cwd: tempDir,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let programOutput = ''
    let programError = ''

    program.stdout.on('data', (chunk) => {
      programOutput += chunk.toString()
    })

    program.stderr.on('data', (chunk) => {
      programError += chunk.toString()
    })

    program.on('error', (error) => {
      programError += error.message
    })

    const timer = setTimeout(() => {
      program.kill('SIGKILL')
    }, 15000)

    program.on('close', (exitCode) => {
      clearTimeout(timer)
      cleanup()
      return res.status(200).json({
        status: Number(exitCode ?? 1),
        compilerOutput,
        compilerError,
        output: programOutput,
        programError
      })
    })

    if (stdin) {
      program.stdin.write(stdin)
    }
    program.stdin.end()
  })
})

if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

app.listen(port, () => {
  console.log(`CppPad backend listening on http://localhost:${port}`)
})
