// ============================================================
// Lecture Lens - extension/content.js
// Two ways to capture (both work out what you need automatically):
//   - Highlight text -> the card opens by itself (can be turned off)
//   - Snip tool: Alt+Shift+S (auto) / Alt+Shift+Q (force solve), drag over any area
// The card picks its mode for you:
//   - Translate: your language is auto-detected; text is translated + explained simply
//   - Solve: problems are solved step by step, in your language
// Either tab can still be chosen by hand.
// ============================================================

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Chinese (Simplified)',
  'Chinese (Traditional)', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Russian',
  'Vietnamese', 'Turkish', 'Indonesian', 'Tagalog', 'Polish', 'Dutch'
];

// ---------- Native language auto-detection ----------
// Browsers do not expose the OS keyboard layout directly, so we combine what they do expose:
//   1. the browser's display language and preferred-language list (follows your OS/Chrome settings)
//   2. the active keyboard layout's letters, when the browser allows reading them (Chrome, secure pages)
//      used only when the browser language is English but the keyboard types another script.
const LANG_BY_CODE = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian', pt: 'Portuguese',
  ja: 'Japanese', ko: 'Korean', ar: 'Arabic', hi: 'Hindi', ru: 'Russian', vi: 'Vietnamese',
  tr: 'Turkish', id: 'Indonesian', tl: 'Tagalog', fil: 'Tagalog', pl: 'Polish', nl: 'Dutch'
};
const SCRIPT_LANG = [
  [/\p{Script=Cyrillic}/u, 'Russian'], [/\p{Script=Arabic}/u, 'Arabic'], [/\p{Script=Hangul}/u, 'Korean'],
  [/\p{Script=Devanagari}/u, 'Hindi'], [/\p{Script=Greek}/u, 'Greek'], [/\p{Script=Hebrew}/u, 'Hebrew'],
  [/\p{Script=Thai}/u, 'Thai']
];
let detectedLangCache = null;

function langFromTag(tag) {
  if (!tag) return null;
  const parts = String(tag).toLowerCase().split('-');
  const base = parts[0];
  if (base === 'zh') return /hant|tw|hk|mo/.test(parts.slice(1).join('-')) ? 'Chinese (Traditional)' : 'Chinese (Simplified)';
  if (LANG_BY_CODE[base]) return LANG_BY_CODE[base];
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'language' }).of(base);
    if (name && name.toLowerCase() !== base) return name;
  } catch (_) { /* ignore */ }
  return null;
}

async function keyboardLanguage() {
  try {
    if (!navigator.keyboard || !navigator.keyboard.getLayoutMap) return null;
    const map = await Promise.race([navigator.keyboard.getLayoutMap(), new Promise(r => setTimeout(() => r(null), 250))]);
    if (!map) return null;
    const letters = ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY'].map(k => map.get(k) || '').join('');
    for (const [re, name] of SCRIPT_LANG) if (re.test(letters)) return name;
  } catch (_) { /* not available on this page */ }
  return null;
}

async function detectNativeLanguage() {
  if (detectedLangCache) return detectedLangCache;
  const ui = (chrome.i18n && chrome.i18n.getUILanguage && chrome.i18n.getUILanguage()) || navigator.language;
  let lang = langFromTag(ui) || langFromTag((navigator.languages || [])[0]) || 'English';
  if (lang === 'English') {
    const kb = await keyboardLanguage();
    if (kb) lang = kb;
  }
  detectedLangCache = lang;
  return lang;
}

// Quick local guess: is this a maths or computation problem (equations, arithmetic, "calculate...")?
// Ordinary questions, definitions and general homework are NOT treated as problems.
// Anything this misses is still checked by the AI, which uses the same rule.
function looksLikeProblem(text) {
  const s = String(text || '').trim();
  if (s.length < 4 || !/\d/.test(s)) return false;
  const expr = /\d\s*[=+×÷*^]\s*[\d(a-z]|\d\s+[-−\/]\s+\d|\b[a-z]\s*=\s*[-\d]|\d\s*[a-z]\s*[=+\-−]|\b[a-z]\^\d|\d\s*\/\s*\d+\s*[+\-−×÷*]|[√∑∫]|\d\s*%\s*of\s*\d/i;
  const cue = /\b(solve|calculate|compute|evaluate|simplify|factori[sz]e|derive|differentiate|integrate|expand|probability|how many|how much|find the (value|sum|product|area|volume|perimeter|slope|mean|median|average|derivative|integral|length|angle|speed|force|mass))\b/i;
  return expr.test(s) || cue.test(s);
}

let popupContainer = null;
let shadowRoot = null;
let wrap = null;          // the positioned box inside the shadow root
let anchor = { x: 0, y: 0, top: 0 }; // viewport coords of the selection
let dragging = false;
let justDragged = false;
let snipHost = null;
let snipActive = false;

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function langOptions(current, autoName = null) {
  const list = LANGUAGES.includes(current) ? LANGUAGES : [current, ...LANGUAGES];
  const auto = autoName ? `<option value="__auto__"${autoName ? ' selected' : ''}>Auto-detect (${esc(autoName)})</option>` : '';
  return auto + list.map(l => `<option value="${esc(l)}"${!autoName && l === current ? ' selected' : ''}>${esc(l)}</option>`).join('');
}

// ---------- Floating result box (Shadow DOM, fixed to viewport) ----------

function getOrCreatePopup() {
  if (!popupContainer) {
    popupContainer = document.createElement('div');
    popupContainer.id = 'lecture-lens-host';
    popupContainer.style.cssText =
      'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; ' +
      'overflow: visible; z-index: 2147483647; pointer-events: none;';
    document.documentElement.appendChild(popupContainer);

    shadowRoot = popupContainer.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      .ll-wrap {
        position: fixed; pointer-events: auto; color-scheme: light;
        font: 14px/1.5 system-ui, -apple-system, sans-serif;
      }
      .ll-btnrow { display: flex; gap: 6px; }
      .ll-btn {
        display: inline-flex; align-items: center; gap: 6px;
        background: #2b50e6; color: #fff; border: 2px solid #fff; border-radius: 20px;
        padding: 7px 15px; font: 600 13px system-ui, sans-serif; cursor: pointer;
        box-shadow: 0 6px 20px rgba(0,0,0,0.35); transition: transform 0.1s, background 0.15s;
      }
      .ll-btn:hover { background: #1f3bb3; transform: scale(1.04); }
      .ll-btn.alt { background: #0f766e; }
      .ll-btn.alt:hover { background: #0b5a54; }
      .ll-card {
        width: 380px; max-width: calc(100vw - 20px);
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
      .ll-body { padding: 14px; background: #ffffff; max-height: 75vh; overflow-y: auto; }
      .ll-label { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #64748b; margin: 0 0 4px; }
      .ll-quote {
        font-weight: 600; font-size: 14px; color: #0f172a; word-break: break-word;
        background: #f1f5f9; border-left: 3px solid #94a3b8; border-radius: 4px;
        padding: 6px 9px; margin-bottom: 12px; max-height: 150px; overflow-y: auto;
      }
      .ll-thumb { display: block; max-width: 100%; max-height: 130px; border-radius: 3px; }
      .ll-original {
        font-weight: 500; background: #f8fafc; border: 1px solid #e2e8f0;
        border-radius: 6px; padding: 6px 9px; max-height: 100px; overflow-y: auto;
      }
      .ll-tabs { display: flex; gap: 6px; margin-bottom: 12px; }
      .ll-tabs[hidden] { display: none; }
      .ll-tab {
        flex: 1; padding: 6px 8px; font: 600 12px system-ui, sans-serif; cursor: pointer;
        border: 1px solid #cfd6e4; background: #f8fafc; color: #1e293b; border-radius: 6px;
      }
      .ll-tab.active { background: #2b50e6; color: #fff; border-color: #2b50e6; }
      .ll-pane[hidden] { display: none; }
      .ll-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
      .ll-select {
        flex: 1; max-width: 200px; padding: 5px 8px; font: 600 12px system-ui, sans-serif;
        border: 1px solid #cfd6e4; border-radius: 6px; background: #f8fafc; color: #1e293b; cursor: pointer;
      }
      .ll-result { font-size: 13px; color: #334155; white-space: pre-wrap; margin-bottom: 12px; word-break: break-word; }
      .ll-translation { font-size: 15px; font-weight: 700; color: #1e3a8a; background: #eef2ff; border-radius: 6px; padding: 8px 10px; }
      .ll-answer { font-size: 15px; font-weight: 700; color: #14532d; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 8px 10px; }
      .ll-steps { margin: 0 0 12px; padding-left: 22px; font-size: 13px; color: #334155; }
      .ll-steps li { margin-bottom: 7px; word-break: break-word; }
      .ll-tip { font-size: 12px; color: #78350f; background: #fffbeb; border-radius: 6px; padding: 6px 9px; margin-bottom: 12px; }
      .ll-tip[hidden] { display: none; }
      .ll-ask { display: flex; gap: 6px; margin-bottom: 8px; }
      .ll-input {
        flex: 1; min-width: 0; padding: 6px 8px; font: 13px system-ui, sans-serif;
        border: 1px solid #cfd6e4; border-radius: 6px; color: #14213d; background: #fff;
      }
      .ll-thread .q { font-weight: 700; font-size: 12px; color: #1e3a8a; margin-top: 8px; word-break: break-word; }
      .ll-thread .a { font-size: 13px; color: #334155; white-space: pre-wrap; margin-bottom: 6px; word-break: break-word; }
      .ll-note { font-size: 11px; color: #94a3b8; margin: 4px 0 12px; }
      .ll-error { color: #dc2626 !important; }
      .ll-loading { color: #64748b; font-style: italic; font-weight: 400; }
      .ll-detect { font-size: 12px; color: #1e3a8a; background: #eef2ff; border-radius: 6px; padding: 5px 9px; margin-bottom: 10px; }
      .ll-detect[hidden] { display: none; }
      .ll-link { background: none; border: 0; padding: 0; margin-top: 8px; font: 11px system-ui, sans-serif; color: #64748b; text-decoration: underline; cursor: pointer; }
      .ll-actions { display: flex; gap: 8px; }
      .ll-action-btn {
        flex: 1; padding: 7px 10px; font-size: 12px; font-weight: 600; border-radius: 6px; cursor: pointer;
        border: 1px solid #cfd6e4; background: #f8fafc; color: #1e293b; text-align: center;
      }
      .ll-action-btn.primary { background: #2b50e6; color: #fff; border-color: #2b50e6; }
      .ll-action-btn:hover:not(:disabled) { opacity: 0.9; }
      .ll-action-btn:disabled { opacity: 0.5; cursor: default; }
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

// Below the selection, flip above if there isn't room, clamp to viewport
function placeBox() {
  if (!wrap) return;
  const margin = 10;
  const w = wrap.offsetWidth, h = wrap.offsetHeight;
  let left = Math.min(Math.max(margin, anchor.x), window.innerWidth - w - margin);
  let top = anchor.y + 8;
  if (top + h > window.innerHeight - margin) top = anchor.top - h - 8;
  top = Math.min(Math.max(margin, top), window.innerHeight - h - margin);
  wrap.style.left = `${left}px`;
  wrap.style.top = `${top}px`;
}

// Keep the box on screen after content changes, without undoing a drag
function clampBox() {
  if (!wrap) return;
  const margin = 10;
  const w = wrap.offsetWidth, h = wrap.offsetHeight;
  const left = Math.min(Math.max(margin, parseFloat(wrap.style.left) || 0), window.innerWidth - w - margin);
  const top = Math.min(Math.max(margin, parseFloat(wrap.style.top) || 0), window.innerHeight - h - margin);
  wrap.style.left = `${left}px`;
  wrap.style.top = `${top}px`;
}

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

function cardHtml(title, bodyHtml) {
  return `
    <div class="ll-card">
      <div class="ll-header" id="ll-drag">
        <span>${title}</span>
        <button class="ll-close" id="ll-close-card" title="Close">✕</button>
      </div>
      <div class="ll-body">${bodyHtml}</div>
    </div>
  `;
}

function wireCard(box) {
  box.querySelector('#ll-close-card').onclick = removePopup;
  enableDrag(box.querySelector('#ll-drag'));
}

function showError(msg) {
  wireCard(render(cardHtml('LECTURE LENS ERROR', `<div class="ll-result ll-error">${esc(msg)}</div>`)));
}

// ---------- 1. Text selection -> Explain / Solve buttons ----------

let selTimer = null;
document.addEventListener('mouseup', (e) => {
  if (dragging || justDragged || snipActive) return;
  if (popupContainer && popupContainer.contains(e.target)) return;
  if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;

  const selection = window.getSelection();
  const selectedText = selection ? selection.toString().trim() : '';
  const hasCjk = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(selectedText);

  clearTimeout(selTimer);
  if (!selectedText || (selectedText.length < 2 && !hasCjk) || selectedText.length > 600 || !selection.rangeCount) {
    removePopup();
    return;
  }

  const rect = selection.getRangeAt(0).getBoundingClientRect();
  anchor = { x: rect.left, y: rect.bottom, top: rect.top };

  // Short pause so double/triple clicks settle, then open the card by itself
  selTimer = setTimeout(async () => {
    if (window.getSelection().toString().trim() !== selectedText) return;
    let autoExplain = true;
    try { ({ autoExplain } = await chrome.storage.local.get({ autoExplain: true })); } catch (_) { return; }

    if (autoExplain) { openCard({ term: selectedText, mode: 'auto' }); return; }

    const box = render(`
      <div class="ll-btnrow">
        <button class="ll-btn" id="ll-explain-btn">✨ Explain</button>
        ${looksLikeProblem(selectedText) ? '<button class="ll-btn alt" id="ll-solve-btn">🧮 Solve</button>' : ''}
        <button class="ll-btn" id="ll-auto-on" title="Open the explanation automatically whenever I highlight text">⚡ Auto</button>
      </div>
    `);
    box.querySelector('#ll-explain-btn').addEventListener('click', () => openCard({ term: selectedText, mode: 'auto' }));
    const solveBtn = box.querySelector('#ll-solve-btn');
    if (solveBtn) solveBtn.addEventListener('click', () => openCard({ term: selectedText, mode: 'solve' }));
    box.querySelector('#ll-auto-on').addEventListener('click', async () => {
      await chrome.storage.local.set({ autoExplain: true });
      openCard({ term: selectedText, mode: 'auto' });
    });
  }, 220);
});

document.addEventListener('mousedown', (e) => {
  if (popupContainer && !popupContainer.contains(e.target)) removePopup();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') removePopup();
});

// ---------- 2. Snip tool (screenshot highlighter) ----------

function cancelSnip() {
  if (snipHost) { snipHost.remove(); snipHost = null; }
  window.removeEventListener('keydown', onSnipKey, true);
}

function onSnipKey(e) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    cancelSnip();
    setTimeout(() => { snipActive = false; }, 0);
  }
}

function startSnip(mode = 'auto') {
  removePopup();
  cancelSnip();
  snipActive = true;

  const hint = mode === 'solve'
    ? 'Drag over the problem to solve'
    : 'Drag over any text, image or problem';

  snipHost = document.createElement('div');
  snipHost.style.cssText =
    'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; overflow: visible; z-index: 2147483647;';
  document.documentElement.appendChild(snipHost);
  const root = snipHost.attachShadow({ mode: 'open' });
  root.innerHTML = `
    <style>
      .shade { position: fixed; inset: 0; background: rgba(15,23,42,0.12); cursor: crosshair; }
      .hint {
        position: fixed; top: 14px; left: 50%; transform: translateX(-50%);
        background: #14213d; color: #fff; font: 600 13px system-ui, sans-serif;
        padding: 8px 16px; border-radius: 20px; box-shadow: 0 6px 20px rgba(0,0,0,0.35); pointer-events: none;
      }
      .box {
        position: fixed; display: none; pointer-events: none;
        background: rgba(255,235,59,0.38); border: 2px solid #f5c400; border-radius: 3px;
        box-shadow: 0 0 0 100vmax rgba(15,23,42,0.28);
      }
    </style>
    <div class="shade"></div>
    <div class="hint">${hint} &nbsp;·&nbsp; Esc to cancel</div>
    <div class="box"></div>
  `;
  const shade = root.querySelector('.shade');
  const box = root.querySelector('.box');
  window.addEventListener('keydown', onSnipKey, true);

  const rectFrom = (a, b) => ({
    x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y)
  });

  shade.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const start = { x: e.clientX, y: e.clientY };
    box.style.display = 'block';

    const draw = (ev) => {
      const r = rectFrom(start, { x: ev.clientX, y: ev.clientY });
      box.style.left = `${r.x}px`; box.style.top = `${r.y}px`;
      box.style.width = `${r.w}px`; box.style.height = `${r.h}px`;
    };
    const up = (ev) => {
      window.removeEventListener('mousemove', draw, true);
      window.removeEventListener('mouseup', up, true);
      const r = rectFrom(start, { x: ev.clientX, y: ev.clientY });
      if (r.w < 12 || r.h < 12) {
        cancelSnip();
        setTimeout(() => { snipActive = false; }, 0);
        return;
      }
      finishSnip(r, mode);
    };
    window.addEventListener('mousemove', draw, true);
    window.addEventListener('mouseup', up, true);
    draw(e);
  });
}

async function finishSnip(r, mode) {
  cancelSnip();                                   // overlay must be gone before the screenshot
  setTimeout(() => { snipActive = false; }, 0);
  await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
  await new Promise(res => setTimeout(res, 80));

  anchor = { x: r.x, y: r.y + r.h, top: r.y };
  try {
    const resp = await chrome.runtime.sendMessage({
      type: 'capture_region', rect: r, viewportWidth: window.innerWidth
    });
    if (!resp || !resp.ok) {
      throw new Error(resp?.error || 'Could not capture the screen. Check that the background code and the "activeTab" permission were added.');
    }
    openCard({ image: { base64: resp.base64, media_type: resp.media_type }, mode });
  } catch (e) {
    const msg = /context invalidated/i.test(e.message)
      ? 'The extension was reloaded. Refresh this page and try again.' : e.message;
    showError(msg);
  }
}

// ---------- 3. Talking to the server ----------

// Requests go through the background script (no per-site Chrome prompt)
async function callLLM(siteUrl, payload) {
  let resp;
  try {
    resp = await chrome.runtime.sendMessage({ type: 'llm', url: `${siteUrl}/api/llm`, payload });
  } catch (e) {
    if (/context invalidated/i.test(e.message)) {
      throw new Error('The extension was reloaded. Refresh this page and try again.');
    }
    throw new Error('Could not talk to the extension background script. Make sure background.js was updated.');
  }
  if (!resp) throw new Error('No response from the background script. Make sure background.js was updated.');
  return resp;
}

async function runLLM(siteUrl, payload) {
  const resp = await callLLM(siteUrl, payload);
  if (resp.networkError) throw new TypeError('network');
  const data = resp.data || {};
  if (!resp.ok || data.error) throw new Error(data.error || 'The server returned an error.');
  return data.text || '';
}

function friendlyError(err) {
  return err instanceof TypeError
    ? 'Could not reach server. Make sure server.js is running.'
    : err.message;
}

function extractJson(text) {
  const cleaned = String(text).replace(/```json|```/g, '');
  return JSON.parse(cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1));
}

// Translate mode: {original, translation, simple}
function parseResult(text) {
  try {
    const obj = extractJson(text);
    const same = obj.same_language === true;
    if ((obj.translation || same) && obj.simple) {
      return {
        original: obj.original ? String(obj.original) : '',
        translation: obj.translation ? String(obj.translation) : '',
        simple: String(obj.simple),
        source_language: obj.source_language ? String(obj.source_language) : '',
        same_language: same,
        is_problem: obj.is_problem === true
      };
    }
  } catch (_) { /* fall through */ }
  return null;
}

// Solve mode: {problem, answer, steps[], tip}
function parseSolve(text) {
  try {
    const obj = extractJson(text);
    let steps = obj.steps;
    if (typeof steps === 'string') steps = steps.split(/\n+/).filter(Boolean);
    if (obj.solvable === false) return { solvable: false, problem: '', answer: '', steps: [], tip: '' };
    if (obj.answer && Array.isArray(steps) && steps.length) {
      return {
        solvable: true,
        problem: obj.problem ? String(obj.problem) : '',
        answer: String(obj.answer),
        steps: steps.map(String),
        tip: obj.tip ? String(obj.tip) : ''
      };
    }
  } catch (_) { /* fall through */ }
  return null;
}

const JSON_SYSTEM = 'You are a translator and a friendly tutor. Reply with ONLY one JSON object. No markdown, no code fences, no extra text.';
const SOLVE_SYSTEM = 'You are a patient, friendly tutor. Always get the answer right, then teach it clearly. Reply with ONLY one JSON object. No markdown, no code fences, no extra text. Write math in plain text (for example x^2, sqrt(16), 3/4) and never use LaTeX.';
const FOLLOWUP_SYSTEM = 'You are a patient, friendly tutor helping a student. Answer their question clearly and kindly in a short reply. Plain text only: no markdown, no LaTeX; write math like x^2, sqrt(16), 3/4.';

// ---------- 4. Result card (text or snipped image; Translate or Solve) ----------

async function openCard({ term = null, image = null, mode = 'auto' }) {
  const settings = await chrome.storage.local.get({
    siteUrl: 'http://localhost:5173', native: null, nativeAuto: null, solveLang: null, subject: 'general'
  });
  const siteUrl = settings.siteUrl.replace(/\/+$/, '');

  // Your language: detected automatically unless you picked one by hand
  const detected = await detectNativeLanguage();
  const autoNative = settings.native == null || settings.nativeAuto === true;
  let lang = autoNative ? detected : settings.native;               // translate target
  if (autoNative && settings.native !== detected) chrome.storage.local.set({ native: detected, nativeAuto: true });
  let solveManual = !!settings.solveLang;                           // otherwise solutions follow your language
  let solveLang = settings.solveLang || lang;                       // language the solution is explained in

  // Work out what the person needs: a clear problem goes straight to Solve, everything else starts as Translate
  const autoMode = mode === 'auto';
  if (autoMode) mode = (term && looksLikeProblem(term)) ? 'solve' : 'translate';
  let userPicked = !autoMode;

  const highlightedHtml = image
    ? `<div class="ll-label">You highlighted</div>
       <div class="ll-quote"><img class="ll-thumb" alt="Highlighted area" src="data:${image.media_type};base64,${image.base64}"></div>`
    : `<div class="ll-label">You highlighted</div>
       <div class="ll-quote">${esc(term)}</div>`;

  const box = render(cardHtml('LECTURE LENS', `
    ${highlightedHtml}
    <div class="ll-detect" id="ll-detect" hidden></div>

    <div class="ll-tabs" id="ll-tabs">
      <button class="ll-tab" data-mode="translate">🌐 Translate</button>
      <button class="ll-tab" data-mode="solve">🧮 Solve</button>
    </div>

    <div class="ll-pane" id="ll-pane-translate">
      ${image ? `<div class="ll-label">Text found</div><div class="ll-result ll-original" id="ll-original"></div>` : ''}
      <div class="ll-row">
        <span class="ll-label" style="margin:0">Your language</span>
        <select class="ll-select" id="ll-lang">${langOptions(lang, autoNative ? detected : null)}</select>
      </div>
      <div class="ll-label" id="ll-trans-label">Translation</div>
      <div class="ll-result ll-translation" id="ll-translation"></div>
      <div class="ll-label">Simple explanation (like you're 5)</div>
      <div class="ll-result" id="ll-simple"></div>
    </div>

    <div class="ll-pane" id="ll-pane-solve" hidden>
      <div class="ll-row">
        <span class="ll-label" style="margin:0">Explain in</span>
        <select class="ll-select" id="ll-solve-lang">${langOptions(solveLang)}</select>
      </div>
      <div class="ll-label">Problem</div>
      <div class="ll-result ll-original" id="ll-problem"></div>
      <div class="ll-label">Answer</div>
      <div class="ll-result ll-answer" id="ll-answer"></div>
      <div class="ll-label">Step by step</div>
      <ol class="ll-steps" id="ll-steps"></ol>
      <div class="ll-tip" id="ll-tip" hidden></div>
      <div class="ll-label">Ask a follow-up</div>
      <div class="ll-ask">
        <input class="ll-input" id="ll-ask-input" type="text" placeholder="e.g. Why did we do that step?">
        <button class="ll-action-btn primary" id="ll-ask-btn" style="flex:none" disabled>Ask</button>
      </div>
      <div class="ll-thread" id="ll-thread"></div>
      <div class="ll-note">AI can make mistakes. Double-check important answers.</div>
    </div>

    <div class="ll-row" style="margin-top:10px">
      <span class="ll-label" style="margin:0">Topic</span>
      <input class="ll-input" id="ll-topic" list="ll-topic-list" maxlength="40" placeholder="e.g. Japanese, Calculus">
      <datalist id="ll-topic-list"></datalist>
    </div>
    <div class="ll-actions">
      <button class="ll-action-btn primary" id="ll-save-btn" disabled>💾 Save Word</button>
      <button class="ll-action-btn" id="ll-quiz-btn">📝 Quiz</button>
    </div>
    ${image ? '' : '<button class="ll-link" id="ll-auto-off">Stop opening automatically when I highlight text</button>'}
  `));
  wireCard(box);

  const $ = (id) => box.querySelector(id);
  const tabs = [...box.querySelectorAll('.ll-tab')];
  const paneT = $('#ll-pane-translate'), paneS = $('#ll-pane-solve');
  const saveBtn = $('#ll-save-btn');

  // translate pane
  const tEl = $('#ll-translation'), sEl = $('#ll-simple'), oEl = $('#ll-original');
  const detectEl = $('#ll-detect'), transLabel = $('#ll-trans-label'), tabsEl = $('#ll-tabs');
  // The Solve tab only appears for maths / computation problems (or when you asked to solve)
  tabsEl.hidden = autoMode && mode !== 'solve';
  const showDetect = (msg) => { detectEl.textContent = msg || ''; detectEl.hidden = !msg; clampBox(); };
  const langSel = $('#ll-lang');
  // solve pane
  const pEl = $('#ll-problem'), aEl = $('#ll-answer'), stEl = $('#ll-steps'), tipEl = $('#ll-tip');
  const solveSel = $('#ll-solve-lang'), askInput = $('#ll-ask-input'), askBtn = $('#ll-ask-btn'), threadEl = $('#ll-thread');

  const LOADING = '<span class="ll-loading">Working on it...</span>';
  const subjectHint = settings.subject && settings.subject !== 'general'
    ? `\nThe subject area is: ${settings.subject}.` : '';

  let currentMode = mode;
  const started = { translate: false, solve: false };
  const saved = { translate: false, solve: false };
  let tReq = 0, sReq = 0;
  let current = null;        // translate result
  let solution = null;       // solve result
  let sourceText = term;     // translate: for images, filled in after the first read
  let history = [];          // follow-up Q&A

  function updateSave() {
    saveBtn.textContent = saved[currentMode] ? '✓ Saved' : (currentMode === 'solve' ? '💾 Save Solution' : '💾 Save Word');
    const ready = currentMode === 'solve' ? !!solution : !!current;
    saveBtn.disabled = saved[currentMode] || !ready;
  }

  // ----- Translate -----
  async function loadTranslate() {
    const id = ++tReq;
    current = null;
    saved.translate = false;
    tEl.classList.remove('ll-error');
    tEl.hidden = false; transLabel.hidden = false;
    tEl.innerHTML = LOADING;
    sEl.innerHTML = LOADING;
    if (oEl && !sourceText) oEl.innerHTML = LOADING;
    updateSave();
    clampBox();

    const simpleRule =
      `"simple": an explanation of what the text means, written in ${lang}, as if you were explaining it to a five-year-old. Use very simple words and short sentences (1 to 3 sentences). If it is a single word, explain the word. If it is a sentence or passage, explain what it is saying.`;
    const detectRules =
      `"source_language": the language the text is written in, as an English name such as "Japanese".
"same_language": true if the text is already written in ${lang}, otherwise false.
"is_problem": true ONLY if the text is a maths problem or something that needs computation to answer (arithmetic, algebra, geometry, calculus, statistics, or a physics or chemistry calculation). false for everything else, including ordinary words, sentences and passages, definitions, opinion or essay questions, history or reading questions, and general quiz questions that need no calculation.`;
    const useImage = !!image && !sourceText;
    const payload = {
      tier: useImage ? 'smart' : 'fast',
      max_tokens: 900,
      system: JSON_SYSTEM,
      prompt: useImage
        ? `This image is a screenshot of part of a document or web page.${subjectHint}
Read the text in it, whatever language it is written in.

Return a JSON object with exactly these keys:
"original": the text in the image, transcribed as accurately as you can.
${detectRules}
"translation": that text translated directly and naturally into ${lang}. If same_language is true, set this to "". Output only the translation, nothing else.
${simpleRule}
If the image shows a picture or diagram with little or no text, describe what it shows in "simple" and set "translation" to "".
If there is nothing readable or recognisable at all, set "original" to "", "translation" to "(nothing readable found)", and "simple" to a short note saying so.`
        : `Text: "${sourceText}"${subjectHint}

Return a JSON object with exactly these keys:
${detectRules}
"translation": the text translated directly and naturally into ${lang}. If same_language is true, set this to "". Output only the translation, nothing else.
${simpleRule}`
    };
    if (useImage) payload.image = image;

    try {
      const text = await runLLM(siteUrl, payload);
      if (id !== tReq) return;
      const parsed = parseResult(text);
      if (parsed) {
        const same = parsed.same_language && !parsed.translation;
        tEl.hidden = same; transLabel.hidden = same;          // already in your language: skip the translation box
        tEl.textContent = parsed.translation;
        sEl.textContent = parsed.simple;
        if (oEl && useImage) {
          oEl.textContent = parsed.original || '(none)';
          if (parsed.original) sourceText = parsed.original;
        }
        current = parsed;
        if (parsed.is_problem) tabsEl.hidden = false;           // a solvable problem: offer the Solve tab
        else if (autoMode && !userPicked) tabsEl.hidden = true;  // nothing to solve: no Solve tab
        if (autoMode && !userPicked && parsed.is_problem) {   // it is a problem to solve, so solve it
          showDetect('This looks like a maths problem, so I\'m solving it step by step.');
          setMode('solve');
          return;
        }
        if (parsed.same_language) showDetect(`Already in ${lang}, so here is a plain explanation.`);
        else if (parsed.source_language) showDetect(`Detected ${parsed.source_language}, translated to ${lang}.`);
        else showDetect('');
      } else {
        tEl.textContent = '—';
        sEl.textContent = text || 'No explanation returned.';
        if (oEl && useImage) oEl.textContent = '(none)';
        current = { original: '', translation: '', simple: text || '' };
      }
    } catch (err) {
      if (id !== tReq) return;
      tEl.classList.add('ll-error');
      tEl.textContent = friendlyError(err);
      sEl.textContent = '';
      if (oEl && !sourceText) oEl.textContent = '';
    }
    updateSave();
    clampBox();
  }

  // ----- Solve -----
  async function loadSolve() {
    const id = ++sReq;
    solution = null;
    history = [];
    saved.solve = false;
    aEl.classList.remove('ll-error');
    pEl.innerHTML = LOADING;
    aEl.innerHTML = LOADING;
    stEl.innerHTML = `<li>${LOADING}</li>`;
    tipEl.hidden = true;
    threadEl.innerHTML = '';
    askBtn.disabled = true;
    updateSave();
    clampBox();

    const rules =
      `Return a JSON object with exactly these keys:
"solvable": true only if this is a maths problem or something that needs computation and you can solve it. false for anything else (the other keys may then be empty).
"problem": the problem or question restated clearly in one or two sentences. If there are several questions, solve the first one fully and say so here.
"answer": the final answer, short.
"steps": an array of 2 to 8 strings. Each string is one step: say what to do and why, in simple words, so a student seeing this for the first time can follow it.
"tip": one short sentence about the idea to remember for similar problems.
Write every value in ${solveLang}.
If it is not a maths or computation problem, set "solvable" to false.`;

    const payload = {
      tier: 'smart',
      max_tokens: 2000,
      system: SOLVE_SYSTEM,
      prompt: image
        ? `This image is a screenshot of a problem or question the student needs help with.${subjectHint}
Read it carefully (including any numbers, diagrams, or tables), solve it correctly, and explain it.

${rules}`
        : `The student highlighted this problem or question: "${term}"${subjectHint}
Solve it correctly and explain it.

${rules}`
    };
    if (image) payload.image = image;

    try {
      const text = await runLLM(siteUrl, payload);
      if (id !== sReq) return;
      const parsed = parseSolve(text);
      if (parsed && parsed.solvable === false && autoMode && !userPicked) {   // not actually a problem: explain it instead
        tabsEl.hidden = true;
        showDetect('');
        started.translate = false;
        setMode('translate');
        return;
      }
      solution = parsed || { problem: '', answer: '—', steps: [text || 'No solution returned.'], tip: '' };

      pEl.textContent = solution.problem || term || '(see the highlighted area)';
      aEl.textContent = solution.answer;
      stEl.innerHTML = '';
      for (const s of solution.steps) {
        const li = document.createElement('li');
        li.textContent = s;
        stEl.appendChild(li);
      }
      if (solution.tip) { tipEl.textContent = `💡 ${solution.tip}`; tipEl.hidden = false; }
      askBtn.disabled = false;
    } catch (err) {
      if (id !== sReq) return;
      aEl.classList.add('ll-error');
      aEl.textContent = friendlyError(err);
      pEl.textContent = '';
      stEl.innerHTML = '';
    }
    updateSave();
    clampBox();
  }

  // ----- Follow-up questions -----
  async function ask() {
    const q = askInput.value.trim();
    if (!q || !solution) return;
    askInput.value = '';
    askBtn.disabled = true;

    const qEl = document.createElement('div');
    qEl.className = 'q';
    qEl.textContent = q;
    const aReply = document.createElement('div');
    aReply.className = 'a';
    aReply.innerHTML = LOADING;
    threadEl.append(qEl, aReply);
    clampBox();

    const prior = history.slice(-4).map(h => `Student: ${h.q}\nTutor: ${h.a}`).join('\n\n');
    const stepsText = solution.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
    const payload = {
      tier: 'smart',
      max_tokens: 1200,
      system: FOLLOWUP_SYSTEM,
      prompt:
        `Problem: ${solution.problem || term || '(see the image)'}
Answer given: ${solution.answer}
Steps given:
${stepsText}
${prior ? `\nEarlier questions:\n${prior}\n` : ''}
The student now asks: ${q}

Answer their question directly and kindly. If you notice a mistake in the earlier solution, say so and give the corrected answer. Reply in ${solveLang}.`
    };
    if (image) payload.image = image;

    try {
      const text = (await runLLM(siteUrl, payload)).trim();
      aReply.textContent = text || 'No answer returned.';
      history.push({ q, a: text });
    } catch (err) {
      aReply.classList.add('ll-error');
      aReply.textContent = friendlyError(err);
    }
    askBtn.disabled = false;
    clampBox();
  }

  // ----- Wiring -----
  function setMode(m) {
    currentMode = m;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.mode === m));
    paneT.hidden = m !== 'translate';
    paneS.hidden = m !== 'solve';
    if (!started[m]) {
      started[m] = true;
      (m === 'translate' ? loadTranslate : loadSolve)();
    }
    updateSave();
    clampBox();
  }
  tabs.forEach(t => t.addEventListener('click', () => { userPicked = true; setMode(t.dataset.mode); }));

  langSel.addEventListener('change', async () => {
    if (langSel.value === '__auto__') {
      lang = detected;
      await chrome.storage.local.set({ native: lang, nativeAuto: true });
    } else {
      lang = langSel.value;
      await chrome.storage.local.set({ native: lang, nativeAuto: false });
    }
    if (!solveManual) {                       // solutions follow your language unless you chose another
      solveLang = lang;
      solveSel.innerHTML = langOptions(solveLang);
      started.solve = false;
    }
    loadTranslate();
  });
  solveSel.addEventListener('change', async () => {
    solveLang = solveSel.value;
    solveManual = true;
    await chrome.storage.local.set({ solveLang });
    loadSolve();
  });

  // Keep typing in the box from triggering the page's own keyboard shortcuts
  for (const ev of ['keydown', 'keyup', 'keypress']) {
    askInput.addEventListener(ev, (e) => {
      e.stopPropagation();
      if (ev === 'keydown') {
        if (e.key === 'Enter') { e.preventDefault(); ask(); }
        if (e.key === 'Escape') removePopup();
      }
    });
  }
  askBtn.addEventListener('click', ask);

  saveBtn.onclick = async () => {
    const { words = [] } = await chrome.storage.local.get({ words: [] });
    const topicVal = ($('#ll-topic').value || '').trim().slice(0, 40) || 'Unsorted';
    await chrome.storage.local.set({ lastTopic: topicVal === 'Unsorted' ? '' : topicVal });
    // Keep a compact copy of the highlighted image so it can be reviewed and quizzed later
    let savedImage = null;
    if (image) {
      savedImage = image;
      try {
        const r = await chrome.runtime.sendMessage({ type: 'shrink_image', image });
        if (r && r.ok) savedImage = { base64: r.base64, media_type: r.media_type };
      } catch (_) { /* keep the original size */ }
    }
    if (currentMode === 'solve') {
      if (!solution) return;
      const stepsText = solution.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
      words.push({
        word: (solution.problem || term || '(highlighted problem)').slice(0, 150),
        type: 'solution',
        language: solveLang,
        explanation: `Answer: ${solution.answer}\n\n${stepsText}${solution.tip ? `\n\nTip: ${solution.tip}` : ''}`,
        topic: topicVal,
        ...(savedImage ? { image: savedImage } : {}),
        timestamp: Date.now()
      });
    } else {
      if (!current) return;
      words.push({
        word: (term || current.original || '(highlighted image)').slice(0, 300),
        translation: current.translation,
        language: lang,
        explanation: `${current.translation}\n\n${current.simple}`.trim(),
        topic: topicVal,
        ...(savedImage ? { image: savedImage } : {}),
        timestamp: Date.now()
      });
    }
    await chrome.storage.local.set({ words });
    saved[currentMode] = true;
    updateSave();
  };

  $('#ll-quiz-btn').onclick = () => {
    chrome.runtime.sendMessage({ type: 'open_hub', tab: 'quiz' });
    removePopup();
  };

  // topic field: remember the last topic and suggest existing ones
  (async () => {
    const { words: all = [], lastTopic = '' } = await chrome.storage.local.get({ words: [], lastTopic: '' });
    const names = [...new Set(all.map((w) => (w.topic || '').trim()).filter((t) => t && t !== 'Unsorted'))];
    $('#ll-topic-list').innerHTML = names.map((n) => `<option value="${esc(n)}"></option>`).join('');
    $('#ll-topic').value = lastTopic || (settings.subject && settings.subject !== 'general' ? settings.subject : '');
  })();
  // keep page shortcuts from firing while typing in the topic box
  for (const ev of ['keydown', 'keyup', 'keypress']) {
    $('#ll-topic').addEventListener(ev, (e) => e.stopPropagation());
  }

  const autoOff = $('#ll-auto-off');
  if (autoOff) autoOff.onclick = async () => {
    await chrome.storage.local.set({ autoExplain: false });
    autoOff.textContent = 'Done. Highlight text and press Explain to open this next time.';
    autoOff.disabled = true;
  };

  if (autoMode && mode === 'solve') showDetect('This looks like a maths problem, so I\'m solving it step by step.');
  setMode(mode);
}

// ---------- 5. Page extractor (used by background.js for "Create Study Guide") ----------

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
  if (req.action === 'start_snip') {
    startSnip(req.mode || 'translate');
    sendResponse({ started: true });
  }
});
