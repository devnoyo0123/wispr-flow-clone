const $ = (id) => document.getElementById(id);

function fmtDate(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderRows(rows) {
  const list = $('list');
  list.innerHTML = '';
  $('count').textContent = rows.length ? `(${rows.length})` : '';
  $('empty').style.display = rows.length ? 'none' : 'block';
  for (const r of rows) {
    const li = document.createElement('li');
    li.innerHTML =
      `<div class="when">${escapeHtml(fmtDate(r.created_at))}</div>` +
      `<div class="txt">${escapeHtml(r.text)}</div>`;
    list.appendChild(li);
  }
}

function prependRow(row) {
  const list = $('list');
  const li = document.createElement('li');
  li.innerHTML =
    `<div class="when">${escapeHtml(fmtDate(row.created_at))}</div>` +
    `<div class="txt">${escapeHtml(row.text)}</div>`;
  list.prepend(li);
  $('empty').style.display = 'none';
  const n = list.children.length;
  $('count').textContent = `(${n})`;
}

(async function init() {
  const settings = await window.api.getSettings();
  $('hotkey').value = settings.hotkey;
  $('modelPath').value = settings.modelPath || '';

  const rows = await window.api.listHistory();
  renderRows(rows);

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
