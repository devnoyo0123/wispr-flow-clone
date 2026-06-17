const Store = require('electron-store');
const path = require('path');

const store = new Store({
  name: 'wispr-config',
  defaults: {
    hotkey: 'rightCmd',
    language: 'ko',
    whisperPath: '/opt/homebrew/bin/whisper-cli',
    modelPath: path.resolve(__dirname, '../../spike/models/ggml-large-v3.bin'),
    db: {
      host: '127.0.0.1',
      port: 55432,
      user: 'wispr',
      password: 'wispr',
      database: 'wispr',
    },
  },
});

module.exports = store;
