// ============================================================
// Lecture Lens - extension/content.js
// Highlight-to-Explain floating box + Article Extractor
// ============================================================

let popupContainer = null;
let shadowRoot = null;
let wrap = null;          // the positioned box inside the shadow root
let anchor = { x: 0, y: 0, top: 0 }; // viewport coords of the selection
let dragging = false;
let justDragged = false;

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// Isolated Shadow DOM host, fixed to the viewport so it always sits on top
function getOrCreatePopup() {
  if (!popupContainer) {
    popupContainer = document.createElement('div');
    popupContainer.id = 'lecture-lens-host';
    popupContainer.style.cssText =
      'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; ' +
      'overflow: visible; z-index: 2147483647; pointer-events: none;';
    // documentElement avoids being trapped inside a transformed <body>
    document.documentElement.appendChild(popupContainer);

    shadowRoot = popupContainer.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      .ll-wrap {
        position: fixed; pointer-events: auto; color-scheme: light;
        font: 14px/1.5 system-ui, -apple-system, sans-serif;
      }
      .ll-btn {
        display: inline-flex; align-items: center; gap: 6px;
        background: #2b50e6; color: #fff; border: 2px solid #fff; border-radius: 20px;
        padding: 7px 15px; font: 600 13px system-ui, sans-serif; cursor: pointer;
        box-shadow: 0 6px 20px rgba(0,0,0,0.35); transition: transform 0.1s, background 0.15s;
      }
      .ll-btn:hover { background: #1f3bb3; transform: scale(1.04); }
      .ll-card {
        width: 340px; max-width: calc(100vw - 20px);
        background: #ffffff; color: #14213d; border-radius: 12px;
        border: 2px solid #2b50e6; overflow: hidden;
        box-shadow: 0 0 0 1px rgba(255,255,255,0.9), 0 12px 40px rgba(0,0,0,0.45);
      }
      .ll-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 9px 12px; background: #2b50e6; color: #fff;
        font-weight: 700; font-size: 12px; letter-spacing: 0.05em; cursor: move; user-select: none;
      }
      .ll-close { background: none; border: none; font-size: 16px; cursor: pointer; color: #dbe4ff; line-height: 1; }
      .ll-close:hover { color: #fff; }
      .ll-body { padding: 14px; background: #ffffff; }
      .ll-term { font-weight: 700; font-size: 15px; margin-bottom: 8px; color: #0f172a; word-break: break-word; }
      .ll-content { font-size: 13px; color: #334155; white-space: pre-wrap; margin-bottom: 12px; max-height: 220px; overflow-y: auto; }
      .ll-actions { display: flex; gap: 8px; }
      .ll-action-btn {
        flex: 1; padding: 7px 10px; font-size: 12px; font-weight: 600; border-radius: 6px; cursor: pointer;
        border: 1px solid #cfd6e4; background: #f8fafc; color: #1e293b; text-align: center;
      }
      .ll-action-btn.primary { background: #2b50e6; color: #fff; border-color: #2b50e6; }
      .ll-action-btn:hover { opacity: 0.9; }
      .ll-loading { color: #64748b; font-style: italic; font-size: 13px; margin: 4px 0; }
    `;
    shadowRoot.appendChild(style);
  }
  return shadowRoot;
}

function removePopup() {
  if (popupContainer) {
    popupContainer.remove();
    popupContainer = null;
    shadowRoot = null;
    wrap = null;
  }
}

// Replace the box contents and keep it inside the viewport
function render(html) {
  const shadow = getOrCreatePopup();
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'll-wrap';
    shadow.appendChild(wrap);
  }
  wrap.innerHTML = html;
  placeBox();
  return wrap;
}

// Place below the selection, flip above if there isn't room, clamp to viewport
function placeBox() {
  if (!wrap) return;
  const margin = 10;
  const w = wrap.offsetWidth, h = wrap.offsetHeight;
  let left = Math.min(Math.max(margin, anchor.x), window.innerWidth - w - margin);
  let top = anchor.y + 8;
  if (top + h > window.innerHeight - margin) {
    top = anchor.top - h - 8;                       // flip above the selection
  }
  top = Math.min(Math.max(margin, top), window.innerHeight - h - margin);
  wrap.style.left = `${left}px`;
  wrap.style.top = `${top}px`;
}

// Let the user drag the box by its header
function enableDrag(header) {
  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.ll-close')) return;
    dragging = true;
    const startX = e.clientX, startY = e.clientY;
    const startLeft = parseFloat(wrap.style.left) || 0;
    const startTop = parseFloat(wrap.style.top) || 0;
    e.preventDefault();

    const onMove = (ev) => {
      wrap.style.left = `${startLeft + ev.clientX - startX}px`;
      wrap.style.top = `${startTop + ev.clientY - startY}px`;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
      dragging = false;
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 0);
    };
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  });
}

function cardHtml(title, term, bodyHtml, actionsHtml = '') {
  return `
    <div class="ll-card">
      <div class="ll-header" id="ll-drag">
        <span>${title}</span>
        <button class="ll-close" id="ll-close-card" title="Close">✕</button>
      </div>
      <div class="ll-body">
        ${term ? `<div class="ll-term">"${esc(term)}"</div>` : ''}
        ${bodyHtml}
        ${actionsHtml}
      </div>
    </div>
  `;
}

function wireCard(box) {
  box.querySelector('#ll-close-card').onclick = removePopup;
  enableDrag(box.querySelector('#ll-drag'));
}

// 1. In-page selection listener
document.addEventListener('mouseup', (e) => {
  if (dragging || justDragged) return;
  if (popupContainer && popupContainer.contains(e.target)) return;

  const selection = window.getSelection();
  const selectedText = selection ? selection.toString().trim() : '';

  if (!selectedText || selectedText.length < 2 || selectedText.length > 300) {
    removePopup();
    return;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  anchor = { x: rect.left, y: rect.bottom, top: rect.top };

  const box = render(`<button class="ll-btn" id="ll-explain-btn">✨ Explain</button>`);
  box.querySelector('#ll-explain-btn').addEventListener('click', () => {
    runExplanation(selectedText);
  });
});

// Dismiss on outside click or Escape
document.addEventListener('mousedown', (e) => {
  if (popupContainer && !popupContainer.contains(e.target)) removePopup();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') removePopup();
});

// 2. Fetch explanation from server proxy
async function runExplanation(term) {
  try {
    const { siteUrl = 'http://localhost:5173', native = 'Spanish', level = 'intermediate', subject = 'general' } =
      await chrome.storage.local.get({ siteUrl: 'http://localhost:5173', native: 'Spanish', level: 'intermediate', subject: 'general' });

    wireCard(render(cardHtml('LECTURE LENS', term, `<div class="ll-loading">Generating explanation...</div>`)));

    const res = await fetch(`${siteUrl.replace(/\/+$/, '')}/api/llm`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tier: 'fast',
        prompt: `Explain this term or sentence simply for a ${level} student in ${subject}: "${term}". Also provide a translation in ${native}. Keep it concise (2-3 sentences max).`
      })
    });

    const data = await res.json();
    const explanation = data.text || data.error || 'No explanation returned.';

    const box = render(cardHtml(
      'LECTURE LENS',
      term,
      `<div class="ll-content">${esc(explanation)}</div>`,
      `<div class="ll-actions">
         <button class="ll-action-btn primary" id="ll-save-btn">💾 Save Word</button>
         <button class="ll-action-btn" id="ll-review-btn">Open Review</button>
       </div>`
    ));
    wireCard(box);

    box.querySelector('#ll-save-btn').onclick = async (e) => {
      const { words = [] } = await chrome.storage.local.get({ words: [] });
      words.push({ word: term, explanation, timestamp: Date.now() });
      await chrome.storage.local.set({ words });
      e.target.textContent = '✓ Saved';
      e.target.disabled = true;
    };

    box.querySelector('#ll-review-btn').onclick = () => {
      window.open(siteUrl, '_blank');
      removePopup();
    };

  } catch (err) {
    wireCard(render(cardHtml(
      'LECTURE LENS ERROR',
      '',
      `<div class="ll-content" style="color:#dc2626;">Could not reach server. Make sure server.js is running.</div>`
    )));
  }
}

// 3. Page extractor (used by background.js for "Create Study Guide")
function extractPageText() {
  const selection = window.getSelection()?.toString().trim();
  if (selection) {
    return { title: document.title, url: window.location.href, text: selection.slice(0, 15000) };
  }

  const clone = document.body.cloneNode(true);
  const unwanted = clone.querySelectorAll(
    'script, style, noscript, nav, footer, header, aside, svg, iframe, form, [role="navigation"], [role="banner"], [role="complementary"], .ad, .advertisement'
  );
  unwanted.forEach(el => el.remove());

  const mainContent = clone.querySelector('article') || clone.querySelector('main') || clone.querySelector('[role="main"]') || clone;
  const text = (mainContent.innerText || '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 25)
    .join('\n\n');

  return { title: document.title, url: window.location.href, text: text.slice(0, 15000) };
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === 'extract_page') {
    sendResponse(extractPageText());
  }
});