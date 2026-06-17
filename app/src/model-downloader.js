const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// HuggingFace ggerganov/whisper.cpp ggml 모델. 빈 modelPath 일 때 자동 다운로드.
const MODELS = {
  'large-v3': {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
    size: 3095033483,
  },
  base: {
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    size: 147866605,
  },
};

function dir() {
  return path.join(app.getPath('userData'), 'models');
}
function pathFor(name) {
  return path.join(dir(), `ggml-${name}.bin`);
}
function exists(name) {
  return fs.existsSync(pathFor(name));
}

async function download(name, onProgress) {
  const meta = MODELS[name];
  if (!meta) throw new Error('unknown model: ' + name);
  fs.mkdirSync(dir(), { recursive: true });
  const dest = pathFor(name);
  const tmp = dest + '.part';

  const res = await fetch(meta.url, { redirect: 'follow' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const total = Number(res.headers.get('content-length')) || meta.size;

  const reader = res.body.getReader();
  const out = fs.createWriteStream(tmp);
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.write(Buffer.from(value));
    got += value.length;
    if (onProgress) onProgress(got, total);
  }
  await new Promise((r) => out.end(r));
  fs.renameSync(tmp, dest); // 원자적 완료
  return dest;
}

module.exports = { download, exists, pathFor, dir, MODELS };
