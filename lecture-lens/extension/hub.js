// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n) + '…' : s; };
const UNSORTED = 'Unsorted';
const ALL = '__all__';

const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch (_) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { } }
};

const LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Chinese (Simplified)',
  'Chinese (Traditional)', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Russian',
  'Vietnamese', 'Turkish', 'Indonesian', 'Tagalog', 'Polish', 'Dutch'
];
let quizLang = 'English';  // defaults to the language you translate into (set in the snip card)

let items = [];          // saved items from the extension
let scope = ALL;         // selected topic key (lowercase) or ALL
let tab = ['guide', 'quiz'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'history';
let search = '';
let quiz = null;         // running quiz state
let busy = false;

// ------------------------------------------------------------------
// Talking to the extension (via bridge-hub.js) and the server
// ------------------------------------------------------------------
const idOf = (w) => w.id || String(w.timestamp);
const keyOf = (w) => ((w.topic || '').trim() || 'Unsorted').toLowerCase();

async function ext(type, data = {}) {
  const { words = [] } = await chrome.storage.local.get({ words: [] });
  if (type === 'get_items') return { ok: true, items: words.map((w) => ({ ...w, id: idOf(w) })) };
  if (type === 'delete_items') {
    const gone = new Set(data.ids || []);
    await chrome.storage.local.set({ words: words.filter((w) => !gone.has(idOf(w))) });
    return { ok: true };
  }
  if (type === 'clear_all') {
    await chrome.storage.local.set({ words: [] });
    return { ok: true };
  }
  if (type === 'set_topic') {
    const ids = new Set(data.ids || []);
    const topic = String(data.topic || '').trim().slice(0, 40) || 'Unsorted';
    await chrome.storage.local.set({ words: words.map((w) => (ids.has(idOf(w)) ? { ...w, id: idOf(w), topic } : w)) });
    return { ok: true };
  }
  if (type === 'rename_topic') {
    const from = String(data.from || '').trim().toLowerCase();
    const to = String(data.to || '').trim().slice(0, 40) || 'Unsorted';
    await chrome.storage.local.set({ words: words.map((w) => (keyOf(w) === from ? { ...w, id: idOf(w), topic: to } : w)) });
    return { ok: true };
  }
  throw new Error('Unknown request');
}

async function llm(payload) {
  const { siteUrl = 'http://localhost:5173' } = await chrome.storage.local.get({ siteUrl: 'http://localhost:5173' });
  const resp = await chrome.runtime.sendMessage({ type: 'llm', url: siteUrl.replace(/\/+$/, '') + '/api/llm', payload });
  if (!resp || resp.networkError) throw new Error('Could not reach your Lecture Lens server. Start it with start-server.bat, then try again.');
  const d = resp.data || {};
  if (!resp.ok || d.error) throw new Error(d.error || 'Server error');
  return d.text || '';
}

function parseJson(text) {
  const c = String(text).replace(/```json|```/g, '');
  return JSON.parse(c.slice(c.indexOf('{'), c.lastIndexOf('}') + 1));
}

function setStatus(msg, kind = 'info') {
  const el = $('#status');
  if (!msg) { el.hidden = true; return; }
  el.hidden = false;
  el.className = 'status ' + kind;
  el.textContent = msg;
}

// ------------------------------------------------------------------
// Topics
// ------------------------------------------------------------------
const topicLabel = (it) => (it.topic || '').trim() || UNSORTED;
const topicKey = (it) => topicLabel(it).toLowerCase();

function topicsList() {
  const map = new Map();
  for (const it of items) {
    const k = topicKey(it);
    if (!map.has(k)) map.set(k, { key: k, label: topicLabel(it), count: 0 });
    map.get(k).count++;
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
const scoped = () => scope === ALL ? items : items.filter(it => topicKey(it) === scope);
const scopeLabel = () => scope === ALL ? 'All topics' : (topicsList().find(t => t.key === scope)?.label || scope);

function lastQuiz(key) {
  const h = store.get('ll_quiz_history', []).filter(q => q.key === key);
  return h.length ? h[h.length - 1] : null;
}

// ------------------------------------------------------------------
// Rendering: sidebar + header
// ------------------------------------------------------------------
function renderSidebar() {
  const topics = topicsList();
  let html = `<button class="topic ${scope === ALL ? 'active' : ''}" data-key="${ALL}">All topics <span class="count">${items.length}</span></button>`;
  for (const t of topics) {
    html += `<button class="topic ${scope === t.key ? 'active' : ''}" data-key="${esc(t.key)}">${esc(t.label)} <span class="count">${t.count}</span></button>`;
  }
  $('#topics').innerHTML = html;
  $('#rename-topic').hidden = scope === ALL;
}
const pct = (q) => Math.round((q.correct / q.n) * 100);

function renderHeader() {
  $('#title').textContent = scopeLabel();
  const n = scoped().length;
  $('#subtitle').textContent = `${n} saved item${n === 1 ? '' : 's'}`;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  for (const name of ['history', 'guide', 'quiz']) $('#tab-' + name).hidden = tab !== name;
}

function render() {
  renderSidebar();
  renderHeader();
  if (tab === 'history') renderHistory();
  if (tab === 'guide') renderGuide();
  if (tab === 'quiz') renderQuiz();
}

function emptyState() {
  return `<div class="empty"><h3>Nothing saved here yet</h3>
    <p>Highlight text on any page, press Translate or Solve, choose a topic, then press Save. It will show up here.</p></div>`;
}

// ------------------------------------------------------------------
// History tab
// ------------------------------------------------------------------
function dayLabel(ts) {
  const d = new Date(ts || 0), now = new Date();
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(now) - start(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

function renderHistory() {
  const root = $('#tab-history');
  const all = scoped();
  if (!items.length || !all.length) { root.innerHTML = emptyState(); return; }

  const q = search.trim().toLowerCase();
  const list = q ? all.filter(it => [it.word, it.translation, it.explanation, it.topic].join(' ').toLowerCase().includes(q)) : all;
  const topics = topicsList();

  let html = `<div class="toolbar">
    <input class="search" id="search" type="search" placeholder="Search what you've learned" value="${esc(search)}">
    <button class="link danger" id="clear-all">Clear all history</button>
  </div>`;
  if (!list.length) html += `<div class="empty"><p>No matches.</p></div>`;

  let lastDay = '';
  for (const it of list) {
    const day = dayLabel(it.timestamp);
    if (day !== lastDay) { html += `<div class="day">${esc(day)}</div>`; lastDay = day; }
    const isSol = it.type === 'solution';
    let body = it.explanation || '';
    if (it.translation && body.startsWith(it.translation)) body = body.slice(it.translation.length).trim();
    const time = it.timestamp ? new Date(it.timestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '';
    const cur = topicLabel(it);
    const options = topics.map(t => `<option value="${esc(t.label)}" ${t.key === topicKey(it) ? 'selected' : ''}>${esc(t.label)}</option>`).join('');
    html += `<article class="card" data-id="${esc(it.id)}">
      <div class="card-top">
        ${isSol ? '<span class="badge solution">Problem</span>' : ''}
        <span class="pill">${esc(cur)}</span>
        <span class="date">${esc(time)}</span>
      </div>
      <h3>${isSol ? esc(clip(it.word, 160)) : `<span class="mk">${esc(clip(it.word, 160))}</span>`}</h3>
      ${it.image ? `<img class="thumb" alt="Saved image" title="Click to enlarge" src="data:${esc(it.image.media_type)};base64,${it.image.base64}">` : ''}
      ${it.translation ? `<div class="trans">${esc(it.translation)}</div>` : ''}
      <div class="body">${esc(body)}</div>
      <div class="card-actions">
        <select class="move" title="Move to topic" aria-label="Move to topic">${options}<option value="__new__">New topic…</option></select>
        <button class="del">Delete</button>
      </div>
    </article>`;
  }
  root.innerHTML = html;
}

async function mutate(type, data) {
  try { await ext(type, data); await loadItems(true); } catch (e) { setStatus(e.message, 'err'); }
}

// ------------------------------------------------------------------
// Study guide tab
// ------------------------------------------------------------------
const guideKey = () => 'll_guide:' + scope;

function itemLines(list, picOf) {
  return list.map(it =>
    `- [${it.type === 'solution' ? 'solved problem' : 'word/text'}] "${clip(it.word, 200)}" => ${clip((it.explanation || '').replace(/\s+/g, ' '), 400)} (topic: ${topicLabel(it)})${it.image ? (picOf && picOf.has(it) ? ` [Picture ${picOf.get(it)} is attached]` : ' [picture saved with this item]') : ''}`
  ).join('\n');
}

function renderGuide() {
  const root = $('#tab-guide');
  const list = scoped();
  if (!list.length) { root.innerHTML = emptyState(); return; }
  const cached = store.get(guideKey(), null);
  root.innerHTML = `<div class="panel">
    <div class="panel-head">
      <div class="muted">Built from ${list.length} saved item${list.length === 1 ? '' : 's'}</div>
      <div class="row" style="margin:0">
        <button class="primary" id="gen-guide" ${busy ? 'disabled' : ''}>${cached ? 'Regenerate' : 'Generate'} study guide</button>
        ${cached ? `<button class="ghost" id="print-guide">Print or save as PDF</button>` : ''}
      </div>
    </div>
    <div id="guide-out" class="guide">${cached ? guideHtml(cached.g, cached) : `<p class="muted">Turn what you saved here into one review sheet with key ideas, vocabulary, worked examples and tips.</p>`}</div>
  </div>`;
}

function listHtml(arr) {
  const a = (Array.isArray(arr) ? arr : []).filter(Boolean);
  return a.length ? `<ul>${a.map(x => `<li>${esc(typeof x === 'string' ? x : Object.values(x).join(': '))}</li>`).join('')}</ul>` : '';
}

function guideHtml(g, meta) {
  const vocab = (Array.isArray(g.vocabulary) ? g.vocabulary : []).filter(v => v && v.term);
  const ex = (Array.isArray(g.worked_examples) ? g.worked_examples : []).filter(v => v && v.problem);
  let h = `<h2>${esc(g.title || 'Study guide')}</h2>`;
  if (g.summary) h += `<p>${esc(g.summary)}</p>`;
  if (Array.isArray(g.key_ideas) && g.key_ideas.length) h += `<h3>Key ideas</h3>${listHtml(g.key_ideas)}`;
  if (vocab.length) h += `<h3>Vocabulary</h3><dl>${vocab.map(v => `<dt>${esc(v.term)}</dt><dd>${esc(v.meaning || '')}</dd>`).join('')}</dl>`;
  if (ex.length) h += `<h3>Worked examples</h3>${ex.map(v => `<div class="ex"><strong>${esc(v.problem)}</strong><div>${esc(v.approach || '')}</div></div>`).join('')}`;
  if (Array.isArray(g.common_mistakes) && g.common_mistakes.length) h += `<h3>Common mistakes</h3>${listHtml(g.common_mistakes)}`;
  if (Array.isArray(g.practice_tips) && g.practice_tips.length) h += `<h3>How to practice</h3>${listHtml(g.practice_tips)}`;
  if (meta) h += `<div class="meta">Made from ${meta.count} item${meta.count === 1 ? '' : 's'} on ${new Date(meta.ts).toLocaleString()}. AI can make mistakes, so double-check important details.</div>`;
  return h;
}

async function generateGuide() {
  const list = scoped().slice(0, 40);
  if (!list.length || busy) return;
  busy = true;
  const btn = $('#gen-guide'); if (btn) { btn.disabled = true; btn.textContent = 'Writing your study guide…'; }
  setStatus('');
  const multi = scope === ALL ? ' These items come from several topics, so group related ideas by topic and start each key idea with the topic name.' : '';
  try {
    const text = await llm({
      tier: 'smart', max_tokens: 3000,
      system: 'You are a clear, friendly tutor. Reply with ONLY one JSON object. No markdown, no code fences, no extra text. Write math in plain text (x^2, sqrt(16), 3/4), never LaTeX.',
      prompt:
        `A student saved these items while studying "${scopeLabel()}". Write a study guide that helps them review what they learned.${multi}

Items:
${itemLines(list)}

Return ONLY a JSON object with these keys:
"title": a short title for the guide.
"summary": 2 to 4 sentences on what this material is about.
"key_ideas": array of 3 to 8 short strings, the main concepts to remember.
"vocabulary": array of {"term": "...", "meaning": "..."} for important words from the items (empty array if none).
"worked_examples": array of {"problem": "...", "approach": "..."} reusing the solved problems and explaining the method in 2 to 4 simple sentences (empty array if none).
"common_mistakes": array of short strings (empty array if none).
"practice_tips": array of 2 to 5 short strings.
Use simple, clear English.`
    });
    const g = parseJson(text);
    store.set(guideKey(), { g, count: list.length, ts: Date.now() });
  } catch (e) {
    setStatus('Could not make the study guide: ' + e.message, 'err');
  }
  busy = false;
  if (tab === 'guide') renderGuide();
}

// ------------------------------------------------------------------
// Quiz tab
// ------------------------------------------------------------------
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; } return a; }

function normalizeQ(q, imgs = []) {
  if (!q || !q.question || !Array.isArray(q.options) || q.options.length < 2) return null;
  const opts = q.options.slice(0, 4).map(String);
  const ai = Number.isInteger(q.answer_index) ? q.answer_index : parseInt(q.answer_index, 10);
  if (!(ai >= 0 && ai < opts.length)) return null;
  const order = shuffle(opts.map((_, i) => i));
  return {
    question: String(q.question),
    options: order.map(i => opts[i]),
    answer: order.indexOf(ai),
    explanation: q.explanation ? String(q.explanation) : '',
    image: imgs[parseInt(q.picture, 10) - 1] || null     // the saved snip this question is about, if any
  };
}

function imgHtml(im, cls = '') {
  return im && im.base64 ? `<img class="thumb ${cls}" alt="Saved picture" title="Click to enlarge" src="data:${esc(im.media_type)};base64,${im.base64}">` : '';
}

function renderQuiz() {
  const root = $('#tab-quiz');
  const list = scoped();
  if (!list.length) { root.innerHTML = emptyState(); return; }
  if (!quiz) { root.innerHTML = quizSetupHtml(list); return; }
  if (quiz.loading) { root.innerHTML = `<div class="panel empty"><p>Writing your quiz from your saved items…</p></div>`; return; }
  root.innerHTML = quiz.i >= quiz.qs.length ? quizResultHtml() : quizQuestionHtml();
}

function quizSetupHtml(list) {
  const hist = store.get('ll_quiz_history', []).filter(q => q.key === scope).slice(-6).reverse();
  return `<div class="panel">
    <p style="margin:0" class="muted">Your ${list.length} saved item${list.length === 1 ? '' : 's'} show the quiz what you are studying. By default it makes up new related questions, words and problems on the same topic.</p>
    <div class="row">
      <label>Questions
        <select id="quiz-n"><option>5</option><option selected>8</option><option>10</option></select>
      </label>
      <label>Language
        <select id="quiz-lang">${(LANGUAGES.includes(quizLang) ? LANGUAGES : [quizLang, ...LANGUAGES]).map(l => `<option ${l === quizLang ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      </label>
      <label>Questions about
        <select id="quiz-style">
          <option value="new" selected>New related material</option>
          <option value="mix">Half saved, half new</option>
          <option value="saved">Only what I saved</option>
        </select>
      </label>
      <button class="primary" id="start-quiz">Start quiz</button>
    </div>
    ${hist.length ? `<h4 class="sub-h">Past quizzes</h4>
      <table class="hist"><tr><th>Date</th><th>Score</th></tr>
      ${hist.map(q => `<tr><td>${esc(new Date(q.ts).toLocaleString())}</td><td>${q.correct} / ${q.n} (${pct(q)}%)</td></tr>`).join('')}</table>` : ''}
  </div>`;
}

function quizQuestionHtml() {
  const q = quiz.qs[quiz.i];
  const answered = quiz.picked !== null;
  const letters = 'ABCD';
  return `<div class="panel">
    <div class="progress"><div style="width:${(quiz.i / quiz.qs.length) * 100}%"></div></div>
    <div class="q-count">Question ${quiz.i + 1} of ${quiz.qs.length}${quiz.retry ? ', retrying missed' : ''}</div>
    ${imgHtml(q.image, 'q-img')}
    <div class="q-text">${esc(q.question)}</div>
    ${q.options.map((o, i) => {
    let cls = '';
    if (answered) cls = i === q.answer ? 'correct' : (i === quiz.picked ? 'wrong' : '');
    return `<button class="opt ${cls}" data-i="${i}" ${answered ? 'disabled' : ''}><span class="ltr">${letters[i]}</span><span>${esc(o)}</span></button>`;
  }).join('')}
    ${answered ? `<div class="explain"><strong>${quiz.picked === q.answer ? 'Correct.' : 'Not quite.'}</strong>${q.explanation ? '\n' + esc(q.explanation) : ''}</div>
      <button class="primary" id="next-q">${quiz.i + 1 >= quiz.qs.length ? 'See results' : 'Next question'}</button>` : ''}
  </div>`;
}

function quizResultHtml() {
  const n = quiz.qs.length, c = quiz.results.filter(r => r.ok).length;
  const missed = quiz.results.filter(r => !r.ok);
  return `<div class="panel">
    <div class="q-count">Results for ${esc(quiz.label)}</div>
    <div class="score">${c} / ${n} <span class="muted" style="font-size:22px">${Math.round((c / n) * 100)}%</span></div>
    <p>${c === n ? 'Perfect score.' : c / n >= 0.7 ? 'Nice work. Review what you missed below.' : 'Review what you missed below, then try again.'}</p>
    ${missed.map(r => `<div class="missed">${imgHtml(r.q.image)}<div><strong>${esc(r.q.question)}</strong></div>
      <div>You chose: ${esc(r.q.options[r.picked])}</div>
      <div class="ans">Correct: ${esc(r.q.options[r.q.answer])}</div>
      ${r.q.explanation ? `<div class="muted">${esc(r.q.explanation)}</div>` : ''}</div>`).join('')}
    <div class="row">
      ${missed.length ? `<button class="primary" id="retry-missed">Retry missed (${missed.length})</button>` : ''}
      <button class="ghost" id="new-quiz">New quiz</button>
    </div>
  </div>`;
}

async function startQuiz() {
  const n = parseInt($('#quiz-n').value, 10) || 8;
  const style = ($('#quiz-style') || {}).value || 'new';
  const qlang = ($('#quiz-lang') || {}).value || quizLang;
  quizLang = qlang;
  const list = scoped().slice(0, 40);
  quiz = { loading: true };
  renderQuiz();
  const label = scopeLabel(), key = scope;
  try {
    const withPic = list.filter(it => it.image).slice(0, 6);                   // saved snips the quiz can use
    const imgs = withPic.map(it => it.image);
    const picOf = new Map(withPic.map((it, i) => [it, i + 1]));                // item -> "Picture N"
    const topicName = scope === ALL ? 'the topics the items come from' : `"${label}"`;
    const styleRules = {
      new: `- The saved items only show the topic and the student's level. Do NOT quiz the items back. Use your own knowledge of ${topicName} to write questions on related ideas, vocabulary, rules and problems the student has NOT saved yet, at the same level of difficulty.
- At most 1 in 5 questions may revisit a saved item, and then reworded or with new numbers.
- For maths or other problem items, write brand new problems of the same type and similar difficulty, with different numbers and situations.
- For words or phrases, include related words (synonyms, opposites, words from the same field) and ask about meaning or use in a sentence.`,
      mix: `- About half the questions should revisit the saved items (reworded, or with new numbers for problems). The other half should be NEW questions on related ideas, vocabulary and problems about ${topicName} that the student has not saved, at the same level.`,
      saved: `- Test the underlying concept of each saved item. Do not copy an item word for word.
- For a solved problem, write a NEW similar problem with different numbers or details.
- For a word or phrase, ask about its meaning or how it is used.`
    }[style] || '';
    const text = await llm({
      ...(imgs.length ? { images: imgs } : {}),
      tier: 'smart', max_tokens: 3500,
      system: 'You write fair, clear quiz questions. Reply with ONLY one JSON object. No markdown, no code fences, no extra text. Write math in plain text (x^2, sqrt(16), 3/4), never LaTeX.',
      prompt:
        `Create ${n} multiple-choice questions that test the same ideas as the items a student saved while studying "${label}".

Items:
${itemLines(list, picOf)}

Rules:
${styleRules}
- Language: write every question, all four options and every explanation in ${qlang}. When a question is about a word or phrase in another language, quote that word or phrase as it is written and ask about it in ${qlang}.
- Items marked [Picture N is attached] came from a screenshot the student snipped, and that picture is attached above in order. Write at least one question for each attached picture that can only be answered by looking at it (for example "What does this diagram show?" or "Which step in this problem is wrong?"). The student will see the picture above the question, so do not describe it in the question and do not give away the answer. For those questions set "picture" to N.
- Items marked [picture saved with this item] have no picture attached, so use their text.
- Each question has exactly 4 options and exactly one correct answer. Make the wrong options believable.
- Vary which option is correct.

Return ONLY JSON in this shape:
{"questions":[{"question":"...","picture":null,"options":["...","...","...","..."],"answer_index":0,"explanation":"one or two sentences on why the answer is right"}]}
Use "picture": null for questions that do not need a picture.`
    });
    const data = parseJson(text);
    const qs = (data.questions || []).map(q => normalizeQ(q, imgs)).filter(Boolean);
    if (!qs.length) throw new Error('No usable questions came back. Try again.');
    quiz = { qs, i: 0, picked: null, results: [], label, key, retry: false };
  } catch (e) {
    quiz = null;
    setStatus('Could not make the quiz: ' + e.message, 'err');
  }
  if (tab === 'quiz') renderQuiz();
}

function finishQuizIfDone() {
  if (quiz.i >= quiz.qs.length && !quiz.logged && !quiz.retry) {
    quiz.logged = true;
    const hist = store.get('ll_quiz_history', []);
    hist.push({ ts: Date.now(), key: quiz.key, label: quiz.label, n: quiz.qs.length, correct: quiz.results.filter(r => r.ok).length });
    store.set('ll_quiz_history', hist.slice(-200));
    renderSidebar();
  }
}

// ------------------------------------------------------------------
// Events
// ------------------------------------------------------------------
document.addEventListener('click', async (e) => {
  const thumb = e.target.closest('.thumb');
  if (thumb) { thumb.classList.toggle('big'); return; }
  const t = e.target.closest('button');
  if (!t) return;

  if (t.classList.contains('topic')) {
    scope = t.dataset.key; quiz = null; render(); return;
  }
  if (t.classList.contains('tab')) { tab = t.dataset.tab; render(); return; }
  if (t.id === 'refresh') { await loadItems(false); return; }
  if (t.id === 'clear-all') {
    const n = items.length;
    if (n && confirm(`Delete ALL ${n} saved item${n === 1 ? '' : 's'} from every topic? This cannot be undone.`)) {
      quiz = null; scope = ALL;
      await mutate('clear_all');
    }
    return;
  }
  if (t.id === 'rename-topic') {
    const to = prompt(`Rename "${scopeLabel()}" to:`, scopeLabel());
    if (to && to.trim()) {
      const newKey = to.trim().toLowerCase();
      await mutate('rename_topic', { from: scope, to: to.trim() });
      scope = newKey; render();
    }
    return;
  }
  if (t.classList.contains('del')) {
    const id = t.closest('.card')?.dataset.id;
    if (id && confirm('Delete this item from your history?')) await mutate('delete_items', { ids: [id] });
    return;
  }
  if (t.id === 'gen-guide') { generateGuide(); return; }
  if (t.id === 'print-guide') { window.print(); return; }
  if (t.id === 'start-quiz') { startQuiz(); return; }
  if (t.id === 'new-quiz') { quiz = null; renderQuiz(); return; }
  if (t.id === 'retry-missed') {
    const missed = quiz.results.filter(r => !r.ok).map(r => ({ ...r.q, options: r.q.options, answer: r.q.answer }));
    quiz = { qs: missed, i: 0, picked: null, results: [], label: quiz.label, key: quiz.key, retry: true };
    renderQuiz(); return;
  }
  if (t.classList.contains('opt') && quiz && quiz.picked === null) {
    const i = parseInt(t.dataset.i, 10);
    const q = quiz.qs[quiz.i];
    quiz.picked = i;
    quiz.results.push({ q, picked: i, ok: i === q.answer });
    renderQuiz(); return;
  }
  if (t.id === 'next-q') {
    quiz.i++; quiz.picked = null;
    finishQuizIfDone();
    renderQuiz(); return;
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.classList.contains('move')) {
    const id = e.target.closest('.card')?.dataset.id;
    let topic = e.target.value;
    if (topic === '__new__') topic = prompt('New topic name:') || '';
    if (id && topic.trim()) await mutate('set_topic', { ids: [id], topic: topic.trim() });
    else render();
  }
});

document.addEventListener('input', (e) => {
  if (e.target.id === 'search') {
    search = e.target.value;
    const pos = e.target.selectionStart;
    renderHistory();
    const box = $('#search'); box.focus(); box.setSelectionRange(pos, pos);
  }
});

// ------------------------------------------------------------------
// Load
// ------------------------------------------------------------------
async function loadItems(silent) {
  try {
    const r = await ext('get_items');
    items = (r.items || []).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (scope !== ALL && !items.some(it => topicKey(it) === scope)) scope = ALL;
    setStatus('');
    if (!(quiz && !quiz.loading && quiz.i < quiz.qs.length) && !busy) render();
    else { renderSidebar(); renderHeader(); }
  } catch (e) {
    if (!silent) setStatus(e.message, 'err');
    render();
  }
}

chrome.storage.local.get({ native: 'English' }).then((r) => {
  quizLang = r.native || 'English';
  if (tab === 'quiz' && !quiz) renderQuiz();
});
window.addEventListener('focus', () => loadItems(true));
chrome.storage.onChanged.addListener((c, area) => { if (area === 'local' && c.words) loadItems(true); });
render();
loadItems(false);