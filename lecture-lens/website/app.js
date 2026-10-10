// ============================================================
// Lecture Lens - website/app.js
// Features: Auto-Page Import, Native Language Study Guides,
// Mermaid Diagrams + YouTube Concept Videos, Bilingual Quiz
// ============================================================

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

const state = {
  words: [],
  native: 'Spanish',
  level: 'intermediate',
  subject: 'general',
  notes: load('ll_notes', null),
  score: load('ll_score', {}),
  pendingPage: null,
  quizData: null,
  quizLang: 'en' // 'en' | 'native'
};

// ---- Read words, settings, and pending page from the extension
function loadFromExtension() {
  return new Promise(res => {
    const t = setTimeout(() => res(false), 900);
    addEventListener('message', function h(e) {
      if (e.source !== window || e.data?.ll !== 'data') return;
      removeEventListener('message', h);
      clearTimeout(t);
      Object.assign(state, e.data.data);
      if (state.words) localStorage.setItem('ll_words', JSON.stringify(state.words));
      res(true);
    });
    postMessage({ ll: 'get' }, '*');
  });
}

async function api(tier, system, prompt, max) {
  const r = await fetch('/api/llm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ tier, system, prompt, max_tokens: max })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Request failed');
  const c = d.text.replace(/```json|```/g, '');
  return JSON.parse(c.slice(c.indexOf('{'), c.lastIndexOf('}') + 1));
}

const profile = () => `Student's native language: ${state.native}. English level: ${state.level}. Subject: ${state.subject}.`;

// ---- Tab Switching
document.querySelectorAll('[role=tab]').forEach(b => b.onclick = () => {
  document.querySelectorAll('[role=tab]').forEach(x => x.setAttribute('aria-selected', x === b));
  ['notes', 'words', 'quiz'].forEach(id => {
    const el = $(id);
    if (el) el.hidden = (id !== b.dataset.tab);
  });
});

// ---- Notes Generation Pipeline (Native Study Guide + Videos + Diagrams)
$('gen').onclick = async () => {
  const text = $('tx').value.trim();
  if (!text) { $('nstat').textContent = 'Paste some text or import a webpage first.'; return; }

  $('gen').disabled = true;
  $('nstat').textContent = `Building your study guide in ${state.native}… This takes about 20-30 seconds.`;

  try {
    state.notes = await api('smart',
      `You are an expert tutor creating study guides for international students in their native language (${state.native}).
Use only facts from the provided text. Return ONLY valid JSON, no markdown fences.`,
      `${profile()}
Task: Turn this text into a comprehensive study guide in ${state.native}.

Format your response as:
{
  "page_topic": "General topic title in ${state.native}",
  "topics": [
    {
      "topic": "Topic name in ${state.native} (English translation in brackets)",
      "summary_native": "Comprehensive 3-4 sentence explanation in ${state.native} explaining the core concepts simply and clearly.",
      "summary_en": "2-3 sentence summary in simple English.",
      "key_terms": [
        {
          "term": "English Term",
          "translation": "Term translated to ${state.native}",
          "native_explanation": "Simple definition in ${state.native}",
          "plain_english": "Simple definition in English"
        }
      ],
      "visual": {
        "needed": true,
        "type": "flowchart",
        "title": "Diagram title in ${state.native}",
        "mermaid": "Valid Mermaid diagram syntax (mindmap, graph TD, or timeline). Use short alphanumeric labels."
      },
      "video_search": {
        "needed": true,
        "query": "Short concise English search phrase for educational YouTube video explaining this concept (e.g. 'Photosynthesis animation light reaction')",
        "title": "Recommended Video Lesson"
      },
      "source_excerpt": "Direct quote from source text"
    }
  ]
}

Source Text:
${text.slice(0, 14000)}`, 4500);

    localStorage.setItem('ll_notes', JSON.stringify(state.notes));
    $('nstat').textContent = '';
    state.quizData = null;
    renderNotes();
  } catch (e) {
    $('nstat').textContent = 'Error: ' + e.message;
  }
  $('gen').disabled = false;
};

async function renderNotes() {
  const out = $('nout');
  const topics = state.notes?.topics || [];
  if (!topics.length) { out.innerHTML = ''; return; }

  out.innerHTML = (state.notes.page_topic ? `<h1 class="guide-main-title" style="margin-bottom:1.2rem;">${esc(state.notes.page_topic)}</h1>` : '') +
    topics.map((t, i) => `
    <article class="topic" id="topic-${i}" style="margin-bottom:2.2rem; padding:1.4rem; border-radius:10px; background:#fff; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
      <h2 style="margin-top:0;">${esc(t.topic)}</h2>
      
      <div class="summary-box" style="margin:1rem 0; line-height:1.6;">
        <p class="summary-native" style="font-size:1.05rem;"><strong>Explicación (${esc(state.native)}):</strong> ${esc(t.summary_native || t.summary)}</p>
        ${t.summary_en ? `<p class="summary-en muted" style="color:#64748b; margin-top:0.4rem;"><small><strong>English Summary:</strong> ${esc(t.summary_en)}</small></p>` : ''}
      </div>

      <div class="terms-grid" style="margin:1.2rem 0;">
        <h4 style="margin-bottom:0.5rem;">Vocabulario Clave:</h4>
        ${(t.key_terms || []).map(k => `
          <div class="term" style="margin-bottom:0.75rem; padding:0.6rem 0.8rem; border-left:3px solid #3b82f6; background:#f8fafc; border-radius:0 6px 6px 0;">
            <b>${esc(k.term)} <span class="term-trans" style="color:#2563eb;">(${esc(k.translation)})</span></b>
            <div style="margin-top:0.25rem;">
              <span>${esc(k.native_explanation || k.plain_english)}</span>
              ${k.plain_english && k.native_explanation ? `<div class="term-en" style="color:#64748b; font-size:0.85rem; margin-top:2px;">English: ${esc(k.plain_english)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>

      ${t.visual?.needed && t.visual?.mermaid ? `
        <div class="visual-card" style="margin:1.5rem 0; padding:1rem; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
          <h3 style="margin-top:0;">📊 Diagrama: ${esc(t.visual.title || 'Guía Visual')}</h3>
          <div class="diagram" id="d${i}"></div>
        </div>` : ''}

      ${t.video_search?.query ? `
        <div class="video-card" style="margin:1.5rem 0; padding:1rem; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
          <h3 style="margin-top:0;">🎬 Video Explicativo: ${esc(t.video_search.title || 'Lección en Video')}</h3>
          <p class="muted" style="color:#64748b; margin-bottom:0.75rem;"><small>Concepto de búsqueda: <em>${esc(t.video_search.query)}</em></small></p>
          <div class="video-container" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:8px;">
            <iframe 
              src="https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(t.video_search.query)}" 
              title="Educational Video" 
              style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen>
            </iframe>
          </div>
        </div>` : ''}
    </article>
  `).join('');

  if (window.mermaid) {
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
    for (const [i, t] of topics.entries()) {
      if (!t.visual?.needed || !t.visual?.mermaid) continue;
      try {
        const rendered = await mermaid.render('m' + i, t.visual.mermaid);
        const container = $('d' + i);
        if (container) container.innerHTML = rendered.svg;
      } catch (err) {
        const container = $('d' + i);
        if (container) {
          container.innerHTML = '<p class="muted">El diagrama no se pudo dibujar automáticamente. El vocabulario cubre estos conceptos.</p>';
        }
      }
    }
  }
}

// ---- Word Bank
function renderWords() {
  const wc = $('wc');
  if (wc) wc.textContent = state.words.length ? `(${state.words.length})` : '';
  const wout = $('wout');
  if (!wout) return;
  wout.innerHTML = state.words.length
    ? `<h2>Palabras Guardadas</h2>` + state.words.map(w =>
      `<div class="term"><b>${esc(w.emoji || '📖')} ${esc(w.term)}</b><span>${esc(w.plain_english)}<small>${esc(w.translation)}</small></span></div>`).join('')
    : '<p class="empty">No hay palabras guardadas aún. Resalta texto en cualquier página web y haz clic en "Guardar palabra".</p>';
}

// ---- Bilingual Quiz Generator (English <-> Native Language Toggle)
$('qgen').onclick = async () => {
  if (!state.notes?.topics?.length) {
    $('qstat').textContent = 'Genera notas primero. El quiz se construye a partir de tu guía de estudio.';
    return;
  }
  $('qgen').disabled = true;
  $('qstat').textContent = 'Escribiendo preguntas bilingües…';

  try {
    const res = await api('smart',
      `You write bilingual exam-style quiz questions for international students. Use only the provided notes.
Reply with ONLY valid JSON without markdown fences.`,
      `${profile()}
Write 6 multiple-choice questions from these notes. Provide every question, option, and explanation in BOTH English AND the student's native language (${state.native}).

Format:
{
  "questions": [
    {
      "topic": "Topic Name",
      "answer_index": 0,
      "source_excerpt": "Excerpt from notes",
      "en": {
        "question": "Question in English",
        "options": ["Option A in English", "Option B in English", "Option C in English", "Option D in English"],
        "explanation": "Clear explanation in English"
      },
      "native": {
        "question": "Pregunta traducida en ${state.native}",
        "options": ["Opción A en ${state.native}", "Opción B en ${state.native}", "Opción C en ${state.native}", "Opción D en ${state.native}"],
        "explanation": "Explicación clara en ${state.native}"
      }
    }
  ]
}

Notes:
${JSON.stringify(state.notes).slice(0, 12000)}`, 3800);

    state.quizData = res.questions;
    $('qstat').textContent = '';
    renderQuiz();
  } catch (e) {
    $('qstat').textContent = 'Error: ' + e.message;
  }
  $('qgen').disabled = false;
};

function renderQuiz() {
  const qs = state.quizData;
  if (!qs || !qs.length) return;

  const currentLang = state.quizLang; // 'en' or 'native'
  const langLabel = currentLang === 'en'
    ? `🌐 Cambiar a vista en ${state.native}`
    : `🇬🇧 Switch to English view`;

  let html = `
    <div class="quiz-controls" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; background:#f0f4f8; padding:0.75rem 1rem; border-radius:8px;">
      <span><strong>Idioma actual del Quiz:</strong> <span id="current-lang-name">${currentLang === 'en' ? 'English' : esc(state.native)}</span></span>
      <button id="toggle-quiz-lang" type="button" style="cursor:pointer; padding:8px 16px; font-weight:600; border-radius:6px; border:1px solid #0284c7; background:#0284c7; color:#fff;">
        ${esc(langLabel)}
      </button>
    </div>
  `;

  html += qs.map((q, i) => {
    const qData = q[currentLang] || q.en;
    return `
      <div class="q" id="q${i}" style="margin-bottom:1.5rem; padding:1.25rem; border-radius:8px; background:#fff; border:1px solid #e2e8f0;">
        <div class="q-header" style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
          <h3 class="q-title" style="margin:0;">${i + 1}. ${esc(qData.question)}</h3>
          <small class="muted" style="color:#64748b; margin-left:1rem;">${esc(q.topic)}</small>
        </div>
        <div class="opts" style="display:grid; gap:0.5rem; margin-top:0.75rem;">
          ${qData.options.map((opt, j) => `
            <button class="opt" data-q="${i}" data-o="${j}" style="text-align:left; padding:0.6rem 1rem; border:1px solid #cbd5e1; border-radius:6px; background:#fff; cursor:pointer;">
              <strong class="opt-label">${['A', 'B', 'C', 'D'][j]}:</strong> <span class="opt-text">${esc(opt)}</span>
            </button>
          `).join('')}
        </div>
        <div class="why" hidden style="margin-top:1rem; padding:0.75rem; background:#f8fafc; border-radius:6px; border-left:4px solid #3b82f6;"></div>
      </div>
    `;
  }).join('');

  html += '<p class="score" id="sc" role="status" style="font-size:1.1rem; font-weight:bold; margin-top:1.5rem;"></p>';
  $('qout').innerHTML = html;

  // Language Toggle Handler: switches language without resetting user's answers or score
  $('toggle-quiz-lang').onclick = () => {
    state.quizLang = (state.quizLang === 'en') ? 'native' : 'en';
    updateQuizLanguageText();
  };

  attachQuizOptionHandlers();
}

function updateQuizLanguageText() {
  const qs = state.quizData;
  if (!qs) return;
  const currentLang = state.quizLang;

  const btn = $('toggle-quiz-lang');
  if (btn) {
    btn.textContent = currentLang === 'en'
      ? `🌐 Cambiar a vista en ${state.native}`
      : `🇬🇧 Switch to English view`;
  }
  const langName = $('current-lang-name');
  if (langName) {
    langName.textContent = currentLang === 'en' ? 'English' : state.native;
  }

  qs.forEach((q, i) => {
    const box = $('q' + i);
    if (!box) return;
    const qData = q[currentLang] || q.en;

    const title = box.querySelector('.q-title');
    if (title) title.textContent = `${i + 1}. ${qData.question}`;

    box.querySelectorAll('.opt').forEach((btn, j) => {
      const textSpan = btn.querySelector('.opt-text');
      if (textSpan && qData.options[j]) textSpan.textContent = qData.options[j];
    });

    const whyBox = box.querySelector('.why');
    if (whyBox && !whyBox.hidden) {
      whyBox.innerHTML = `
        <p><strong>${currentLang === 'en' ? 'Explanation' : 'Explicación'}:</strong> ${esc(qData.explanation)}</p>
        <p class="muted" style="color:#64748b; font-size:0.85rem; margin-top:4px;">${currentLang === 'en' ? 'From source' : 'Del texto'}: "${esc(q.source_excerpt)}"</p>
      `;
    }
  });
}

function attachQuizOptionHandlers() {
  const qs = state.quizData;
  let done = 0, right = 0;

  document.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    const i = +b.dataset.q, j = +b.dataset.o, q = qs[i], box = $('q' + i);
    if (box.dataset.done) return;
    box.dataset.done = '1';

    box.querySelectorAll('.opt').forEach((o, k) => {
      if (k === q.answer_index) {
        o.style.backgroundColor = '#dcfce7';
        o.style.borderColor = '#16a34a';
        o.style.color = '#15803d';
      } else if (k === j) {
        o.style.backgroundColor = '#fee2e2';
        o.style.borderColor = '#dc2626';
        o.style.color = '#b91c1c';
      }
    });

    const currentLang = state.quizLang;
    const qData = q[currentLang] || q.en;
    const w = box.querySelector('.why');
    w.hidden = false;
    w.innerHTML = `
      <p><strong>${currentLang === 'en' ? 'Explanation' : 'Explicación'}:</strong> ${esc(qData.explanation)}</p>
      <p class="muted" style="color:#64748b; font-size:0.85rem; margin-top:4px;">${currentLang === 'en' ? 'From source' : 'Del texto'}: "${esc(q.source_excerpt)}"</p>
    `;

    const s = state.score[q.topic] ||= { right: 0, total: 0 };
    s.total++;
    done++;
    if (j === q.answer_index) { s.right++; right++; }

    localStorage.setItem('ll_score', JSON.stringify(state.score));
    if (done === qs.length) {
      $('sc').textContent = `Puntuación: ${right} de ${qs.length} correctas. ` + weakest();
    }
  });
}

function weakest() {
  const w = Object.entries(state.score)
    .filter(([, s]) => s.total >= 2)
    .sort((a, b) => a[1].right / a[1].total - b[1].right / b[1].total)[0];
  return w ? `Tema sugerido para repasar: ${w[0]}.` : '';
}

// ---- Initialization & Incoming Auto-Import
(async () => {
  const ok = await loadFromExtension();
  if (!ok) state.words = load('ll_words', []);

  // Auto-detect imported webpage sent by the extension
  if (state.pendingPage?.text) {
    const tx = $('tx');
    if (tx) tx.value = state.pendingPage.text;
    const who = $('who');
    if (who) {
      who.innerHTML = `📥 <strong>Página importada:</strong> "${esc(state.pendingPage.title || 'Artículo web')}". Lista para crear guía en <strong>${esc(state.native)}</strong>.`;
    }
    const notesTab = document.querySelector('[data-tab="notes"]');
    if (notesTab) notesTab.click();
  } else {
    const who = $('who');
    if (who) {
      who.textContent = ok
        ? `Conectado a la extensión. Guías en ${state.native}, inglés nivel ${state.level}.`
        : 'Extensión no detectada. Mostrando copia guardada de tus palabras y notas.';
    }
  }

  renderWords();
  renderNotes();
})();
