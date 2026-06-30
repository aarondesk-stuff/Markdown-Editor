# Project Instructions

- Work through checklist items systematically.
- Keep communication concise and focused.
- Follow development best practices.
- Use the workspace root for project commands.
- Do not add native-only dependencies; this project should remain cross-platform and web-based.
- Tauri is configured as the desktop packaging layer while preserving the React/Vite web app.

## Setup checklist

- [x] Verify that `.github/copilot-instructions.md` exists.
  - Created and maintained this instructions file.

- [x] Clarify project requirements.
  - Requirements specified: a new cross-platform web-based Markdown editor with a left Markdown source pane, right rendered preview pane, and common file actions.

- [x] Scaffold the project.
  - Scaffolded a React + TypeScript Vite project in the workspace root.

- [x] Customize the project.
  - Implemented live Markdown rendering, open, save, save-as/download fallback, print support, keyboard shortcuts, responsive styling, installable PWA support, Tauri desktop packaging, and documentation.

- [x] Install required extensions.
  - No VS Code extensions are required.

- [x] Compile the project.
  - Installed dependencies and verified `npm run build` completes successfully with no TypeScript or CSS diagnostics.

- [x] Create and run task.
  - Created and ran a VS Code build task using `npm run build` successfully.
  - Added a reusable dev server task.

- [x] Launch the project.
  - Started the Vite dev server and opened the app at `http://127.0.0.1:5173/`.

- [x] Ensure documentation is complete.
  - Updated README with features, commands, keyboard shortcuts, and browser compatibility notes.
