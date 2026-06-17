const { contextBridge, ipcRenderer } = require('electron');

// overlay(HUD) 창은 메인 프로세스로부터 상태만 수신
contextBridge.exposeInMainWorld('hud', {
  onState: (cb) => {
    const h = (_e, state) => cb(state);
    ipcRenderer.on('hud:state', h);
    return () => ipcRenderer.removeListener('hud:state', h);
  },
});
