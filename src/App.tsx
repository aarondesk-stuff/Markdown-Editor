import MarkdownIt from 'markdown-it'
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import './App.css'

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}

const markdown = new MarkdownIt({
  breaks: true,
  html: false,
  linkify: true,
  typographer: true,
})

const markdownFileType = {
  description: 'Markdown files',
  accept: {
    'text/markdown': ['.md', '.markdown', '.mdown', '.mkd'],
    'text/plain': ['.txt'],
  },
}

const markdownDialogFilters = [
  {
    name: 'Markdown and text files',
    extensions: ['md', 'markdown', 'mdown', 'mkd', 'txt'],
  },
]

const isTauriDesktop = () => Boolean(window.__TAURI_INTERNALS__)

const getBaseName = (filePath: string) => filePath.split(/[\\/]/).pop() || filePath

const starterMarkdown = `# Markdown Editor

Type Markdown on the left and see the rendered document on the right.

## Features

- Open Markdown files
- Save using native desktop dialogs in Tauri or browser-native file APIs when available
- Download fallback for browsers without native file-system access
- Print the rendered preview
- Live two-pane editing

Try some **bold text**, _italic text_, \`inline code\`, or a list:

1. Write
2. Preview
3. Save
`

function App() {
  const [content, setContent] = useState(starterMarkdown)
  const [fileName, setFileName] = useState('untitled.md')
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null)
  const [lastSavedContent, setLastSavedContent] = useState(starterMarkdown)
  const [status, setStatus] = useState('Ready')
  const fallbackFileInputRef = useRef<HTMLInputElement>(null)

  const isModified = content !== lastSavedContent

  const renderedMarkdown = useMemo(() => markdown.render(content), [content])

  const loadFile = useCallback(async (file: File, handle?: FileSystemFileHandle) => {
    const text = await file.text()
    setContent(text)
    setFileName(file.name || 'untitled.md')
    setCurrentFilePath(null)
    setFileHandle(handle ?? null)
    setLastSavedContent(text)
    setStatus(`Opened ${file.name || 'file'}`)
  }, [])

  const openFile = useCallback(async () => {
    if (isTauriDesktop()) {
      try {
        const selectedPath = await openDialog({
          multiple: false,
          filters: markdownDialogFilters,
        })

        if (!selectedPath || Array.isArray(selectedPath)) {
          setStatus('Open canceled')
          return
        }

        const text = await readTextFile(selectedPath)
        const name = getBaseName(selectedPath)
        setContent(text)
        setFileName(name)
        setCurrentFilePath(selectedPath)
        setFileHandle(null)
        setLastSavedContent(text)
        setStatus(`Opened ${name}`)
        return
      } catch (error) {
        console.warn('Desktop file open failed.', error)
        setStatus('Desktop open failed')
        return
      }
    }

    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [markdownFileType],
        })
        const file = await handle.getFile()
        await loadFile(file, handle)
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setStatus('Open canceled')
          return
        }
        console.warn('Native file open failed, using fallback input.', error)
      }
    }

    fallbackFileInputRef.current?.click()
  }, [loadFile])

  const handleFallbackOpen = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    await loadFile(file)
  }

  const downloadFile = useCallback((name: string, text: string) => {
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name || 'untitled.md'
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }, [])

  const saveToHandle = useCallback(
    async (handle: FileSystemFileHandle) => {
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      setFileName(handle.name)
      setCurrentFilePath(null)
      setFileHandle(handle)
      setLastSavedContent(content)
      setStatus(`Saved ${handle.name}`)
    },
    [content],
  )

  const saveAsFile = useCallback(async () => {
    if (isTauriDesktop()) {
      try {
        const selectedPath = await saveDialog({
          defaultPath: fileName,
          filters: markdownDialogFilters,
        })

        if (!selectedPath) {
          setStatus('Save canceled')
          return
        }

        await writeTextFile(selectedPath, content)
        const name = getBaseName(selectedPath)
        setFileName(name)
        setCurrentFilePath(selectedPath)
        setFileHandle(null)
        setLastSavedContent(content)
        setStatus(`Saved ${name}`)
        return
      } catch (error) {
        console.warn('Desktop file save failed.', error)
        setStatus('Desktop save failed')
        return
      }
    }

    if (window.showSaveFilePicker) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [markdownFileType],
        })
        await saveToHandle(handle)
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          setStatus('Save canceled')
          return
        }
        console.warn('Native file save failed, using download fallback.', error)
      }
    }

    downloadFile(fileName, content)
    setLastSavedContent(content)
    setStatus(`Downloaded ${fileName}`)
  }, [content, downloadFile, fileName, saveToHandle])

  const saveFile = useCallback(async () => {
    if (currentFilePath && isTauriDesktop()) {
      try {
        await writeTextFile(currentFilePath, content)
        setLastSavedContent(content)
        setStatus(`Saved ${getBaseName(currentFilePath)}`)
        return
      } catch (error) {
        console.warn('Save to existing desktop path failed, using Save As.', error)
      }
    }

    if (fileHandle) {
      try {
        await saveToHandle(fileHandle)
        return
      } catch (error) {
        console.warn('Save to existing handle failed, using Save As.', error)
      }
    }

    await saveAsFile()
  }, [content, currentFilePath, fileHandle, saveAsFile, saveToHandle])

  const printFile = useCallback(() => {
    setStatus('Preparing print preview')
    requestAnimationFrame(() => window.print())
  }, [])

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      if (!modifier) return

      const key = event.key.toLowerCase()
      if (key === 'o') {
        event.preventDefault()
        void openFile()
      }
      if (key === 's') {
        event.preventDefault()
        void saveFile()
      }
      if (key === 'p') {
        event.preventDefault()
        printFile()
      }
    }

    window.addEventListener('keydown', handleKeyboardShortcut)
    return () => window.removeEventListener('keydown', handleKeyboardShortcut)
  }, [openFile, printFile, saveFile])

  return (
    <main className="app-shell">
      <header className="toolbar" aria-label="Markdown editor toolbar">
        <div className="document-meta">
          <h1>Markdown Editor</h1>
          <p title={fileName}>
            {fileName}
            {isModified ? ' • unsaved changes' : ''}
          </p>
        </div>

        <div className="toolbar-actions">
          <button type="button" onClick={openFile} title="Open Markdown file (Ctrl/Cmd+O)">
            Open
          </button>
          <button type="button" onClick={saveFile} title="Save file (Ctrl/Cmd+S)">
            Save
          </button>
          <button type="button" onClick={saveAsFile} title="Save a copy">
            Save As
          </button>
          <button type="button" onClick={printFile} title="Print preview (Ctrl/Cmd+P)">
            Print
          </button>
        </div>

        <input
          ref={fallbackFileInputRef}
          className="visually-hidden"
          type="file"
          accept=".md,.markdown,.mdown,.mkd,.txt,text/markdown,text/plain"
          onChange={handleFallbackOpen}
        />
      </header>

      <section className="editor-grid" aria-label="Markdown editing workspace">
        <section className="pane source-pane" aria-label="Markdown source pane">
          <div className="pane-header">
            <h2>Markdown</h2>
            <span>{content.length.toLocaleString()} characters</span>
          </div>
          <textarea
            aria-label="Markdown source"
            spellCheck="true"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </section>

        <section className="pane preview-pane" aria-label="Rendered preview pane">
          <div className="pane-header preview-controls">
            <h2>Preview</h2>
            <span>{status}</span>
          </div>
          <article
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
          />
        </section>
      </section>
    </main>
  )
}

export default App
