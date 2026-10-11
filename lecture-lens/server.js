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
      const { tier = 'fast', system, prompt, max_tokens = 1000, image, images } = JSON.parse(body);
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

      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': KEY
        },
        body: JSON.stringify({
          model: MODELS[tier] || MODELS.fast,
          max_tokens: Math.min(max_tokens, 4000),
          system,
          messages: [{ role: 'user', content }]
        })
      });
      const d = await r.json();
      if (!r.ok) {
        res.statusCode = r.status;
        console.error('Anthropic API Error:', d);
        return res.end(JSON.stringify({ error: d.error?.message || 'API error' }));
      }
      return res.end(JSON.stringify({ text: d.content.filter(x => x.type === 'text').map(x => x.text).join('') }));
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
