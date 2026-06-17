const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Parse whisper-cli stdout: lines like "[00:00:00.000 --> 00:00:05.040]   text"
const SEG = /^\[\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}\]\s*(.*)$/;

// 번들 whisper(native/whisper/whisper-cli) 우선, 없으면 Homebrew(PATH) fallback.
// asar:false 라 개발/정식 .app 모두 ../native/whisper 경로가 동일.
function resolveWhisper() {
  const bundled = path.join(__dirname, '..', 'native', 'whisper', 'whisper-cli');
  if (fs.existsSync(bundled)) return bundled;
  return config.get('whisperPath') || 'whisper-cli';
}

function transcribe(wavPath) {
  return new Promise((resolve, reject) => {
    const whisperPath = resolveWhisper();
    const modelPath = config.get('modelPath');
    const lang = config.get('language') || 'ko';
    if (!modelPath) return reject(new Error('modelPath not configured'));

    const args = ['-m', modelPath, '-f', wavPath, '-l', lang];
    const p = spawn(whisperPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });

    const segs = [];
    p.stdout.on('data', (d) => {
      for (const raw of d.toString().split('\n')) {
        const m = raw.match(SEG);
        if (m && m[1].trim()) segs.push(m[1].trim());
      }
    });
    p.stderr.on('data', () => {}); // discard model/BLAS logs
    p.on('error', reject);
    p.on('close', (code) => {
      if (code !== 0) return reject(new Error(`whisper-cli exited ${code}`));
      resolve(segs.join(' ').trim());
    });
  });
}

module.exports = { transcribe };
