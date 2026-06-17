const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const db = require('./db');
const { transcribe } = require('./transcriber');
const { HelperBridge } = require('./helper-bridge');
const model = require('./model-downloader');

let tray, win, overlay, helper;
let busy = false;

function setStatus(s) {
  if (win && !win.isDestroyed()) win.webContents.send('status', String(s));
}

// --- floating overlay (HUD) ---
function positionOverlay() {
  if (!overlay || overlay.isDestroyed()) return;
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const b = overlay.getBounds();
  // 화면 하단 중앙 (독 위 90px)
  overlay.setPosition(Math.round((width - b.width) / 2), height - b.height - 90, false);
}

function setOverlay(state) {
  if (!overlay || overlay.isDestroyed()) return;
  const wc = overlay.webContents;
  const send = () => wc.send('hud:state', state);
  if (wc.isLoading()) wc.once('did-finish-load', send);
  else send();
  if (state.state && state.state !== 'hidden') overlay.showInactive();
}

// 잠깐 띄웠다가 사라지는 상태 (완료/빈결과/오류)
function flashOverlay(state, ms = 1700) {
  setOverlay(state);
  setTimeout(() => {
    setOverlay({ state: 'hidden' });
    if (overlay && !overlay.isDestroyed()) overlay.hide();
  }, ms);
}

function createOverlay() {
  overlay = new BrowserWindow({
    width: 380,
    height: 84,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    level: 'floating',
    visibleOnAllWorkspaces: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'overlay-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlay.loadFile(path.join(__dirname, '..', 'renderer', 'overlay.html'));
  overlay.once('ready-to-show', positionOverlay);
  screen.on('display-metrics-changed', positionOverlay);
}

// --- 모델 자동 준비 (modelPath 가 비어있거나 파일이 없으면 large-v3 다운로드) ---
async function ensureModel() {
  const p = config.get('modelPath');
  if (p && fs.existsSync(p)) return;
  setOverlay({ state: 'downloading', percent: 0 });
  try {
    const dest = await model.download('large-v3', (got, total) => {
      const pct = total ? Math.round((got / total) * 100) : 0;
      setOverlay({ state: 'downloading', percent: pct });
    });
    config.set('modelPath', dest);
    flashOverlay({ state: 'done', preview: '모델 다운로드 완료' }, 1500);
  } catch (e) {
    flashOverlay({ state: 'error', message: '모델 다운로드 실패: ' + (e.message || e) });
  }
}

async function handleRecordingStopped(msg) {
  if (busy) { setStatus('busy — skipped'); flashOverlay({ state: 'empty' }, 900); return; }
  busy = true;
  setStatus('transcribing…');
  setOverlay({ state: 'transcribing' });
  try {
    const text = await transcribe(msg.wav);
    const clean = (text || '').trim();
    if (clean) {
      helper.send({ cmd: 'paste', text: clean });
      const row = await db.insertTranscription(clean);
      if (win && !win.isDestroyed()) win.webContents.send('transcription:added', row);
      setStatus('idle');
      flashOverlay({ state: 'done', preview: clean });
    } else {
      setStatus('empty transcription');
      flashOverlay({ state: 'empty' });
    }
  } catch (e) {
    setStatus('error: ' + (e.message || e));
    flashOverlay({ state: 'error', message: e.message || String(e) });
  } finally {
    busy = false;
    try { fs.unlinkSync(msg.wav); } catch {}
  }
}

function makeTrayIcon() {
  const w = 16, h = 16;
  const buf = Buffer.alloc(w * h * 4);
  // 마이크 모양: 위쪽 둥근 몸통(반지름 4) + 아래 짧은 스탠드
  const bodyCy = 6.5, bodyR = 3.5;
  const stemX = 8, stemYTop = 10, stemYBot = 13, stemW = 1.0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const px = x + 0.5, py = y + 0.5;
      const inBody = (px - 8) ** 2 + (py - bodyCy) ** 2 <= bodyR ** 2;
      const inStem = py >= stemYTop && py <= stemYBot && Math.abs(px - stemX) <= stemW;
      const o = (y * w + x) * 4;
      if (inBody || inStem) {
        // 검정 + 불투명 → template 로 지정하면 메뉴바에서 항상 보임(라이트/다크 자동 대응)
        buf[o] = 0; buf[o + 1] = 0; buf[o + 2] = 0; buf[o + 3] = 255;
      } else {
        buf[o + 3] = 0; // 투명
      }
    }
  }
  const img = nativeImage.createFromBitmap(buf, { width: w, height: h });
  img.setTemplateImage(true);
  return img;
}

function createTray() {
  tray = new Tray(makeTrayIcon());
  const menu = Menu.buildFromTemplate([
    { label: 'Open Wispr', click: () => win?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setToolTip('Wispr Flow Clone');
  tray.setContextMenu(menu);
  tray.on('click', () => (win?.isVisible() ? win.hide() : win.show()));
}

function createWindow() {
  win = new BrowserWindow({
    width: 480,
    height: 680,
    show: false,
    title: 'Wispr Flow Clone',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  // 실행 시 창을 바로 띄운다 (트레이 전용 앱이지만 첫 실행엔 보이는 게 자연스러움)
  win.once('ready-to-show', () => win.show());
  // 닫기(X) 버튼 = 앱 완전 종료. 창만 숨기고 싶으면 트레이 아이콘 클릭.
  win.on('close', () => app.quit());
}

function startHelper() {
  helper = new HelperBridge();
  helper.on('recording_started', () => {
    setStatus('● recording…');
    setOverlay({ state: 'recording' });
  });
  helper.on('recording_stopped', (m) => handleRecordingStopped(m));
  helper.on('hotkey_set', (m) => setStatus('hotkey: ' + m.hotkey));
  helper.on('error', (m) => setStatus('helper error: ' + (m.message || '')));
  helper.on('fatal', (m) => {
    setStatus('FATAL: ' + (m.message || ''));
    flashOverlay({ state: 'error', message: m.message || 'fatal' });
  });
  helper.on('exit', (code) => setStatus('helper exited ' + code));
  helper.start();
}

// IPC
ipcMain.handle('history:list', () => db.listRecent(100).catch((e) => { setStatus('db: ' + e.message); return []; }));
ipcMain.handle('config:get', () => config.store);
ipcMain.handle('config:setHotkey', (_e, name) => {
  config.set('hotkey', name);
  helper?.send({ cmd: 'set_hotkey', name });
  return true;
});
ipcMain.handle('config:setModelPath', (_e, p) => { config.set('modelPath', p); return true; });

app.whenReady().then(async () => {
  createTray();
  createWindow();
  createOverlay();
  await ensureModel();   // 모델 준비 (필요시 자동 다운로드)
  startHelper();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => helper?.stop());
