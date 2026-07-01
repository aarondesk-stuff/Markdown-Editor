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

// ── IndexedDB helpers for persisting FileSystemFileHandles in the browser ──
const IDB_NAME = 'markdown-editor'
const IDB_STORE = 'state'

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(key: string, value: unknown): Promise<void> {
  const db = await openIDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openIDB()
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result as T | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbDelete(key: string): Promise<void> {
  const db = await openIDB()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

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
  const [isMacTauri, setIsMacTauri] = useState(false)
  const [isAutoSave, setIsAutoSave] = useState(() => {
    return localStorage.getItem('markdown-autosave') === 'true'
  })
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const stored = localStorage.getItem('markdown-darkmode')
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  // Sync dark mode to html element
  useEffect(() => {
    document.documentElement.dataset.theme = isDarkMode ? 'dark' : ''
    localStorage.setItem('markdown-darkmode', String(isDarkMode))
  }, [isDarkMode])

  const [fontSize, setFontSize] = useState(() => {
    const stored = localStorage.getItem('markdown-fontsize')
    return stored !== null ? Number(stored) : 16
  })

  const MIN_FONT = 12
  const MAX_FONT = 28

  // Sync font size to CSS custom property
  useEffect(() => {
    document.documentElement.style.setProperty('--content-size', `${fontSize}px`)
    localStorage.setItem('markdown-fontsize', String(fontSize))
  }, [fontSize])

  const fallbackFileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLElement>(null)

  const isModified = content !== lastSavedContent

  const renderedMarkdown = useMemo(() => markdown.render(content), [content])

  // Detect macOS inside Tauri
  useEffect(() => {
    if (isTauriDesktop() && navigator.userAgent.includes('Mac')) {
      setIsMacTauri(true)
    }
  }, [])

  // ── Persist the last-opened file so we can reopen it on next launch ──
  useEffect(() => {
    if (currentFilePath) {
      localStorage.setItem('markdown-last-path', currentFilePath)
    }
  }, [currentFilePath])

  useEffect(() => {
    if (fileHandle) {
      void idbPut('last-handle', fileHandle)
    }
  }, [fileHandle])

  // ── Auto-reopen last file on startup ──
  useEffect(() => {
    async function reopenLastFile() {
      // Tauri desktop: path is stored in localStorage
      if (isTauriDesktop()) {
        const lastPath = localStorage.getItem('markdown-last-path')
        if (!lastPath) return
        try {
          setStatus('Reopening last file…')
          const text = await readTextFile(lastPath)
          const name = getBaseName(lastPath)
          setContent(text)
          setFileName(name)
          setCurrentFilePath(lastPath)
          setFileHandle(null)
          setLastSavedContent(text)
          setStatus(`Reopened ${name}`)
        } catch {
          // File may have moved or been deleted
          localStorage.removeItem('markdown-last-path')
          setStatus('Could not reopen last file')
        }
        return
      }

      // Browser: handle is stored in IndexedDB
      if (!window.showOpenFilePicker) return // fallback input — no handle to restore
      try {
        const handle = await idbGet<FileSystemFileHandle>('last-handle')
        if (!handle) return

        // queryPermission does NOT require a user gesture
        const permission = await handle.queryPermission({ mode: 'read' })
        if (permission !== 'granted') {
          // Can't silently reopen — clear stored handle so we don't retry every launch
          await idbDelete('last-handle').catch(() => {})
          return
        }

        setStatus('Reopening last file…')
        const file = await handle.getFile()
        const text = await file.text()
        setContent(text)
        setFileName(file.name)
        setCurrentFilePath(null)
        setFileHandle(handle)
        setLastSavedContent(text)
        setStatus(`Reopened ${file.name}`)
      } catch {
        await idbDelete('last-handle').catch(() => {})
      }
    }

    void reopenLastFile()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Auto-Save Effect
  useEffect(() => {
    if (!isAutoSave) return
    if (!currentFilePath && !fileHandle) return
    if (content === lastSavedContent) return

    const timer = setTimeout(() => {
      void saveFile()
    }, 1000)

    return () => clearTimeout(timer)
  }, [content, isAutoSave, currentFilePath, fileHandle, lastSavedContent, saveFile])

  // New File Handler
  const handleNewFile = useCallback(() => {
    if (isModified) {
      const confirmNew = window.confirm('You have unsaved changes. Are you sure you want to create a new file?')
      if (!confirmNew) return
    }
    setContent('')
    setFileName('untitled.md')
    setCurrentFilePath(null)
    setFileHandle(null)
    setLastSavedContent('')
    setStatus('Created new file')
  }, [isModified])

  // Formatting helper
  const insertFormat = useCallback((prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = textarea.value
    const selected = text.substring(start, end)
    const replacement = prefix + selected + suffix

    setContent(text.substring(0, start) + replacement + text.substring(end))

    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length)
    })
  }, [])

  // Sync scroll
  const handleEditorScroll = (event: React.UIEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget
    const preview = previewRef.current
    if (!preview) return

    const denom = textarea.scrollHeight - textarea.clientHeight
    if (denom <= 0) return
    const scrollPercentage = textarea.scrollTop / denom
    preview.scrollTop = scrollPercentage * (preview.scrollHeight - preview.clientHeight)
  }

  // Drag and Drop handlers
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
  }, [])

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault()
    const file = event.dataTransfer.files?.[0]
    if (!file) return

    const isText = file.type.startsWith('text/') || 
                   file.name.endsWith('.md') || 
                   file.name.endsWith('.markdown') || 
                   file.name.endsWith('.txt')
    
    if (!isText) {
      setStatus('Unsupported file type dropped')
      return
    }

    await loadFile(file)
  }, [loadFile])

  // Stats calculation
  const stats = useMemo(() => {
    const chars = content.length
    const cleanContent = content.trim()
    const words = cleanContent === '' ? 0 : cleanContent.split(/\s+/).length
    const lines = content === '' ? 0 : content.split('\n').length
    const readingTime = Math.ceil(words / 200)
    return { chars, words, lines, readingTime }
  }, [content])

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey
      if (!modifier) return

      const key = event.key.toLowerCase()
      if (key === 'n') {
        event.preventDefault()
        handleNewFile()
      }
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
  }, [openFile, printFile, saveFile, handleNewFile])

  return (
    <main 
      className={`app-shell ${isMacTauri ? 'macos-tauri' : ''}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <header className="toolbar" data-tauri-drag-region aria-label="Markdown editor toolbar">
        <div className="document-meta" data-tauri-drag-region>
          <h1 data-tauri-drag-region>Markdown Editor</h1>
          <p title={fileName} data-tauri-drag-region>
            {fileName}
            {isModified ? ' • unsaved changes' : ''}
          </p>
        </div>

        <div className="toolbar-actions">
          <div className="autosave-container">
            <label className="switch" title="Auto-save modifications to disk">
              <input
                type="checkbox"
                checked={isAutoSave}
                onChange={(e) => setIsAutoSave(e.target.checked)}
                disabled={!currentFilePath && !fileHandle}
              />
              <span className="slider round"></span>
            </label>
            <span className={`autosave-label ${(!currentFilePath && !fileHandle) ? 'disabled' : ''}`}>
              Auto-Save
            </span>
          </div>

          <button
            id="dark-mode-toggle"
            type="button"
            onClick={() => setIsDarkMode(prev => !prev)}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            className="theme-toggle-btn"
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>

          <div className="font-size-control" role="group" aria-label="Font size">
            <button
              type="button"
              id="font-size-decrease"
              onClick={() => setFontSize(s => Math.max(MIN_FONT, s - 1))}
              disabled={fontSize <= MIN_FONT}
              title="Decrease text size"
              aria-label="Decrease text size"
              className="font-size-btn"
            >
              A−
            </button>
            <span className="font-size-display" aria-live="polite" aria-label={`Font size: ${fontSize} pixels`}>
              {fontSize}px
            </span>
            <button
              type="button"
              id="font-size-increase"
              onClick={() => setFontSize(s => Math.min(MAX_FONT, s + 1))}
              disabled={fontSize >= MAX_FONT}
              title="Increase text size"
              aria-label="Increase text size"
              className="font-size-btn"
            >
              A+
            </button>
          </div>

          <button type="button" onClick={handleNewFile} title="New file (Ctrl/Cmd+N)">
            New
          </button>
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
            <div className="stats-indicator">
              <span>{stats.lines.toLocaleString()} lines</span>
              <span className="separator">|</span>
              <span>{stats.words.toLocaleString()} words</span>
              <span className="separator">|</span>
              <span>{stats.chars.toLocaleString()} chars</span>
              <span className="separator">|</span>
              <span>{stats.readingTime} min read</span>
            </div>
          </div>
          
          <div className="formatting-toolbar">
            <button type="button" onClick={() => insertFormat('**', '**')} title="Bold text">
              <strong>B</strong>
            </button>
            <button type="button" onClick={() => insertFormat('_', '_')} title="Italic text">
              <em>I</em>
            </button>
            <button type="button" onClick={() => insertFormat('# ')} title="Heading 1">
              H1
            </button>
            <button type="button" onClick={() => insertFormat('## ')} title="Heading 2">
              H2
            </button>
            <button type="button" onClick={() => insertFormat('### ')} title="Heading 3">
              H3
            </button>
            <span className="toolbar-divider" />
            <button type="button" onClick={() => insertFormat('- ')} title="Bullet list">
              • List
            </button>
            <button type="button" onClick={() => insertFormat('1. ')} title="Numbered list">
              1. List
            </button>
            <button type="button" onClick={() => insertFormat('> ')} title="Blockquote">
              ” Quote
            </button>
            <span className="toolbar-divider" />
            <button type="button" onClick={() => insertFormat('`', '`')} title="Inline code">
              <code>Code</code>
            </button>
            <button type="button" onClick={() => insertFormat('```markdown\n', '\n```')} title="Code block">
              Code Block
            </button>
            <button type="button" onClick={() => insertFormat('[', '](https://)')} title="Insert link">
              Link
            </button>
          </div>

          <textarea
            ref={textareaRef}
            aria-label="Markdown source"
            spellCheck="true"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            onScroll={handleEditorScroll}
          />
        </section>

        <section className="pane preview-pane" aria-label="Rendered preview pane">
          <div className="pane-header preview-controls">
            <h2>Preview</h2>
            <span>{status}</span>
          </div>
          <article
            ref={previewRef}
            className="markdown-preview"
            dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
          />
        </section>
      </section>
    </main>
  )
}

export default App
