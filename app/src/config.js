const Store = require('electron-store');

const store = new Store({
  name: 'wispr-config',
  defaults: {
    hotkey: 'rightCmd',
    language: 'ko',
    whisperPath: 'whisper-cli',
    // 빈 값이면 부팅 시 ensureModel() 이 large-v3 를 자동 다운로드(userData/models/) 후 세팅
    modelPath: '',
    ttsEnabled: false,
    ttsEngine: 'say',
    // 빈 값 = 시스템 기본 음성. macOS: 'Yuna'(ko), 'Samantha'(en) 등
    ttsVoice: '',
    ttsRate: 1.0,
    ttsPort: 4783,
    ttsServerUrl: 'http://127.0.0.1:9880',
  },
});

module.exports = store;
