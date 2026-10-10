# Clarify extension prototype

Clarify is a Manifest V3 Chrome extension prototype for international students. It provides:

- A Shadow DOM floating **Clarify** button for selected text.
- A service worker that owns API calls, local explanation caching, and website messaging.
- Settings for native language, reading level, subject, and the proxy URL.
- A notes page with Web Speech API live capture fallback.
- A shared notes/visual JSON rendering surface and a practice page.
- Persistent local memory and a capped history of explanations and saved concepts.
- A web companion app in `web-app/` that reads notes, memories, and history through `runtime.onMessageExternal`.

## Run it

1. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select this folder.
2. Open the extension options and set the URL for your proxy.
3. Select text on any page and choose **Clarify**.

The extension intentionally does not contain an LLM key. The service worker calls `POST /v1/explain` on the configured proxy:

```json
{
  "text": "selected text",
  "nativeLanguage": "Spanish",
  "readingLevel": "plain",
  "subject": "computer science"
}
```

Expected response:

```json
{
  "original": "selected text",
  "plainEnglish": "A short explanation.",
  "translation": "La traducción.",
  "example": "A concrete example."
}
```

The notes page sends the captured transcript to `POST /v1/notes`. The proxy should return:

```json
{
  "topics": [{
    "title": "Topic title",
    "summary": "Plain-English summary at the selected reading level.",
    "sourceExcerpt": "Supporting transcript excerpt.",
    "keyTerms": [{
      "term": "Term",
      "definition": "Plain-English definition.",
      "translation": "Native-language translation"
    }],
    "visual": {
      "type": "flowchart",
      "content": "Step 1 -> Step 2",
      "mermaidEnglish": "flowchart TD; A[Step 1] --> B[Step 2];",
      "mermaidNative": "flowchart TD; A[ Paso 1 ] --> B[ Paso 2 ];"
    }
  }]
}
```

If the API is unavailable, the UI shows an explicitly labeled offline placeholder instead of hiding the failure. Add your production website to `externally_connectable.matches` in `manifest.json`; it can request notes with `chrome.runtime.sendMessage(extensionId, { action: "getTranslatedNotes" })`.

## Persistent memory and web app

The service worker stores up to 200 memories and 100 history entries in `chrome.storage.local`. The web app must be served from an origin listed in `externally_connectable.matches`. Set its extension ID in `web-app/app.js`, then serve the folder with any static server, for example `python3 -m http.server 3000 --directory web-app`.

Supported external messages are:

- `{ action: "getTranslatedNotes" }`
- `{ action: "getClarifyHistory" }`
- `{ action: "getClarifyMemories" }`
- `{ action: "saveClarifyMemory", memory: { text, source } }`
