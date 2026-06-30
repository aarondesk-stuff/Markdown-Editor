#!/bin/zsh
cd "$(dirname "$0")" || exit 1

if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js/npm is required to run Markdown Editor."
  echo "Install Node.js, then run this launcher again."
  read "?Press Enter to close..."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "Installing dependencies for first run..."
  npm install || {
    echo "Dependency install failed."
    read "?Press Enter to close..."
    exit 1
  }
fi

echo "Starting Markdown Editor..."
echo "Open http://127.0.0.1:5173/ in your browser if it does not open automatically."

if command -v open >/dev/null 2>&1; then
  (sleep 2 && open "http://127.0.0.1:5173/") &
fi

npm run dev -- --host 127.0.0.1
