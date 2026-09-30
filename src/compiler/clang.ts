export interface CompileResult {
  status: number
  compilerOutput: string
  compilerError: string
  output: string
  programError: string
}

export async function compileProject(sourceCode: string, signal: AbortSignal, stdin = ''): Promise<CompileResult> {
  const response = await fetch('/api/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: sourceCode, stdin }),
    signal
  })

  const result = await response.json().catch(() => ({})) as Partial<CompileResult> & {
    status?: number | string
    error?: string
    compiler_message?: string
    compiler_error?: string
    program_output?: string
    program_message?: string
    program_error?: string
  }

  if (!response.ok) {
    throw new Error(result.error ?? `Compiler request failed (${response.status})`)
  }

  return {
    status: Number(result.status ?? 1),
    compilerOutput: result.compilerOutput ?? result.compiler_message ?? '',
    compilerError: result.compilerError ?? result.compiler_error ?? '',
    output: result.output ?? result.program_output ?? result.program_message ?? '',
    programError: result.programError ?? result.program_error ?? ''
  }
}

export async function toolchainStatus(): Promise<{ ready: boolean }> {
  try {
    const res = await fetch('/api/compile', { method: 'HEAD' })
    return { ready: res.ok }
  } catch {
    return { ready: false }
  }
}