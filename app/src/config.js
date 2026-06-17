const Store = require('electron-store');

const store = new Store({
  name: 'wispr-config',
  defaults: {
    hotkey: 'rightCmd',
    language: 'ko',
    whisperPath: '/opt/homebrew/bin/whisper-cli',
    // 현재 보유 모델(large-v3) 절대경로 — 개발/정식 .app 모두에서 동일하게 사용
    modelPath: '/Users/colosseum_nohys/Documents/my/playground/wispr-flow-clone/spike/models/ggml-large-v3.bin',
  },
});

module.exports = store;
