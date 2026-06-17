// Risk spike for Wispr Flow clone
// Validates the 3 risky pieces, WITHOUT recording/STT:
//   1. Global keydown/keyup detection (push-to-talk) via uiohook-napi
//   2. Insert text into the currently focused app (clipboard + Cmd+V via osascript)
//   3. macOS permission flow (Accessibility / Input Monitoring)
//
// Hold the hotkey -> "RECORDING..." ; release -> pastes a fixed test string
// into whatever app currently has focus.
//
// Default hotkey: F8 (single key, easy to hold). Change HOTKEY below.
//
// Run:  node ptt-spike.js
// Then focus another app (e.g. TextEdit / browser), hold F8, release.

import { uIOhook, UiohookKey } from 'uiohook-napi';
import { execFile } from 'node:child_process';

const HOTKEY = UiohookKey.F8; // hold-to-record key
const TEST_TEXT = '안녕하세요! 이것은 받아쓰기 스파이크 테스트입니다. Hello from spike 👋';

let holding = false;
let pressStartedAt = 0;

function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    const p = execFile('pbcopy', [], (err) => (err ? reject(err) : resolve()));
    p.stdin.end(text);
  });
}

function pasteViaCmdV() {
  return new Promise((resolve, reject) => {
    // Requires Accessibility permission for the running process (Terminal/node)
    execFile(
      'osascript',
      ['-e', 'tell application "System Events" to keystroke "v" using command down'],
      (err, _stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve()),
    );
  });
}

async function insertText(text) {
  await copyToClipboard(text);
  // tiny delay so clipboard is ready before paste
  await new Promise((r) => setTimeout(r, 80));
  await pasteViaCmdV();
}

uIOhook.on('keydown', (e) => {
  if (e.keycode === HOTKEY && !holding) {
    holding = true;
    pressStartedAt = Date.now();
    console.log('🔴 RECORDING... (hold detected — keydown)');
  }
});

uIOhook.on('keyup', async (e) => {
  if (e.keycode === HOTKEY && holding) {
    holding = false;
    const heldMs = Date.now() - pressStartedAt;
    console.log(`⏹️  STOP (keyup) — held ${heldMs}ms. Inserting test text into focused app...`);
    try {
      await insertText(TEST_TEXT);
      console.log('✅ Pasted into focused app.');
    } catch (err) {
      console.error('❌ Paste failed:', err.message);
      console.error('   → Likely missing Accessibility permission for your terminal.');
    }
  }
});

console.log('=== Wispr Flow PTT spike ===');
console.log('Hotkey: F8 (hold to "record", release to paste test text).');
console.log('Focus another app (TextEdit/browser), then hold & release F8.');
console.log('Ctrl+C to quit.\n');
console.log('If nothing prints on keypress → grant Input Monitoring + Accessibility');
console.log('to your terminal in System Settings > Privacy & Security.\n');

uIOhook.start();

// HARD exit on Ctrl+C. Do NOT call uIOhook.stop() first — it can block the
// native thread and stop the process from ever exiting.
function quit() {
  console.log('\nStopping...');
  process.exit(0);
}
process.on('SIGINT', quit);
process.on('SIGTERM', quit);
