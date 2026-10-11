const PROXY_URL = 'http://localhost:3001';
const MAX_NOTES = 100;

async function getSettings() {
  return chrome.storage.local.get({ targetLanguage: 'Spanish' });
}

async function getNotes() {
  const { notes = [] } = await chrome.storage.local.get({ notes: [] });
  return notes;
}

async function saveNote(note) {
  const notes = await getNotes();
  notes.unshift(note);
  await chrome.storage.local.set({ notes: notes.slice(0, MAX_NOTES) });
  return note;
}

// Sends text to the proxy server and stores the processed result.
async function processText(text, source = 'highlight') {
  const { targetLanguage } = await getSettings();
  const res = await fetch(`${PROXY_URL}/api/process`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, source, targetLanguage })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Proxy error ${res.status}`);
  return saveNote({ id: crypto.randomUUID(), text, createdAt: Date.now(), ...data });
}

function respond(promise, sendResponse) {
  promise
    .then((data) => sendResponse({ ok: true, data }))
    .catch((err) => sendResponse({ ok: false, error: err.message }));
  return true;
}

// Messages from the content script and popup.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.action === 'process') return respond(processText(msg.text, msg.source), sendResponse);
});

// Messages from the Bridge web app (origins listed in externally_connectable).
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  switch (msg?.action) {
    case 'getNotes':
      return respond(getNotes(), sendResponse);
    case 'saveNote':
      return respond(saveNote({ id: crypto.randomUUID(), createdAt: Date.now(), ...msg.note }), sendResponse);
    case 'process':
      return respond(processText(msg.text, msg.source), sendResponse);
    default:
      sendResponse({ ok: false, error: `Unknown action: ${msg?.action}` });
  }
});
