import express from 'express'

const app = express()
const port = Number(process.env.PORT) || 3001
const frontendUrl = process.env.FRONTEND_URL

app.use(express.json({ limit: '1mb' }))

app.use('/api', (req, res, next) => {
  const origin = req.get('origin')
  if (origin && origin === frontendUrl) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }

  if (req.method === 'OPTIONS') {
    if (origin !== frontendUrl) return res.sendStatus(403)
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    return res.sendStatus(204)
  }

  next()
})

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'cpppad-compiler' })
})

app.post('/api/compile', async (req, res) => {
  const body = req.body ?? {}
  const code = typeof body.code === 'string' ? body.code : ''
  const stdin = typeof body.stdin === 'string' ? body.stdin : ''

  if (!code.trim()) {
    return res.status(400).json({ error: 'C++ source code is required.' })
  }
  if (code.length > 65_536) {
    return res.status(413).json({ error: 'Source is too large (maximum 64 KB).' })
  }
  if (typeof body.stdin !== 'undefined' && typeof body.stdin !== 'string') {
    return res.status(400).json({ error: 'Program input must be text.' })
  }
  if (stdin.length > 65_536) {
    return res.status(413).json({ error: 'Program input is too large (maximum 64 KB).' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)
  try {
    const upstream = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compiler: 'gcc-head', code, options: '', stdin }),
      signal: controller.signal
    })
    if (!upstream.ok) {
      return res.status(502).json({ error: `Compiler service returned ${upstream.status}.` })
    }

    const result = await upstream.json()
    return res.status(200).json({
      status: Number(result.status ?? 1),
      compilerOutput: typeof result.compiler_message === 'string' ? result.compiler_message : '',
      compilerError: typeof result.compiler_error === 'string' ? result.compiler_error : '',
      output: typeof result.program_output === 'string' ? result.program_output : '',
      programError: typeof result.program_error === 'string' ? result.program_error : ''
    })
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? 'Compilation timed out. Try a smaller or faster program.'
      : 'Could not reach the online compiler. Check your connection and try again.'
    return res.status(502).json({ error: message })
  } finally {
    clearTimeout(timeout)
  }
})

app.listen(port, () => {
  console.log(`CppPad compiler API listening on port ${port}`)
})
