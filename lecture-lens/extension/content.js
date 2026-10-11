// ============================================================
// Lecture Lens - extension/content.js
// Two ways to capture (both work out what you need automatically):
//   - Highlight text -> the card opens by itself (can be turned off)
//   - Snip tool: Alt+Shift+S (auto) / Alt+Shift+Q (force solve), drag over any area
// The card picks its mode for you:
//   - Translate: your language is asked once on first use; text is translated + explained simply
//   - Solve: problems are solved step by step, in your language
// Either tab can still be chosen by hand.
// ============================================================

// ============================================================
// SIMPLE-EXPLANATION SETTINGS
// Change these, save, then reload the extension and refresh your open tabs.
// ============================================================
const EXPLAIN_LEVEL = 'A2';    // how simple the explanation is: 'A1' (easiest), 'A2', 'B1' or 'B2'
const EXPLAIN_TIER = 'smart';  // 'smart' follows the simple-language rules much better; 'fast' is cheaper
const MAX_SELECTION = 8000;   // longest highlighted text (in characters) that will open the card
const COPY_GUARD = true;       // true: if the explanation is just a copy/translation, or too hard for the level, ask once more

// What each level means. Add or edit levels here (maxWords = longest sentence allowed).
const LEVEL_RULES = {
  A1: { maxWords: 6, sentences: '2 to 4', vocab: 'only the most basic everyday words (about the 500 most common words)', grammar: 'the present simple only, no clauses, no passive' },
  A2: { maxWords: 10, sentences: '3 to 5', vocab: 'common everyday words (about the 1,000 most common words)', grammar: 'the present simple, the simple past and "going to", joining ideas only with "and", "but" and "because"; no passive, no idioms, no phrasal verbs' },
  B1: { maxWords: 16, sentences: '3 to 5', vocab: 'common words; a technical term is fine if you explain it', grammar: 'simple clauses; no idioms' },
  B2: { maxWords: 22, sentences: '3 to 6', vocab: 'ordinary everyday and school words', grammar: 'natural but clear sentences' }
};

function explainRule(lang) {
  const level = LEVEL_RULES[EXPLAIN_LEVEL] ? EXPLAIN_LEVEL : 'A2';
  const r = LEVEL_RULES[level];
  return `"simple": a very simple explanation of the ideas in the text, written ONLY in ${lang}, for a reader whose ${lang} is at CEFR level ${level}.
  - It is NOT a translation and NOT a rewording. A translation keeps the original sentences and only changes the language. You must explain the ideas instead.
  - First work out the main ideas of the text, then explain those ideas in your own words. Do not follow the order, the sentences or the wording of the text. Do not quote the text.
  - Level ${level} language: sentences of at most ${r.maxWords} words, one idea per sentence; ${r.vocab}; ${r.grammar}.
  - Replace every hard word (technical or academic terms, idioms, abbreviations, long words) with a short everyday description of what it is or does. Never use a hard word without explaining it. If a technical term must stay, write it once in brackets after its explanation.
  - If the idea is abstract, compare it to something from daily life.
  - Normally ${r.sentences} sentences in total. A single word: say what it means and how people use it. A long passage: explain the main idea, then each key idea in one or two short sentences (up to 8 sentences in total).
  - Example of the difference (shown in English; you write in ${lang}).
    Text: "The mitochondria are the organelles responsible for generating most of the cell's supply of ATP."
    BAD (a translation in different words): "Mitochondria are the parts of the cell that make most of the cell's ATP."
    GOOD (an explanation): "Cells need energy to live. Inside a cell there are tiny parts called mitochondria. They make the energy. They work like small power stations."`;
}

// Checks on the explanation the model wrote. Returns '' if it is fine, or the reason it is not.
function wordsOf(s) { return String(s || '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []; }
function wordPairs(s) {
  const w = wordsOf(s), set = new Set();
  for (let i = 0; i < w.length - 1; i++) set.add(w[i] + ' ' + w[i + 1]);
  return set;
}
function sharedPairs(a, b) {                 // share of a's word pairs that also appear in b (same order = a copy)
  const A = wordPairs(a), B = wordPairs(b);
  if (!A.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return n / A.size;
}
function charOverlap(a, b) {                 // letter-pair similarity, works for scripts without spaces too
  const grams = (t) => {
    const x = String(t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''), set = new Set();
    for (let i = 0; i < x.length - 1; i++) set.add(x.slice(i, i + 2));
    return set;
  };
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const x of A) if (B.has(x)) n++;
  return (2 * n) / (A.size + B.size);
}
function explanationProblem(simple, ...sources) {
  const text = String(simple || '');
  if (!COPY_GUARD || text.length < 30) return '';
  const rules = LEVEL_RULES[EXPLAIN_LEVEL] || LEVEL_RULES.A2;
  const longest = Math.max(0, ...text.split(/[.!?\u00bf\u00a1\u3002\uff01\uff1f\n]+/).map(x => wordsOf(x).length));
  if (longest > rules.maxWords * 1.5) return `its sentences are too long for level ${EXPLAIN_LEVEL} (keep them under ${rules.maxWords} words)`;
  for (const src of sources) {
    if (String(src || '').length < 30) continue;
    if (sharedPairs(text, src) >= 0.4 || charOverlap(text, src) >= 0.7) return 'it only translated or reworded the text instead of explaining the ideas';
  }
  return '';
}

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Chinese (Simplified)',
  'Chinese (Traditional)', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Russian',
  'Vietnamese', 'Turkish', 'Indonesian', 'Tagalog', 'Polish', 'Dutch'
];

// ---------- Interface language ----------
// Nothing is detected. The first time the card opens, the person is asked which language they want
// (see showLanguageSetup). The answer is saved. Every label, button and message on the card is then shown
// in that language: the English texts below are translated once by the AI and saved (chrome.storage).
const ENDONYMS = {
  'English': 'English', 'Spanish': 'Español', 'French': 'Français', 'German': 'Deutsch', 'Italian': 'Italiano',
  'Portuguese': 'Português', 'Chinese (Simplified)': '简体中文', 'Chinese (Traditional)': '繁體中文',
  'Japanese': '日本語', 'Korean': '한국어', 'Arabic': 'العربية', 'Hindi': 'हिन्दी', 'Russian': 'Русский',
  'Vietnamese': 'Tiếng Việt', 'Turkish': 'Türkçe', 'Indonesian': 'Bahasa Indonesia', 'Tagalog': 'Tagalog',
  'Polish': 'Polski', 'Dutch': 'Nederlands'
};
const UI_RTL = ['Arabic', 'Hebrew'];

// Every piece of interface text. Keys stay the same; the values are translated for other languages.
// Placeholders in {braces} are filled in by t().
const UI_EN = {
  close: 'Close',
  errorTitle: 'LECTURE LENS ERROR',
  explain: '✨ Explain',
  solve: '🧮 Solve',
  auto: '⚡ Auto',
  autoTitle: 'Open the explanation automatically whenever I highlight text',
  snipHint: 'Drag over any text, image or problem',
  snipSolveHint: 'Drag over the problem to solve',
  escCancel: 'Esc to cancel',
  youHighlighted: 'You highlighted',
  tabTranslate: '🌐 Translate',
  tabSolve: '🧮 Solve',
  whatItShows: 'What it shows',
  yourLanguage: 'Your language',
  translation: 'Translation',
  simpleExplanation: 'Simple explanation (level {level})',
  explainIn: 'Explain in',
  problem: 'Problem',
  answer: 'Answer',
  stepByStep: 'Step by step',
  askFollowUp: 'Ask a follow-up',
  askPlaceholder: 'e.g. Why did we do that step?',
  askButton: 'Ask',
  aiMistakes: 'AI can make mistakes. Double-check important answers.',
  topic: 'Topic',
  topicPlaceholder: 'e.g. Japanese, Calculus',
  saveWord: '💾 Save Word',
  saveSolution: '💾 Save Solution',
  saved: '✓ Saved',
  quiz: '📝 Quiz',
  stopAuto: 'Stop opening automatically when I highlight text',
  stopAutoDone: 'Done. Highlight text and press Explain to open this next time.',
  working: 'Working on it...',
  looksMath: "This looks like a maths problem, so I'm solving it step by step.",
  alreadyIn: 'Already in {lang}, so here is a plain explanation.',
  detectedTranslated: 'Detected {source}, translated to {lang}.',
  cutTranslation: 'The answer was too long to finish, so the translation is cut off. Select a little less text.',
  cutOriginal: 'There was a lot of text, so the copy of the text is cut short. Your explanation and translation are complete.',
  badFormat: 'The answer came back badly formatted, so part of it may be missing. Try again if something looks wrong.',
  tooLong: 'The answer was too long to finish. Select a little less text and try again.',
  cantRead: "Sorry, I couldn't read the answer. Please try again.",
  noSolution: 'No solution returned.',
  noAnswer: 'No answer returned.',
  seeArea: '(see the highlighted area)',
  none: '(none)',
  noServer: 'Could not reach server. Make sure server.js is running.',
  reloaded: 'The extension was reloaded. Refresh this page and try again.',
  refusal: 'The AI declined to process this content, so there is no answer. If the text on the page can be selected, highlight it instead of snipping it. Otherwise try snipping a different area.',
  emptyReply: 'The model sent back an empty reply (stop reason: {reason}). Check the terminal where server.js is running for details.',
  translating: 'Translating the interface into {lang}...',
  translateFailed: "Couldn't translate the interface into {lang} right now, so it is shown in English. Try again in a moment.",
  noBackground: 'Could not talk to the extension background script. Make sure background.js was updated.',
  noBackgroundReply: 'No response from the background script. Make sure background.js was updated.',
  serverError: 'The server returned an error.',
  captureFailed: "Could not capture the screen. Check that the background code and the 'activeTab' permission were added.",
  highlightedArea: 'Highlighted area'
};
const UI_VERSION = Object.keys(UI_EN).length;    // changes when texts are added, so saved translations refresh
let UI = UI_EN;
let UI_LANG = 'English';
const uiJobs = {};

function t(key, vars) {
  let text = (UI && UI[key]) || UI_EN[key] || key;
  if (vars) for (const k of Object.keys(vars)) text = text.split('{' + k + '}').join(String(vars[k]));
  return text;
}

const UI_SYSTEM = 'You translate user-interface text for a study tool. Reply with ONLY one JSON object. No markdown, no code fences, no extra text. Inside JSON string values never use straight double quotes ("); use single quotes or the language\'s own quote marks instead.';

async function readUiCache(lang) {
  try {
    const { uiStrings = {} } = await chrome.storage.local.get({ uiStrings: {} });
    return uiStrings[lang] || null;
  } catch (_) { return null; }
}

// Pull whatever keys are readable out of a reply that is not valid JSON
function salvageUi(text) {
  const out = {};
  for (const k of Object.keys(UI_EN)) {
    const m = String(text).match(new RegExp('"' + k + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"', 's'));
    if (m) { try { out[k] = JSON.parse('"' + m[1] + '"'); } catch (_) { out[k] = m[1]; } }
  }
  return out;
}

const uiFailedAt = {};     // language -> time of the last failed translation (so a failure does not block every card)

// Translate the interface texts into one language (once) and save them. Returns true on success.
async function translateUi(lang) {
  try {
    const { siteUrl = 'http://localhost:5173' } = await chrome.storage.local.get({ siteUrl: 'http://localhost:5173' });
    const base = siteUrl.replace(/\/+$/, '');
    const keys = Object.keys(UI_EN);
    const payload = {
      tier: 'smart',
      max_tokens: 6000,
      system: UI_SYSTEM,
      prompt: `Translate the VALUES of this JSON object from English into ${lang}. Keep every key exactly the same. Keep emoji where they are. Keep placeholders in curly braces, such as {level}, {lang}, {source} and {reason}, exactly as they are. Use short, natural wording that fits buttons and labels in an app. Keep "LECTURE LENS" in capital letters. Return only the JSON object.

${JSON.stringify(UI_EN)}`
    };
    let obj = null;
    for (let attempt = 0; attempt < 2 && !obj; attempt++) {     // one retry if the reply was cut off or badly formatted
      const text = await runLLM(base, payload);
      let parsed;
      try { parsed = extractJson(text); } catch (_) { parsed = salvageUi(text); }
      const have = keys.filter(k => typeof parsed[k] === 'string' && parsed[k].trim()).length;
      if (have >= keys.length * 0.8) obj = parsed;
    }
    if (!obj) return false;                                      // incomplete: do not save
    const out = { __v: UI_VERSION };
    for (const k of keys) if (typeof obj[k] === 'string' && obj[k].trim()) out[k] = obj[k];
    const { uiStrings = {} } = await chrome.storage.local.get({ uiStrings: {} });
    uiStrings[lang] = out;
    await chrome.storage.local.set({ uiStrings });
    return true;
  } catch (e) {
    console.warn('[Lecture Lens] Could not translate the interface into ' + lang + ':', e);
    return false;
  }
}

// Make the interface use this language. With { translate: true } a missing translation is fetched now.
// Returns true when the interface is now in that language.
async function ensureUiStrings(lang, opts = {}) {
  UI_LANG = lang;
  if (lang === 'English') { UI = UI_EN; return true; }
  let cached = await readUiCache(lang);
  UI = cached ? { ...UI_EN, ...cached } : UI_EN;
  if (cached && cached.__v === UI_VERSION) return true;
  if (!opts.translate) return !!cached;
  if (uiFailedAt[lang] && Date.now() - uiFailedAt[lang] < 60000) return !!cached;
  if (!uiJobs[lang]) uiJobs[lang] = translateUi(lang).finally(() => { delete uiJobs[lang]; });
  const ok = await uiJobs[lang];
  if (ok) delete uiFailedAt[lang]; else uiFailedAt[lang] = Date.now();
  cached = await readUiCache(lang);
  if (cached) UI = { ...UI_EN, ...cached };
  return ok || !!cached;
}

// Is the saved translation for this language complete and up to date?
async function uiReady(lang) {
  if (lang === 'English') return true;
  const c = await readUiCache(lang);
  return !!(c && c.__v === UI_VERSION);
}

// Use the saved language and its saved translation (no AI call)
async function loadUi(translate) {
  try {
    const { native, langConfirmed } = await chrome.storage.local.get({ native: null, langConfirmed: false });
    if (langConfirmed && native) await ensureUiStrings(native, { translate });
  } catch (_) { /* ignore */ }
}
loadUi(false);
try {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.native || changes.uiStrings || changes.langConfirmed)) loadUi(false);
  });
} catch (_) { /* extension was reloaded */ }

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

// Source code (C++, Java, C...) that Visualized Systems can step through in memory
function looksLikeCode(text) {
  const s = String(text || '');
  if (s.length < 6) return false;
  const strong = [
    /^\s*#include\b/m,
    /\bstd::|\bcout\s*<<|\bcin\s*>>|\bSystem\.out\.|\bprintf\s*\(/,
    /\b(int|void|char|double|float|bool|auto|long|unsigned|const|string|String)\s+[*&]?\s*[A-Za-z_]\w*\s*(=|;|\(|\[|,)/,
    /\b(public|private|protected)\s+(static\s+)?(class|void|int|String)\b/,
    /\w\s*->\s*\w|\w\+\+|\+\+\w|\bnew\s+[A-Z]?\w+\s*[(\[]|\bdelete\s+\w/,
    /\breturn\b[^;\n]*;/
  ];
  if (strong.some(re => re.test(s))) return true;
  return /[{}]/.test(s) && /;\s*$/m.test(s);
}

// An equation or function definition that can be graphed step by step
function looksLikeMath(text) {
  const s = String(text || '').trim();
  if (s.length < 3 || s.length > 600) return false;
  if (/\\(frac|sqrt|sin|cos|tan|cdot|times|left|right|pi)\b|\$[^$]+\$|\\\(|\\\[/.test(s)) return true;
  return /^\s*([a-z]\s*\(\s*x\s*\)|y)\s*=\s*\S*x/im.test(s);
}

// 'gdb' for code, 'math' for equations, null when there is nothing to visualize
function visualizeMode(text) {
  if (looksLikeCode(text)) return 'gdb';
  if (looksLikeMath(text)) return 'math';
  return null;
}

async function sendToVisualizer(text, mode) {
  try {
    const resp = await chrome.runtime.sendMessage({ type: 'VISUALIZE_SNIPPET', payload: text, mode });
    if (!resp || !resp.ok) throw new Error(resp?.error || 'Could not open Visualized Systems.');
    removePopup();
  } catch (e) {
    showError(/context invalidated/i.test(e.message)
      ? 'The extension was reloaded. Refresh this page and try again.' : e.message);
  }
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

function langOptions(current) {
  const list = LANGUAGES.includes(current) ? LANGUAGES : [current, ...LANGUAGES];
  const label = (l) => (ENDONYMS[l] && ENDONYMS[l] !== l) ? `${ENDONYMS[l]} (${l})` : l;
  return list.map(l => `<option value="${esc(l)}"${l === current ? ' selected' : ''}>${esc(label(l))}</option>`).join('');
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
      .ll-btnrow { display: flex; flex-wrap: wrap; gap: 6px; }
      .ll-btn {
        display: inline-flex; align-items: center; gap: 6px;
        background: #2b50e6; color: #fff; border: 2px solid #fff; border-radius: 20px;
        padding: 7px 15px; font: 600 13px system-ui, sans-serif; cursor: pointer;
        box-shadow: 0 6px 20px rgba(0,0,0,0.35); transition: transform 0.1s, background 0.15s;
      }
      .ll-btn:hover { background: #1f3bb3; transform: scale(1.04); }
      .ll-btn.alt { background: #0f766e; }
      .ll-btn.alt:hover { background: #0b5a54; }
      .ll-btn.viz { background: #7c3aed; }
      .ll-btn.viz:hover { background: #6d28d9; }
      .ll-action-btn.viz { width: 100%; margin-top: 8px; background: #f5f3ff; color: #5b21b6; border-color: #ddd6fe; }
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
    <div class="ll-card" dir="${UI_RTL.includes(UI_LANG) ? 'rtl' : 'ltr'}">
      <div class="ll-header" id="ll-drag">
        <span>${title}</span>
        <button class="ll-close" id="ll-close-card" title="${esc(t('close'))}">✕</button>
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
  wireCard(render(cardHtml(t('errorTitle'), `<div class="ll-result ll-error">${esc(msg)}</div>`)));
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
  const vizMode = visualizeMode(selectedText);
  const maxLength = vizMode === 'gdb' ? 4000 : MAX_SELECTION;

  clearTimeout(selTimer);
  if (!selectedText || (selectedText.length < 2 && !hasCjk) || selectedText.length > maxLength || !selection.rangeCount) {
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

    await loadUi(false);
    const box = render(`
      <div class="ll-btnrow">
        <button class="ll-btn" id="ll-explain-btn">${esc(t('explain'))}</button>
        ${vizMode !== 'gdb' && looksLikeProblem(selectedText) ? `<button class="ll-btn alt" id="ll-solve-btn">${esc(t('solve'))}</button>` : ''}
        ${vizMode ? '<button class="ll-btn viz" id="ll-viz-btn">📊 Visualize Execution / Graph</button>' : ''}
        <button class="ll-btn" id="ll-auto-on" title="${esc(t('autoTitle'))}">${esc(t('auto'))}</button>
      </div>
    `);
    box.querySelector('#ll-explain-btn').addEventListener('click', () => openCard({ term: selectedText, mode: 'auto' }));
    const vizBtn = box.querySelector('#ll-viz-btn');
    if (vizBtn) vizBtn.addEventListener('click', () => sendToVisualizer(selectedText, vizMode));
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

async function startSnip(mode = 'auto') {
  removePopup();
  cancelSnip();
  snipActive = true;
  await loadUi(false);                            // use the language saved in any tab

  const hint = mode === 'solve' ? t('snipSolveHint') : t('snipHint');

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
    <div class="hint">${esc(hint)} &nbsp;·&nbsp; ${esc(t('escCancel'))}</div>
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
      throw new Error(resp?.error || t('captureFailed'));
    }
    openCard({ image: { base64: resp.base64, media_type: resp.media_type }, mode });
  } catch (e) {
    const msg = /context invalidated/i.test(e.message)
      ? t('reloaded') : e.message;
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
      throw new Error(t('reloaded'));
    }
    throw new Error(t('noBackground'));
  }
  if (!resp) throw new Error(t('noBackgroundReply'));
  return resp;
}

async function runLLM(siteUrl, payload) {
  const resp = await callLLM(siteUrl, payload);
  if (resp.networkError) throw new TypeError('network');
  const data = resp.data || {};
  if (!resp.ok || data.error) throw new Error(data.error || t('serverError'));
  runLLM.truncated = data.stop_reason === 'max_tokens';   // was the reply cut off?
  runLLM.stopReason = data.stop_reason || 'unknown';
  // FIX: an empty reply means the server failed quietly. Say so instead of showing "couldn't read the answer".
  if (!data.text || !String(data.text).trim()) {
    if (runLLM.stopReason === 'refusal') {
      throw new Error(t('refusal'));
    }
    throw new Error(t('emptyReply', { reason: runLLM.stopReason }));
  }
  return data.text;
}

function friendlyError(err) {
  return err instanceof TypeError
    ? t('noServer')
    : err.message;
}

// Fixes the usual ways a model breaks JSON: raw line breaks inside strings, trailing commas
function repairJson(str) {
  let out = '', inStr = false, esc = false;
  for (const ch of str) {
    if (inStr) {
      if (esc) { out += ch; esc = false; }
      else if (ch === '\\') { out += ch; esc = true; }
      else if (ch === '"') { out += ch; inStr = false; }
      else if (ch === '\n') out += '\\n';
      else if (ch === '\r') out += '';
      else if (ch === '\t') out += '\\t';
      else out += ch;
    } else {
      if (ch === '"') inStr = true;
      out += ch;
    }
  }
  return out.replace(/,\s*([}\]])/g, '$1');
}

function extractJson(text) {
  const cleaned = String(text).replace(/```json|```/g, '');
  const body = cleaned.slice(cleaned.indexOf('{'), cleaned.lastIndexOf('}') + 1);
  try { return JSON.parse(body); } catch (_) { return JSON.parse(repairJson(body)); }
}

// Translate mode: {original, translation, simple}
function parseResult(text) {
  try {
    let obj = extractJson(text);
    if (!obj.simple) obj = Object.values(obj).find(v => v && typeof v === 'object' && v.simple) || obj;   // {"result": {...}}
    const same = obj.same_language === true;
    const flat = (v) => Array.isArray(v) ? v.map(String).join(' ') : (v && typeof v === 'object') ? Object.values(v).map(String).join(' ') : String(v || '');
    const simple = flat(obj.simple).trim();
    if (simple) {            // translation is optional (pictures, diagrams, text already in your language)
      return {
        original: obj.original ? flat(obj.original) : (obj.title ? flat(obj.title) : ''),
        translation: obj.translation ? flat(obj.translation) : '',
        simple,
        source_language: obj.source_language ? String(obj.source_language) : '',
        same_language: same,
        is_problem: obj.is_problem === true
      };
    }
  } catch (_) { /* fall through */ }
  return null;
}

// A reply that was cut off (too long) or is not valid JSON: pull out whatever fields are readable
function salvageFields(text) {
  const grab = (key) => {
    const re = new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)', 's');
    const m = String(text).match(re);
    if (!m) return '';
    const raw = m[1].replace(/\\$/, '');                 // drop a dangling backslash from a cut-off reply
    try { return JSON.parse('"' + raw + '"'); } catch (_) { return raw; }
  };
  return { original: grab('original') || grab('title'), translation: grab('translation'), simple: grab('simple'), source_language: grab('source_language') };
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

const JSON_SYSTEM = 'You are a patient language tutor and translator. When asked to explain, you explain the ideas in very simple words and never just translate or reword the text. Reply with ONLY one JSON object. No markdown, no code fences, no extra text. Inside JSON string values never use straight double quotes ("); use single quotes or the language\'s own quote marks instead.';
const SOLVE_SYSTEM = 'You are a patient, friendly tutor. Always get the answer right, then teach it clearly. Reply with ONLY one JSON object. No markdown, no code fences, no extra text. Write math in plain text (for example x^2, sqrt(16), 3/4) and never use LaTeX.';
const FOLLOWUP_SYSTEM = 'You are a patient, friendly tutor helping a student. Answer their question clearly and kindly in a short reply. Plain text only: no markdown, no LaTeX; write math like x^2, sqrt(16), 3/4.';

// ---------- First-use question: which language do you want? ----------

function showLanguageSetup(preselect, onDone) {
  const box = render(cardHtml('LECTURE LENS', `
    <div class="ll-label">🌐 Language · 言語 · 语言 · 언어 · Idioma · Langue · Sprache · لغة · भाषा</div>
    <div class="ll-row">
      <select class="ll-select" id="ll-setup-lang" style="max-width:none">${langOptions(preselect)}</select>
    </div>
    <div class="ll-actions">
      <button class="ll-action-btn primary" id="ll-setup-ok">OK ✓</button>
    </div>
  `));
  wireCard(box);
  const ok = box.querySelector('#ll-setup-ok');
  ok.onclick = async () => {
    const value = box.querySelector('#ll-setup-lang').value;
    ok.disabled = true;
    ok.textContent = '…';
    await chrome.storage.local.set({ native: value, langConfirmed: true });
    await ensureUiStrings(value, { translate: true });      // translate the interface once and save it
    onDone();
  };
}

// ---------- 4. Result card (text or snipped image; Translate or Solve) ----------

async function openCard({ term = null, image = null, mode = 'auto' }) {
  const settings = await chrome.storage.local.get({
    siteUrl: 'http://localhost:5173', native: null, langConfirmed: false, solveLang: null, subject: 'general'
  });
  const siteUrl = settings.siteUrl.replace(/\/+$/, '');

  // First use: ask which language the person wants, once, then carry on
  if (!settings.langConfirmed || !settings.native) {
    showLanguageSetup(settings.native || 'English', () => openCard({ term, image, mode }));
    return;
  }
  let lang = settings.native;                                       // translate target
  const langName = ENDONYMS[lang] || lang;
  if (!(await uiReady(lang))) {                                     // the card is about to be translated: say so
    wireCard(render(cardHtml('LECTURE LENS',
      `<div class="ll-result ll-loading">${esc(UI_EN.translating.replace('{lang}', langName))}</div>`)));
  }
  const uiOk = await ensureUiStrings(lang, { translate: true });    // interface texts in your language
  const uiNotice = uiOk ? '' : t('translateFailed', { lang: langName });
  let solveManual = !!settings.solveLang;                           // otherwise solutions follow your language
  let solveLang = settings.solveLang || lang;                       // language the solution is explained in

  // Work out what the person needs: a clear problem goes straight to Solve, everything else starts as Translate
  const autoMode = mode === 'auto';
  const vizMode = term ? visualizeMode(term) : null;
  if (autoMode) mode = (term && vizMode !== 'gdb' && looksLikeProblem(term)) ? 'solve' : 'translate';
  let userPicked = !autoMode;

  const highlightedHtml = image
    ? `<div class="ll-label">${esc(t('youHighlighted'))}</div>
       <div class="ll-quote"><img class="ll-thumb" alt="${esc(t('highlightedArea'))}" src="data:${image.media_type};base64,${image.base64}"></div>`
    : `<div class="ll-label">${esc(t('youHighlighted'))}</div>
       <div class="ll-quote">${esc(term)}</div>`;

  const box = render(cardHtml('LECTURE LENS', `
    ${highlightedHtml}
    ${uiNotice ? `<div class="ll-tip">${esc(uiNotice)}</div>` : ''}
    <div class="ll-detect" id="ll-detect" hidden></div>

    <div class="ll-tabs" id="ll-tabs">
      <button class="ll-tab" data-mode="translate">${esc(t('tabTranslate'))}</button>
      <button class="ll-tab" data-mode="solve">${esc(t('tabSolve'))}</button>
    </div>

    <div class="ll-pane" id="ll-pane-translate">
      ${image ? `<div class="ll-label">${esc(t('whatItShows'))}</div><div class="ll-result ll-original" id="ll-original"></div>` : ''}
      <div class="ll-row">
        <span class="ll-label" style="margin:0">${esc(t('yourLanguage'))}</span>
        <select class="ll-select" id="ll-lang">${langOptions(lang)}</select>
      </div>
      <div class="ll-label" id="ll-trans-label">${esc(t('translation'))}</div>
      <div class="ll-result ll-translation" id="ll-translation"></div>
      <div class="ll-label">${esc(t('simpleExplanation', { level: EXPLAIN_LEVEL }))}</div>
      <div class="ll-result" id="ll-simple"></div>
    </div>

    <div class="ll-pane" id="ll-pane-solve" hidden>
      <div class="ll-row">
        <span class="ll-label" style="margin:0">${esc(t('explainIn'))}</span>
        <select class="ll-select" id="ll-solve-lang">${langOptions(solveLang)}</select>
      </div>
      <div class="ll-label">${esc(t('problem'))}</div>
      <div class="ll-result ll-original" id="ll-problem"></div>
      <div class="ll-label">${esc(t('answer'))}</div>
      <div class="ll-result ll-answer" id="ll-answer"></div>
      <div class="ll-label">${esc(t('stepByStep'))}</div>
      <ol class="ll-steps" id="ll-steps"></ol>
      <div class="ll-tip" id="ll-tip" hidden></div>
      <div class="ll-label">${esc(t('askFollowUp'))}</div>
      <div class="ll-ask">
        <input class="ll-input" id="ll-ask-input" type="text" placeholder="${esc(t('askPlaceholder'))}">
        <button class="ll-action-btn primary" id="ll-ask-btn" style="flex:none" disabled>${esc(t('askButton'))}</button>
      </div>
      <div class="ll-thread" id="ll-thread"></div>
      <div class="ll-note">${esc(t('aiMistakes'))}</div>
    </div>

    <div class="ll-row" style="margin-top:10px">
      <span class="ll-label" style="margin:0">${esc(t('topic'))}</span>
      <input class="ll-input" id="ll-topic" list="ll-topic-list" maxlength="40" placeholder="${esc(t('topicPlaceholder'))}">
      <datalist id="ll-topic-list"></datalist>
    </div>
    <div class="ll-actions">
      <button class="ll-action-btn primary" id="ll-save-btn" disabled>${esc(t('saveWord'))}</button>
      <button class="ll-action-btn" id="ll-quiz-btn">${esc(t('quiz'))}</button>
    </div>
    ${vizMode ? '<button class="ll-action-btn viz" id="ll-viz-btn">📊 Visualize Execution / Graph</button>' : ''}
    ${image ? '' : `<button class="ll-link" id="ll-auto-off">${esc(t('stopAuto'))}</button>`}
  `));
  wireCard(box);

  const $ = (id) => box.querySelector(id);
  const vizBtn = $('#ll-viz-btn');
  if (vizBtn) vizBtn.onclick = () => sendToVisualizer(term, vizMode);
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

  const LOADING = `<span class="ll-loading">${esc(t('working'))}</span>`;
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
    saveBtn.textContent = saved[currentMode] ? t('saved') : (currentMode === 'solve' ? t('saveSolution') : t('saveWord'));
    const ready = currentMode === 'solve' ? !!solution : !!current;
    saveBtn.disabled = saved[currentMode] || !ready;
  }

  // If the explanation is just the translation again, ask once more for a real explanation
  async function rewriteSimple(original, reason) {
    try {
      const text = await runLLM(siteUrl, {
        tier: EXPLAIN_TIER,
        max_tokens: 800,
        system: JSON_SYSTEM,
        prompt: `Text: "${original}"${subjectHint}

A student needs this explained. A first attempt was rejected because ${reason}.

Return a JSON object with exactly these keys:
${explainRule(lang)}`
      });
      const obj = extractJson(text);
      return obj.simple ? String(obj.simple) : null;
    } catch (_) { return null; }
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

    const simpleRule = explainRule(lang);
    const detectRules =
      `"source_language": the language the text is written in, as an English name such as "Japanese".
"same_language": true if the text is already written in ${lang}, otherwise false.
"is_problem": true ONLY if the text is a maths problem or something that needs computation to answer (arithmetic, algebra, geometry, calculus, statistics, or a physics or chemistry calculation). false for everything else, including ordinary words, sentences and passages, definitions, opinion or essay questions, history or reading questions, and general quiz questions that need no calculation.`;
    // Snips go straight from the picture to translation + explanation (no word-for-word transcription,
    // which the model can refuse to do for long passages)
    const useImage = !!image;
    const payload = {
      tier: useImage ? 'smart' : EXPLAIN_TIER,
      max_tokens: useImage ? 4500 : Math.min(6000, 1500 + String(sourceText || '').length * 2),   // long passages need room
      system: JSON_SYSTEM,
      prompt: useImage
        ? `This image is a screenshot of part of a document or web page.${subjectHint}
Look at the text in it, whatever language it is written in. Do not copy the text out word for word: the student only needs the translation and the explanation.

Return a JSON object with exactly these keys, in this order:
${detectRules}
${simpleRule}
"translation": that text translated directly and naturally into ${lang}. If same_language is true, set this to "". Output only the translation, nothing else.
"title": a short title of at most 10 words saying what the image is about, in ${lang}. Write this key LAST, after "translation".
If the image shows a picture or diagram with little or no text, describe what it shows in "simple" and set "translation" to "".
If there is nothing readable or recognisable at all, set "title" to "", "translation" to "(nothing readable found)", and "simple" to a short note saying so.`
        : `Text: "${sourceText}"${subjectHint}

Return a JSON object with exactly these keys:
${detectRules}
${simpleRule}
"translation": the text translated directly and naturally into ${lang}. If same_language is true, set this to "". Output only the translation, nothing else.`
    };
    if (useImage) payload.image = image;

    try {
      let text = await runLLM(siteUrl, payload);
      if (id !== tReq) return;
      let parsed = parseResult(text);
      if (!parsed) {                                   // cut off or malformed: ask once more with the biggest budget
        payload.max_tokens = 6000;
        text = await runLLM(siteUrl, payload);
        if (id !== tReq) return;
        parsed = parseResult(text);
      }
      if (parsed) {
        if (!parsed.original && sourceText) parsed.original = sourceText;
        const same = !parsed.translation;                       // nothing to translate: hide that box
        tEl.hidden = same; transLabel.hidden = same;          // already in your language: skip the translation box
        tEl.textContent = parsed.translation;
        const base = sourceText || parsed.translation || '';
        const problem = explanationProblem(parsed.simple, parsed.translation, base);
        if (problem && base.length >= 30) {                                              // copied, or too hard: one more try
          sEl.innerHTML = LOADING;
          clampBox();
          const better = await rewriteSimple(base, problem);
          if (id !== tReq) return;
          if (better) parsed.simple = better;
        }
        sEl.textContent = parsed.simple;
        if (oEl && useImage) {
          oEl.textContent = parsed.original || t('none');
        }
        current = parsed;
        if (parsed.is_problem) tabsEl.hidden = false;           // a solvable problem: offer the Solve tab
        else if (autoMode && !userPicked) tabsEl.hidden = true;  // nothing to solve: no Solve tab
        if (autoMode && !userPicked && parsed.is_problem) {   // it is a problem to solve, so solve it
          showDetect(t('looksMath'));
          setMode('solve');
          return;
        }
        if (parsed.same_language) showDetect(t('alreadyIn', { lang: langName }));
        else if (parsed.source_language) showDetect(t('detectedTranslated', { source: parsed.source_language, lang: langName }));
        else showDetect('');
      } else {
        const part = salvageFields(text);
        const cut = runLLM.truncated === true;          // really too long, or just badly formatted?
        console.warn('[Lecture Lens] The reply was not valid JSON.', { cutOff: cut, reply: text });
        if (part.simple) {                             // the reply was cut off, but the explanation is readable
          tEl.hidden = !part.translation; transLabel.hidden = !part.translation;
          const transCut = cut && !part.original;          // the title comes last, so if it exists the translation is complete
          tEl.textContent = part.translation ? part.translation + (transCut ? '\u2026' : '') : '';
          sEl.textContent = part.simple;
          if (oEl && useImage) {
            oEl.textContent = part.original || t('none');
          }
          current = {
            original: part.original || sourceText || '', translation: part.translation, simple: part.simple,
            source_language: part.source_language, same_language: false, is_problem: false
          };
          showDetect(cut
            ? (transCut
              ? t('cutTranslation')
              : t('cutOriginal'))
            : t('badFormat'));
        } else {
          tEl.textContent = '\u2014';
          sEl.textContent = cut
            ? t('tooLong')
            : t('cantRead');
          if (oEl && useImage) oEl.textContent = t('none');
          current = null;                              // nothing usable to save
          showDetect(`Details: stop reason = ${runLLM.stopReason}; reply length = ${String(text).length}; reply starts: ${String(text).slice(0, 250).replace(/\s+/g, ' ') || '(empty)'}`);
        }
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
      solution = parsed || { problem: '', answer: '—', steps: [text || t('noSolution')], tip: '' };

      pEl.textContent = solution.problem || term || t('seeArea');
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
      aReply.textContent = text || t('noAnswer');
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
    await chrome.storage.local.set({ native: langSel.value, langConfirmed: true });
    await chrome.storage.local.remove('solveLang');           // solutions follow the new language again
    langSel.disabled = true;                                  // the card is rebuilt once the interface is translated
    // Rebuild the whole card so every label switches to the new language
    openCard({ term, image, mode: autoMode && !userPicked ? 'auto' : currentMode });
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
    autoOff.textContent = t('stopAutoDone');
    autoOff.disabled = true;
  };

  if (autoMode && mode === 'solve') showDetect(t('looksMath'));
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