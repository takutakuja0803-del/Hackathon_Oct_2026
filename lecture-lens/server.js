// Run: ANTHROPIC_API_KEY=sk-ant-... node server.js  -> http://localhost:5173
// Serves the review website and proxies LLM calls so the key never ships in the extension.
const http = require('http'), fs = require('fs'), path = require('path');
const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) {
  console.error('Missing ANTHROPIC_API_KEY environment variable. Set it and restart.');
  process.exit(1);
}
const PORT = process.env.PORT || 5173;
const WEB = path.join(__dirname, 'website');
const MODELS = { fast: 'claude-haiku-5-5', smart: 'claude-sonnet-5-5' };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const MAX_OUTPUT = 8000;   // upper limit for max_tokens a request may ask for

// One call to the Anthropic API. Returns the HTTP response and the parsed JSON body.
async function callAnthropic({ model, max_tokens, system, content }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': KEY
    },
    body: JSON.stringify({
      model,
      max_tokens,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content }]
    })
  });
  const d = await r.json();
  return { r, d };
}

const textOf = (d) => (Array.isArray(d.content) ? d.content : []).filter(x => x.type === 'text').map(x => x.text).join('');

// mode "ast_explain": bilingual, line-by-line walkthrough of a code or maths snippet (used by Visualized Systems)
function astExplainPrompt({ snippet, kind = 'code', nativeLanguage = 'Spanish' }) {
  const isMath = kind === 'math';
  const numbered = snippet.split('\n').map((line, i) => `${i + 1}| ${line}`).join('\n');
  return {
    system: `You are a patient tutor for international university students. Reply with ONLY one JSON object. No markdown, no code fences, no extra text.
Shape: {"eli5":{"english":"...","native":"..."},"steps":[{"line":1,"code":"...","english":"...","native":"..."}]}
- "eli5": what the whole snippet does, explained as if to a 5-year-old, in 2 to 4 short sentences. "english" is plain English; "native" says the same thing in ${nativeLanguage}.
- "steps": one entry per meaningful line, in order. "line" is the 1-based number shown before "|". "code" is that line's text without the number. "english" says in one or two plain sentences what this ${isMath ? 'transformation does to the graph (shift, stretch, reflection...)' : 'execution step changes in memory (variables, pointers, the stack and heap)'}; "native" says the same in ${nativeLanguage}.
- Skip blank lines, comments and lines with only a brace.
- Plain text only. No LaTeX; write maths like x^2, sqrt(x), 3/4.`,
    prompt: `${isMath ? 'Explain these equations' : 'Explain this code (detect its programming language)'}:\n\n${numbered}`
  };
}

http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.end();

  if (req.url === '/api/llm' && req.method === 'POST') {
    res.setHeader('content-type', 'application/json');
    try {
      let body = '';
      for await (const c of req) {
        body += c;
        if (body.length > 12000000) {
          res.statusCode = 413;
          return res.end(JSON.stringify({ error: 'Request too large' }));
        }
      }
      const request = JSON.parse(body);
      const { tier = 'fast', image, images } = request;
      let { system, prompt, max_tokens = 1000 } = request;
      if (request.mode === 'ast_explain') {
        if (typeof request.snippet !== 'string' || !request.snippet.trim()) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'ast_explain needs a non-empty "snippet" string.' }));
        }
        ({ system, prompt } = astExplainPrompt(request));
        max_tokens = Math.max(max_tokens, 3000);
      }
      const ALLOWED_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      const valid = (im) => im && typeof im.base64 === 'string' && ALLOWED_IMAGES.includes(im.media_type);
      // `images` (several pictures, used by the quiz) or `image` (one picture, used by the snip card)
      const pics = (Array.isArray(images) ? images : image ? [image] : []).filter(valid).slice(0, 6);
      const content = pics.length
        ? [
          ...pics.flatMap((im, i) => [
            ...(pics.length > 1 ? [{ type: 'text', text: `Picture ${i + 1}:` }] : []),
            { type: 'image', source: { type: 'base64', media_type: im.media_type, data: im.base64 } }
          ]),
          { type: 'text', text: prompt }
        ]
        : prompt;

      const model = MODELS[tier] || MODELS.fast;
      const req2 = { model, max_tokens: Math.min(max_tokens, MAX_OUTPUT), system, content };

      let { r, d } = await callAnthropic(req2);
      if (!r.ok) {
        res.statusCode = r.status;
        console.error('Anthropic API Error:', d);
        return res.end(JSON.stringify({ error: d.error?.message || 'API error' }));
      }

      let text = textOf(d);

      // Empty text without hitting the token limit: log it and try once more
      if (!text.trim() && d.stop_reason !== 'max_tokens' && d.stop_reason !== 'refusal') {
        console.warn('[empty reply, retrying once]', {
          model, tier, images: pics.length,
          imageKB: pics.map(p => Math.round(p.base64.length / 1024)),
          stop_reason: d.stop_reason,
          blockTypes: (d.content || []).map(x => x.type),
          usage: d.usage
        });
        ({ r, d } = await callAnthropic(req2));
        if (!r.ok) {
          res.statusCode = r.status;
          console.error('Anthropic API Error (retry):', d);
          return res.end(JSON.stringify({ error: d.error?.message || 'API error' }));
        }
        text = textOf(d);
      }

      if (!text.trim()) {
        console.error('[still empty after retry]', {
          model, tier, stop_reason: d.stop_reason,
          blockTypes: (d.content || []).map(x => x.type),
          usage: d.usage,
          raw: JSON.stringify(d).slice(0, 1500)
        });
      }

      return res.end(JSON.stringify({ text, stop_reason: d.stop_reason || 'unknown' }));
    } catch (e) {
      console.error('Server error:', e);
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  const f = path.join(WEB, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!f.startsWith(WEB + path.sep) || !fs.existsSync(f)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('content-type', TYPES[path.extname(f)] || 'text/plain');
  res.end(fs.readFileSync(f));
}).listen(PORT, () => console.log('Lecture Lens running at http://localhost:' + PORT));