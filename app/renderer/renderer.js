const $ = (id) => document.getElementById(id);

const PAGE = 50;
let lastId = null;       // cursor: 마지막으로 본 id
let loaded = 0;          // 화면에 표시된 누적 개수
let exhausted = false;   // 더 불러올 게 없음
let loading = false;

function fmtDate(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function makeRow(r) {
  const li = document.createElement('li');
  li.dataset.id = r.id;
  li.innerHTML =
    `<div class="when">${escapeHtml(fmtDate(r.created_at))}</div>` +
    `<div class="txt">${escapeHtml(r.text)}</div>`;
  return li;
}

function appendRow(r) {
  $('list').appendChild(makeRow(r));
  $('empty').style.display = 'none';
}

function prependRow(row) {
  // 새 변환은 항상 맨 위 (cursor 와 무관)
  $('list').prepend(makeRow(row));
  loaded += 1;
  $('count').textContent = `(${loaded})`;
  $('empty').style.display = 'none';
}

async function loadMore() {
  if (loading || exhausted) return;
  loading = true;
  let rows = [];
  try {
    rows = await window.api.listHistory(PAGE, lastId);
  } catch (e) {
    loading = false;
    return;
  }
  loading = false;
  if (!rows.length) { exhausted = true; return; }
  rows.forEach(appendRow);
  loaded += rows.length;
  $('count').textContent = `(${loaded})`;
  lastId = rows[rows.length - 1].id;   // cursor 전진
  if (rows.length < PAGE) exhausted = true;
}

(async function init() {
  const settings = await window.api.getSettings();
  $('hotkey').value = settings.hotkey;
  $('modelPath').value = settings.modelPath || '';

  await loadMore();
  if (loaded === 0) $('empty').style.display = 'block';

  // 무한 스크롤: sentinel 이 보이면 다음 페이지 로드
  const sentinel = $('sentinel');
  if (sentinel && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) loadMore();
    }, { rootMargin: '200px' });
    io.observe(sentinel);
  }

  $('hotkey').addEventListener('change', (e) => {
    window.api.setHotkey(e.target.value);
  });
  $('saveModel').addEventListener('click', () => {
    window.api.setModelPath($('modelPath').value.trim());
    $('status').textContent = 'model path saved';
  });

  window.api.onTranscriptionAdded((row) => prependRow(row));
  window.api.onStatus((s) => { $('status').textContent = s; });
})();
