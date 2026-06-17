// Diagnostic: log EVERY keydown/keyup with keycode + matching name.
// Goal: find a key that reliably fires BOTH keydown and keyup on this Mac,
// to use as the push-to-talk hotkey.
//
// Run:  node key-diag.js
// Then press/release various keys. Watch for keys that print BOTH
// "DOWN" and "UP". Good candidates: Right Option/Alt, Right Cmd, a letter.
// Avoid F7/F8/F9 (Mac media keys) and brightness/volume keys.
//
// Ctrl+C to quit.

import { uIOhook, UiohookKey } from 'uiohook-napi';

// reverse lookup keycode -> name
const codeToName = {};
for (const [name, code] of Object.entries(UiohookKey)) {
  if (typeof code === 'number' && codeToName[code] === undefined) {
    codeToName[code] = name;
  }
}

function fmt(e) {
  const name = codeToName[e.keycode] ?? '(unknown)';
  const mods = [
    e.altKey && 'Alt',
    e.ctrlKey && 'Ctrl',
    e.metaKey && 'Meta',
    e.shiftKey && 'Shift',
  ].filter(Boolean).join('+') || '-';
  return `keycode=${e.keycode} name=${name} mods=${mods}`;
}

const seenDown = new Set();
const seenUp = new Set();

uIOhook.on('keydown', (e) => {
  seenDown.add(e.keycode);
  const both = seenUp.has(e.keycode) ? ' ✅BOTH' : '';
  console.log(`⬇️  DOWN ${fmt(e)}${both}`);
});

uIOhook.on('keyup', (e) => {
  seenUp.add(e.keycode);
  const both = seenDown.has(e.keycode) ? ' ✅BOTH' : '';
  console.log(`⬆️  UP   ${fmt(e)}${both}`);
});

console.log('=== key diagnostic ===');
console.log('Press & release keys. We need a key that logs BOTH ⬇️ DOWN and ⬆️ UP.');
console.log('Try: Right Option(Alt), Right Command, a letter key (a), Caps Lock.');
console.log('Avoid F7/F8/F9 and volume/brightness (Mac media keys).');
console.log('Ctrl+C to quit.\n');

uIOhook.start();

// Robust exit: print summary, then HARD exit immediately.
// We intentionally do NOT await uIOhook.stop() (it can block the native
// thread and prevent the process from dying — that's the "won't quit" bug).
function quit() {
  console.log('\n--- summary ---');
  const both = [...seenDown].filter((c) => seenUp.has(c));
  console.log('keys that fired BOTH down+up:', both.map((c) => `${codeToName[c]}(${c})`).join(', ') || '(none)');
  // HARD exit. Do NOT call uIOhook.stop() — it can block the native thread
  // and prevent exit (that was the "won't quit" bug). OS reclaims the thread.
  process.exit(0);
}
process.on('SIGINT', quit);
process.on('SIGTERM', quit);
