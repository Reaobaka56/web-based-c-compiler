import { useCallback, useEffect, useState } from 'react'
import { listFiles, writeFile, deleteFile } from './vfs'

interface Props {
  active: string | null
  refreshKey: number
  onOpen: (path: string) => void
  onChanged: () => void
  onDeleted: (path: string) => void
}

export default function FileManager({ active, refreshKey, onOpen, onChanged, onDeleted }: Props) {
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

  const del = async (path: string) => {
    if (confirm(`Delete ${path}?`)) {
      await deleteFile(path)
      onDeleted(path)
      onChanged()
    }
  }

  return (
    <nav className="explorer" aria-label="Files">
      <div className="pane-head">
        <span>Files</span>
        <button className="icon-btn" onClick={newFile} title="New file" aria-label="New file">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <ul className="file-list">
        {files.map((f) => (
          <li key={f} className={'file-item' + (f === active ? ' active' : '')}>
            <button className="file-row" onClick={() => onOpen(f)}>{f.replace(/^\//, '')}</button>
            <button className="row-del" onClick={() => del(f)} title={`Delete ${f}`} aria-label={`Delete ${f}`}>
              <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
