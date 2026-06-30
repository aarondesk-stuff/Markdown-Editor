# Markdown Editor

A cross-platform, web-based Markdown editor built with React, TypeScript, and Vite.

## Features

- Two-pane layout: Markdown source on the left and live rendered preview on the right.
- Packaged desktop app support with Tauri.
- Open local `.md`, `.markdown`, and `.txt` files.
- Save back to an opened file in the Tauri desktop app and in browsers that support the File System Access API.
- Save As / download fallback for broader browser support.
- Print the rendered preview.
- Keyboard shortcuts:
  - `Ctrl/Cmd + O`: Open
  - `Ctrl/Cmd + S`: Save
  - `Ctrl/Cmd + P`: Print
- Responsive layout for smaller screens.

## Getting started

### Run without typing npm commands

You can launch the app without manually typing npm commands:

- **macOS:** double-click `start-mac.command`.
- **Windows:** double-click `start-windows.bat`.
- **VS Code:** use **Terminal > Run Task... > dev**.

The first launch may install dependencies automatically if `node_modules` is missing. Node.js still needs to be installed on the computer because this is a web development project.

To stop the app, return to the terminal window that opened and press `Ctrl + C`.

### Run in a dedicated app window

The app now includes Progressive Web App support, so supported browsers can install it into a standalone window:

1. Start or preview the app.
2. Open it in Chrome, Edge, or another PWA-capable browser.
3. Use the browser's install option, usually shown as **Install**, **Install app**, or an install icon in the address bar.
4. Launch **Markdown Editor** from your Applications folder, Start menu, Dock, or app launcher.

This keeps the project web-first and cross-platform. A pure web app still needs to be served from somewhere, such as the local launcher, a preview server, or a hosted website.

### Run as a full desktop app with Tauri

This project is also configured as a Tauri desktop app.

Run the desktop app in development mode:

```bash
npm run desktop:dev
```

Build the macOS desktop app bundle:

```bash
npm run desktop:build
```

The built app is created here:

```text
src-tauri/target/release/bundle/macos/Markdown Editor.app
```

You can double-click that `.app` bundle, or copy it to your Applications folder.

To attempt every installer/bundle type supported by your platform, run:

```bash
npm run desktop:build:all
```

On macOS, `desktop:build` intentionally builds the `.app` bundle directly. The all-bundles command may require additional platform tooling for installer formats such as `.dmg`.

### Manual commands

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Browser notes

The app is fully web-based. Chromium-based browsers can save directly to selected files through the File System Access API. Other browsers use standard upload/download fallbacks for opening and saving files.
