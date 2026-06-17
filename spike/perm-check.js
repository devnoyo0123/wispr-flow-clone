// Permission + capture diagnostic v2 (time-boxed, auto-exits).
// FIX: a key must fire BOTH down AND up (same keycode) to count as working.
//      Detects Warp and warns (Warp swallows global key events).
//
// Run:  node perm-check.js   (run in APPLE Terminal.app, NOT Warp)

import { uIOhook } from 'uiohook-napi';

console.log('=== environment ===');
console.log('TERM_PROGRAM        =', process.env.TERM_PROGRAM || '(unset)');
console.log('__CFBundleIdentifier=', process.env.__CFBundleIdentifier || '(unset)');
console.log('node binary         =', process.execPath);

const isWarp = process.env.TERM_PROGRAM === 'WarpTerminal' ||
               (process.env.__CFBundleIdentifier || '').includes('Warp');
if (isWarp) {
  console.log('');
  console.log('🚨 STOP — you are in WARP.');
  console.log('   Warp swallows global key events. This test CANNOT pass here.');
  console.log('   Open APPLE "Terminal" instead:  Spotlight(Cmd+Space) -> type "Terminal"');
  console.log('   Then run this script from there. Grant Input Monitoring to "Terminal".');
}
console.log('');

const downKeys = new Set();
const upKeys = new Set();
const downCount = { n: 0 };
const upCount = { n: 0 };

uIOhook.on('keydown', (e) => { downCount.n++; downKeys.add(e.keycode); });
uIOhook.on('keyup', (e) => { upCount.n++; upKeys.add(e.keycode); });

console.log('⏱️  Capturing for 8s — PRESS & RELEASE real keys (a s d, then hold/release Cmd or Option)...\n');
uIOhook.start();

setTimeout(() => {
  const paired = [...downKeys].filter((k) => upKeys.has(k)); // SAME key, down AND up
  console.log('--- result ---');
  console.log('total keydown events :', downCount.n);
  console.log('total keyup   events :', upCount.n);
  console.log('distinct keys (down) :', [...downKeys].join(', ') || '(none)');
  console.log('keys that did DOWN→UP:', paired.join(', ') || '(none)');

  console.log('');
  if (paired.length === 0) {
    console.log('❌ NO key completed a down→up cycle.');
    console.log('   You pressed keys but the hook did not see them.');
    if (isWarp) {
      console.log('   ROOT CAUSE: Warp terminal. Switch to Apple Terminal.app.');
    } else {
      console.log('   ROOT CAUSE: Input Monitoring permission missing for', process.env.TERM_PROGRAM || 'this terminal');
      console.log('   → System Settings > Privacy & Security > Input Monitoring > enable your terminal');
      console.log('   → Restart the terminal, re-run.');
    }
  } else {
    console.log('✅ Capture WORKS — real key presses produced matched down/up pairs.');
    console.log('   Push-to-talk mechanism is VALID.');
  }
  process.exit(0);
}, 8000);
