@echo off
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm is required to run Markdown Editor.
  echo Install Node.js, then run this launcher again.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies for first run...
  call npm install
  if errorlevel 1 (
    echo Dependency install failed.
    pause
    exit /b 1
  )
)

echo Starting Markdown Editor...
start "" "http://127.0.0.1:5173/"
call npm run dev -- --host 127.0.0.1
pause
