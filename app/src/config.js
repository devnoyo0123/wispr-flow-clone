const Store = require('electron-store');

const store = new Store({
  name: 'wispr-config',
  defaults: {
    hotkey: 'rightCmd',
    language: 'ko',
    whisperPath: 'whisper-cli',
    // 빈 값이면 부팅 시 ensureModel() 이 large-v3 를 자동 다운로드(userData/models/) 후 세팅
    modelPath: '',
  },
});

module.exports = store;
