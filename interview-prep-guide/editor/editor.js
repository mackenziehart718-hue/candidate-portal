let previewMode = sessionStorage.getItem('prep-editor-preview-mode') || 'desktop';

const $ = (sel) => document.querySelector(sel);
const preview = $('#preview');
const statusEl = $('#status');

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) return res.json();
  return res.text();
}

function setPreviewMode(mode) {
  previewMode = mode === 'mobile' ? 'mobile' : 'desktop';
  sessionStorage.setItem('prep-editor-preview-mode', previewMode);
  const panel = $('#preview-panel');
  panel?.classList.toggle('mobile', previewMode === 'mobile');
  document.querySelectorAll('.preview-mode-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.previewMode === previewMode);
  });
}

function initPreviewModeToggle() {
  setPreviewMode(previewMode);
  document.querySelectorAll('.preview-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => setPreviewMode(btn.dataset.previewMode));
  });
}

function refreshPreview() {
  preview.src = `/index.html?t=${Date.now()}`;
  setStatus('Preview refreshed', 'ok');
}

$('#btn-rebuild').addEventListener('click', async () => {
  try {
    await api('/api/build', { method: 'POST' });
    setStatus('All HTML rebuilt', 'ok');
    refreshPreview();
  } catch (e) {
    setStatus(e.message, 'err');
  }
});
$('#btn-refresh-preview').addEventListener('click', refreshPreview);

initPreviewModeToggle();
refreshPreview();
