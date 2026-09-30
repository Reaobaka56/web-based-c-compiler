interface ApiRequest {
  method?: string
  body?: unknown
}

interface ApiResponse {
  status(code: number): ApiResponse
  json(body: Record<string, unknown>): void
}

export const config = { maxDuration: 30 }

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Use POST to compile C++ source.' })
  }

  const body = req.body
  const code = body && typeof body === 'object' && 'code' in body
    ? (body as { code?: unknown }).code
    : undefined
  if (typeof code !== 'string' || code.trim().length === 0) {
    return res.status(400).json({ error: 'C++ source code is required.' })
  }
  if (code.length > 65_536) {
    return res.status(413).json({ error: 'Source is too large (maximum 64 KB).' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 25_000)
  try {
    const upstream = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ compiler: 'gcc-head', code, options: '', stdin: '' }),
      signal: controller.signal
    })
    if (!upstream.ok) {
      return res.status(502).json({ error: `Compiler service returned ${upstream.status}.` })
    }

    const result = await upstream.json() as Record<string, unknown>
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
}