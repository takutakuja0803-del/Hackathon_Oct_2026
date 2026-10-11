# Bridge

Learning tool for international students: highlight text or capture a lecture, get an "Explain Like I'm 5" version in your language, study notes, and a diagram.

- `extension/` Chrome extension (Manifest V3): floating Bridge button, popup with lecture capture (mock) and target language.
- `web-app/` Next.js 15 App Router site: Mermaid diagrams (`components/DiagramRenderer.tsx`) and a quiz (`app/quiz`).
- `proxy-server/` Express server: `POST /api/process` keeps the LLM key off the client. Returns mock data until the LLM call is wired up.

## Run it

1. Proxy: `cd proxy-server && npm install && cp .env.example .env && npm start` (http://localhost:3001)
2. Web app: `cd web-app && npm install && npm run dev` (http://localhost:3000)
3. Extension: `chrome://extensions` > Developer mode > Load unpacked > pick `extension/`.

The web app can call the extension with `chrome.runtime.sendMessage(extensionId, { action: "getNotes" })`. Supported actions: `getNotes`, `saveNote`, `process`.
