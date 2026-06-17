const pill = document.getElementById('pill');
const title = document.getElementById('title');
const sub = document.getElementById('sub');
const wave = document.getElementById('wave');

let timer = null;

function fmt(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
function startTimer() {
  stopTimer();
  const t0 = Date.now();
  sub.textContent = '0:00';
  timer = setInterval(() => { sub.textContent = fmt(Date.now() - t0); }, 200);
}

function setState(st) {
  pill.className = 'pill';          // 상태 클래스 초기화
  wave.classList.remove('on');
  stopTimer();
  title.textContent = '';
  sub.textContent = '';

  switch (st.state) {
    case 'downloading':
      pill.classList.add('downloading');
      title.textContent = '모델 다운로드';
      sub.textContent = (st.percent || 0) + '%';
      break;
    case 'recording':
      pill.classList.add('recording');
      title.textContent = '녹음 중';
      wave.classList.add('on');
      startTimer();
      break;
    case 'transcribing':
      pill.classList.add('transcribing');
      title.textContent = '변환 중…';
      sub.textContent = 'whisper 실행 중';
      break;
    case 'done':
      pill.classList.add('done');
      title.textContent = '✓ 완료';
      sub.textContent = (st.preview || '').slice(0, 34);
      break;
    case 'empty':
      pill.classList.add('empty');
      title.textContent = '인식된 음성 없음';
      break;
    case 'error':
      pill.classList.add('error');
      title.textContent = '오류';
      sub.textContent = (st.message || '').slice(0, 140);
      break;
    case 'hidden':
      pill.classList.add('hidden');
      break;
  }
}

window.hud.onState(setState);
