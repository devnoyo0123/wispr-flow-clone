const express = require('express');
const config = require('./config');
const tts = require('./tts');

const MAX_TEXT_LENGTH = 5000;
const PORT_ATTEMPTS = 10;

let server = null;
let boundPort = null;

function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(express.text({ limit: '1mb', type: 'text/plain' }));

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use((req, _res, next) => {
    if (req.method === 'POST' && req.path === '/tts') {
      const body = typeof req.body === 'string' ? req.body.slice(0, 200) : JSON.stringify(req.body || {}).slice(0, 200);
      console.log(`[tts-req] ${req.method} ${req.path} from ${req.ip} origin=${req.get('origin') || '-'} ua=${req.get('user-agent') || '-'} body=${body}`);
    }
    next();
  });

  app.get('/', (req, res) => {
    res.json({
      ok: true,
      service: 'KlakTalk TTS',
      ttsEnabled: config.get('ttsEnabled'),
      speaking: tts.isSpeaking(),
    });
  });

  app.get('/voices', async (req, res) => {
    const voices = await tts.listVoices();
    res.json({ voices });
  });

  app.post('/tts', (req, res) => {
    if (!config.get('ttsEnabled')) {
      return res.status(403).json({ error: 'TTS disabled. Enable in KlakTalk settings.' });
    }
    let text, voice, rate;
    if (typeof req.body === 'string') {
      text = req.body;
    } else {
      text = req.body?.text;
      voice = req.body?.voice;
      rate = req.body?.rate;
    }
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Missing "text" field' });
    }
    const trimmed = text.slice(0, MAX_TEXT_LENGTH);
    try {
      tts.speak(trimmed, voice || rate ? { voice: voice || undefined, rate } : undefined);
      res.json({ ok: true, length: trimmed.length });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/stop', (req, res) => {
    tts.stop();
    res.json({ ok: true });
  });

  return app;
}

function start() {
  return new Promise((resolve) => {
    const app = createApp();
    const basePort = config.get('ttsPort') || 4783;

    const tryPort = (port, attemptsLeft) => {
      const s = app.listen(port, '127.0.0.1');
      s.on('listening', () => {
        server = s;
        boundPort = port;
        console.log(`[tts-server] listening on http://127.0.0.1:${port}`);
        resolve({ port, server: s });
      });
      s.on('error', (err) => {
        if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
          tryPort(port + 1, attemptsLeft - 1);
        } else {
          console.error('[tts-server] failed to start:', err.message);
          resolve({ port: null, server: null, error: err.message });
        }
      });
    };

    tryPort(basePort, PORT_ATTEMPTS);
  });
}

function stop() {
  if (server) {
    server.close();
    server = null;
    boundPort = null;
  }
  tts.stop();
}

function getPort() {
  return boundPort;
}

module.exports = { start, stop, getPort };
