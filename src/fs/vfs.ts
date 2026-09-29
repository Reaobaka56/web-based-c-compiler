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

const HELLO = [
  '#include <iostream>',
  '',
  'int main() {',
  '    std::cout << "Hello, World!" << std::endl;',
  '    return 0;',
  '}',
  ''
].join('\n')

const DEFAULT_PROJECT: Record<string, string> = { '/main.cpp': HELLO }

// Files that earlier builds seeded into every workspace. They are only cleaned up
// if the user never edited them, so nobody loses work.
const LEGACY_MAIN = [
  '#include <iostream>',
  '',
  'int main() {',
  '    std::cout << "Hello from CPP://Web!" << std::endl;',
  '    std::cout << "Toolchain check: edit me and press Run." << std::endl;',
  '    return 0;',
  '}',
  ''
].join('\n')

const LEGACY_GUI_DEMO = [
  'extern "C" {',
  '    void gui_clear(int r, int g, int b);',
  '    void gui_rect(int x, int y, int w, int h, int r, int g, int b);',
  '    void gui_circle(int x, int y, int radius, int r, int g, int b);',
  '}',
  '',
  'int main() {',
  '    gui_clear(24, 30, 42);',
  '    gui_rect(80, 80, 220, 120, 61, 139, 253);',
  '    gui_circle(400, 240, 55, 224, 175, 104);',
  '    return 0;',
  '}',
  ''
].join('\n')

export async function ensureDefaultProject(): Promise<void> {
  const existing = await listFiles()
  if (existing.length === 0) {
    for (const [p, c] of Object.entries(DEFAULT_PROJECT)) await writeFile(p, c)
    return
  }

  if (existing.includes('/main.cpp') && await readFile('/main.cpp') === LEGACY_MAIN) {
    await writeFile('/main.cpp', HELLO)
  }
  if (existing.includes('/gui_demo.cpp') && await readFile('/gui_demo.cpp') === LEGACY_GUI_DEMO) {
    await deleteFile('/gui_demo.cpp')
  }
}
