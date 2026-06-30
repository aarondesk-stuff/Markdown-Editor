import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Debounce timer
let debounceTimer = null;
const DEBOUNCE_DELAY_MS = 10000; // Wait 10 seconds of inactivity before committing

// Files/folders to ignore
const IGNORED_PATHS = [
  '.git',
  'node_modules',
  'dist',
  'dist-ssr',
  'src-tauri/target',
  'src-tauri/gen',
  '.DS_Store'
];

function shouldIgnore(filePath) {
  const relative = path.relative(projectRoot, filePath);
  return IGNORED_PATHS.some(ignored => 
    relative === ignored || 
    relative.startsWith(ignored + path.sep) ||
    filePath.includes(`${path.sep}.git${path.sep}`) ||
    filePath.includes(`${path.sep}node_modules${path.sep}`) ||
    filePath.includes(`${path.sep}target${path.sep}`)
  );
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: projectRoot }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim() || stderr.trim());
      }
    });
  });
}

async function handleAutoCommit() {
  console.log('\n[Auto-Commit] Change detected. Preparing commit...');
  try {
    // Check if there are any changes staged or unstaged
    const status = await runCommand('git status --porcelain');
    if (!status) {
      console.log('[Auto-Commit] No actual changes to commit.');
      return;
    }

    console.log('[Auto-Commit] Staging changes...');
    await runCommand('git add .');

    const timestamp = new Date().toLocaleString();
    const commitMsg = `Auto-commit: ${timestamp}`;
    console.log(`[Auto-Commit] Committing: "${commitMsg}"...`);
    await runCommand(`git commit -m "${commitMsg}"`);

    console.log('[Auto-Commit] Pushing to remote...');
    const pushOutput = await runCommand('git push');
    console.log('[Auto-Commit] Push succeeded!');
    console.log(pushOutput);
  } catch (error) {
    console.error('[Auto-Commit] Error occurred:', error.message);
  }
}

console.log(`[Watcher] Starting file monitor on: ${projectRoot}`);
console.log(`[Watcher] Auto-commits will trigger after ${DEBOUNCE_DELAY_MS / 1000}s of inactivity.`);

fs.watch(projectRoot, { recursive: true }, (eventType, filename) => {
  if (!filename) return;
  const fullPath = path.join(projectRoot, filename);

  if (shouldIgnore(fullPath)) return;

  console.log(`[Watcher] Change in: ${filename} (${eventType})`);

  // Clear existing timer and set a new one
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void handleAutoCommit();
  }, DEBOUNCE_DELAY_MS);
});
