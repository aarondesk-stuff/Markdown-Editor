# Markdown Editor

An elegant, dual-pane Markdown editor built with React, TypeScript, and Vite. It is distributed in two distinct final software versions:

1. **Web-Based Application**: Runs in any modern web browser and can be deployed to static web hosting. Supports PWA installation for a standalone window experience.
2. **Self-Contained Desktop Application (Tauri)**: A native macOS desktop application. Features a transparent overlay titlebar, sync-scrolling, auto-saving directly to disk, statistics, formatting toolbar, and native keyboard shortcuts.

---

## Features

- **Live Dual-Pane Workspace**: Edit Markdown on the left with a live rendered preview on the right.
- **Sync Scroll**: Scrolling the editor pane automatically synchronizes the preview scroll position.
- **Formatting Toolbar**: Quick-insert buttons for formatting text (Bold, Italic, Header sizes, lists, quotes, inline code, code blocks, and links).
- **Document Statistics**: Live indicators showing line count, word count, character count, and estimated reading time.
- **Auto-Save Option**: Automatically saves modifications back to disk 1 second after typing stops (requires an open file path).
- **Drag-and-Drop File Loading**: Drag and drop any `.md` or `.txt` file onto the window to open it.
- **Print & PDF Export**: Clean, print-styled preview layout for paper or PDF export.
- **Native Keyboard Shortcuts**:
  - `Cmd/Ctrl + N`: New File
  - `Cmd/Ctrl + O`: Open File
  - `Cmd/Ctrl + S`: Save File
  - `Cmd/Ctrl + P`: Print Preview

---

## 1. Web-Based Version

The web-based version is served as static HTML/JS/CSS assets. 

### Local Development
To start the local web development server:
```bash
npm run dev
```

### Production Build
To compile the static assets for web hosting:
```bash
npm run build
```
The compiled output is created in the `dist` directory, which can be deployed to Vercel, Netlify, or any static web server.

### Progressive Web App (PWA)
When running on HTTPS (or localhost), you can install the app to your system in a standalone window using the browser's install prompt.

---

## 2. Self-Contained Desktop App (Tauri)

The desktop version is compiled to a native macOS `.app` bundle using Tauri, offering native file dialogs and low-level system integration.

### Local Development
To launch the desktop app in development mode:
```bash
npm run desktop:dev
```

### Production Build (macOS)
To compile and package the self-contained macOS `.app` bundle:
```bash
npm run desktop:build
```
The final application is built here:
```text
src-tauri/target/release/bundle/macos/Markdown Editor.app
```
You can drag this bundle to your **Applications** folder to run it.

---

## Startup & Utilities

### No-Command Launchers
For convenience, you can launch the local web server without manually running commands:
- **macOS**: Double-click `start-mac.command`
- **Windows**: Double-click `start-windows.bat`
- **VS Code**: Run the preconfigured task: `Terminal > Run Task... > dev`

