import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { cpp } from '@codemirror/lang-cpp'
import { oneDark } from '@codemirror/theme-one-dark'
import { bracketMatching, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

interface Props {
  value: string
  onChange: (v: string) => void
}

export default function Editor({ value, onChange }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    const view = new EditorView({
      parent: hostRef.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(),
          history(), bracketMatching(),
          cpp(), oneDark, syntaxHighlighting(defaultHighlightStyle),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString())
          })
        ]
      })
    })
    viewRef.current = view
    view.focus()
    return () => view.destroy()
  }, [])

  // Switch document when a different tab becomes active
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  }, [value])

  return <div ref={hostRef} style={{ height: '100%' }} />
}
