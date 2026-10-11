let host = null;
let root = null;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function ensureHost() {
  if (host) return root;
  host = document.createElement('div');
  host.style.cssText = 'all: initial; position: fixed; top: 0; left: 0; z-index: 2147483647;';
  document.documentElement.appendChild(host);
  root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      .wrap { position: fixed; font: 14px/1.5 system-ui, sans-serif; }
      .btn {
        background: #2563eb; color: #fff; border: 0; border-radius: 999px;
        padding: 6px 14px; font: 600 13px system-ui, sans-serif; cursor: pointer;
        box-shadow: 0 4px 14px rgba(0,0,0,.25);
      }
      .btn:hover { background: #1d4ed8; }
      .card {
        width: 320px; background: #fff; color: #0f172a; border: 1px solid #cbd5e1;
        border-radius: 10px; padding: 12px; box-shadow: 0 10px 30px rgba(0,0,0,.25);
      }
      .label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #2563eb; margin-top: 8px; }
      .text { white-space: pre-wrap; font-size: 13px; color: #334155; }
      .error { color: #dc2626; }
    </style>
    <div class="wrap"></div>
  `;
  return root;
}

function removeHost() {
  host?.remove();
  host = null;
  root = null;
}

function show(html, x, y) {
  const wrap = ensureHost().querySelector('.wrap');
  wrap.innerHTML = html;
  const maxX = window.innerWidth - wrap.offsetWidth - 8;
  const maxY = window.innerHeight - wrap.offsetHeight - 8;
  wrap.style.left = `${Math.max(8, Math.min(x, maxX))}px`;
  wrap.style.top = `${Math.max(8, Math.min(y, maxY))}px`;
  return wrap;
}

document.addEventListener('mouseup', (e) => {
  if (host && e.composedPath().includes(host)) return;

  const text = window.getSelection()?.toString().trim() || '';
  if (text.length < 2) {
    removeHost();
    return;
  }

  const x = e.clientX + 8;
  const y = e.clientY + 12;
  const wrap = show('<button class="btn">Bridge</button>', x, y);

  wrap.querySelector('.btn').addEventListener('click', async () => {
    show('<div class="card"><div class="text">Working…</div></div>', x, y);
    const res = await chrome.runtime.sendMessage({ action: 'process', text, source: 'highlight' })
      .catch((err) => ({ ok: false, error: err.message }));

    if (!res?.ok) {
      show(`<div class="card"><div class="text error">${esc(res?.error || 'Could not reach the Bridge proxy.')}</div></div>`, x, y);
      return;
    }
    show(`
      <div class="card">
        <div class="label">Explain like I'm 5</div>
        <div class="text">${esc(res.data.eli5)}</div>
        <div class="label">Notes</div>
        <div class="text">${esc(res.data.notes)}</div>
      </div>
    `, x, y);
  });
});

document.addEventListener('mousedown', (e) => {
  if (host && !e.composedPath().includes(host)) removeHost();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') removeHost();
});
