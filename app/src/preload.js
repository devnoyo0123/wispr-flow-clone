const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  listHistory: (limit, beforeId) => ipcRenderer.invoke('history:list', { limit, beforeId }),
  getSettings: () => ipcRenderer.invoke('config:get'),
  setHotkey: (name) => ipcRenderer.invoke('config:setHotkey', name),
  setModelPath: (p) => ipcRenderer.invoke('config:setModelPath', p),
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
