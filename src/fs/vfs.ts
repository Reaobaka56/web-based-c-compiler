// Virtual file system persisted in IndexedDB (survives reloads).
import { get, set, del, keys } from 'idb-keyval'

const PREFIX = 'vfs:'

async function allPaths(): Promise<string[]> {
  const ks = await keys()
  return ks.filter((k): k is string => typeof k === 'string' && k.startsWith(PREFIX))
           .map((k) => k.slice(PREFIX.length))
}

export async function listFiles(): Promise<string[]> {
  return (await allPaths()).sort()
}

export async function readFile(path: string): Promise<string> {
  const v = await get(PREFIX + path)
  if (v === undefined) throw new Error(`No such file: ${path}`)
  return v as string
}

export async function writeFile(path: string, content: string): Promise<void> {
  await set(PREFIX + path, content)
}

export async function deleteFile(path: string): Promise<void> {
  await del(PREFIX + path)
}

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  const content = await readFile(oldPath)
  await writeFile(newPath, content)
  await deleteFile(oldPath)
}

/** Read every file into a plain map — used as compiler input. */
export async function readAll(): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const p of await allPaths()) out[p] = await get(PREFIX + p) as string
  return out
}

const DEFAULT_PROJECT: Record<string, string> = {
  '/main.cpp': [
    '#include <iostream>',
    '',
    'int main() {',
    '    std::cout << "Hello, World!" << std::endl;',
    '    return 0;',
    '}',
    ''
  ].join('\n')
}

export async function ensureDefaultProject(): Promise<void> {
  const existing = await listFiles()
  if (existing.length === 0) {
    for (const [p, c] of Object.entries(DEFAULT_PROJECT)) await writeFile(p, c)
  }
}
