import { useCallback, useEffect, useState } from 'react'
import { listFiles, writeFile, deleteFile } from './vfs'

interface Props {
  active: string | null
  refreshKey: number
  onOpen: (path: string) => void
  onChanged: () => void
}

export default function FileManager({ active, refreshKey, onOpen, onChanged }: Props) {
  const [files, setFiles] = useState<string[]>([])

  const refresh = useCallback(async () => {
    setFiles(await listFiles())
  }, [])

  useEffect(() => { refresh() }, [refresh, refreshKey])

  const newFile = async () => {
    const name = prompt('New file path (e.g. /src/app.cpp):', '/untitled.cpp')
    if (!name) return
    await writeFile(name, name.endsWith('.cpp')
      ? '#include <iostream>\n\nint main() {\n    return 0;\n}\n'
      : '')
    onChanged(); onOpen(name)
  }

  const del = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation()
    if (confirm(`Delete ${path}?`)) { await deleteFile(path); onChanged() }
  }

  return (
    <div>
      <h3>Explorer</h3>
      <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={newFile}>＋ New File</button>
      {files.map((f) => (
        <div key={f} className={'file-row' + (f === active ? ' active' : '')} onClick={() => onOpen(f)}>
          📄 {f.replace(/^\//, '')}
          <span className="del" onClick={(e) => del(e, f)}>✕</span>
        </div>
      ))}
    </div>
  )
}
