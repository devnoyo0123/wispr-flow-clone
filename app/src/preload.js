const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listHistory: (limit, beforeId) => ipcRenderer.invoke('history:list', { limit, beforeId }),
  getSettings: () => ipcRenderer.invoke('config:get'),
  setHotkey: (name) => ipcRenderer.invoke('config:setHotkey', name),
  setModelPath: (p) => ipcRenderer.invoke('config:setModelPath', p),
  setTtsEnabled: (enabled) => ipcRenderer.invoke('config:setTtsEnabled', enabled),
  setTtsVoice: (v) => ipcRenderer.invoke('config:setTtsVoice', v),
  setTtsRate: (r) => ipcRenderer.invoke('config:setTtsRate', r),
  setTtsPort: (p) => ipcRenderer.invoke('config:setTtsPort', p),
  listVoices: () => ipcRenderer.invoke('tts:listVoices'),
  testTts: (opts) => ipcRenderer.invoke('tts:test', opts),
  stopTts: () => ipcRenderer.invoke('tts:stop'),
  getServerPort: () => ipcRenderer.invoke('server:port'),
  onTranscriptionAdded: (cb) => {
    const h = (_e, row) => cb(row);
    ipcRenderer.on('transcription:added', h);
    return () => ipcRenderer.removeListener('transcription:added', h);
  },
  onStatus: (cb) => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on('status', h);
    return () => ipcRenderer.removeListener('status', h);
  },
});
