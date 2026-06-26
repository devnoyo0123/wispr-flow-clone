const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const config = require('./config');

const BASE_WPM = 175;

let speaking = false;
const procs = new Set();

function speak(text, options = {}) {
  if (!text || typeof text !== 'string') return;
  const engine = config.get('ttsEngine') || 'say';
  if (engine === 'supertonic' || engine === 'kokoro' || engine === 'melo' || engine === 'qwen3') {
    speakRemote(text, options);
  } else {
    speakSay(text, options);
  }
}

function speakSay(text, options = {}) {
  stop();
  const voice = options.voice || config.get('ttsVoice') || '';
  const rate = options.rate ?? config.get('ttsRate') ?? 1.0;
  const wpm = Math.round(BASE_WPM * rate);
  const args = ['-r', String(wpm)];
  if (voice) args.push('-v', voice);
  args.push(text.slice(0, 5000));
  speaking = true;
  const proc = spawn('say', args);
  procs.add(proc);
  proc.on('exit', () => {
    procs.delete(proc);
    if (procs.size === 0) speaking = false;
  });
  proc.on('error', (err) => {
    procs.delete(proc);
    if (procs.size === 0) speaking = false;
    console.error('[tts] speak error:', err);
  });
}

async function speakRemote(text, options = {}) {
  stop();
  speaking = true;
  const url = config.get('ttsServerUrl') || 'http://127.0.0.1:9880';
  const lang = options.language || 'ko';
  const sentences = splitSentences(text);

  if (sentences.length === 0) return;
  try {
    let currentBuffer = await fetchTts(url, sentences[0], lang);
    for (let i = 0; i < sentences.length; i++) {
      if (!speaking) break;
      const nextPromise = (i + 1 < sentences.length)
        ? fetchTts(url, sentences[i + 1], lang)
        : null;
      await playWav(currentBuffer);
      if (nextPromise) {
        currentBuffer = await nextPromise;
      }
    }
  } catch (err) {
    console.error('[tts] remote speak error:', err);
  } finally {
    speaking = false;
  }
}

function splitSentences(text) {
  return text
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function fetchTts(url, text, lang) {
  const voice = config.get('ttsVoice') || 'M1';
  const speed = config.get('ttsRate') ?? 1.0;
  const res = await fetch(`${url}/v1/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text.slice(0, 5000),
      voice,
      lang,
      speed,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function playWav(buffer) {
  return new Promise((resolve) => {
    const tmpFile = path.join(os.tmpdir(), `klaktalk-tts-${Date.now()}-${Math.random().toString(36).slice(2)}.wav`);
    fs.writeFileSync(tmpFile, buffer);
    const proc = spawn('afplay', [tmpFile]);
    procs.add(proc);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      procs.delete(proc);
      // NOTE: speaking 플래그는 speakMelo 루프(finally)에서만 관리한다.
      // 여기서 procs.size 기준으로 끄면, 첫 afplay가 끝나는 순간
      // speaking=false가 되어 다음 문장 재생 전에 루프가 break된다.
      try { fs.unlinkSync(tmpFile); } catch {}
      resolve();
    };
    proc.on('exit', finish);
    proc.on('error', finish);
  });
}

function stop() {
  for (const p of procs) {
    try { p.kill('SIGKILL'); } catch {}
  }
  procs.clear();
  speaking = false;
  exec('killall say 2>/dev/null');
  exec('killall afplay 2>/dev/null');
}

function isSpeaking() {
  return speaking;
}

function listVoices() {
  return new Promise((resolve) => {
    exec('say -v ?', (err, stdout) => {
      if (err) { console.error('[tts] listVoices error:', err); resolve([]); return; }
      const voices = stdout.split('\n')
        .map((line) => {
          const m = line.match(/^(\S+)\s+(\S+)/);
          return m ? m[1] : null;
        })
        .filter(Boolean);
      resolve(voices);
    });
  });
}

module.exports = { speak, stop, isSpeaking, listVoices };
