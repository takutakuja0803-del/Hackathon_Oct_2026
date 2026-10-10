# Lecture Lens

- `extension/`  Chrome extension: highlight text, get a plain-English explanation + translation, save words.
- `website/`    The Review site: notes with diagrams, word bank, quiz.
- `server.js`   Serves the site and proxies LLM calls (your API key stays here, not in the extension).

## Run it
1. `ANTHROPIC_API_KEY=your-key node server.js`  (Node 18+), then open http://localhost:5173
2. Chrome > chrome://extensions > turn on Developer mode > Load unpacked > pick the `extension` folder.
3. Click the extension's Details > Extension options and set your language, level, and subject.
4. Highlight text on any page > Explain > Save word > Review (or click the toolbar icon) to open the site.

## Deploying the site
Host `server.js` (Render, Railway, Fly) with ANTHROPIC_API_KEY set. Then:
- put the live URL in the extension options ("Review site address")
- add the same URL to `host_permissions` and the `bridge.js` `matches` in `extension/manifest.json`

## Not built yet
Lecture audio capture, per-topic spaced review, rate limiting on the proxy, and the visual quiz questions.
