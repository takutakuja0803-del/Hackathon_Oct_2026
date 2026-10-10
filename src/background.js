import { DEMO_EXPLANATION, getSettings } from "./shared.js";

const cacheKey = (text, settings) =>
  `explanation:${settings.nativeLanguage}:${settings.readingLevel}:${text.trim().toLowerCase()}`;

async function callProxy(path, payload) {
  const settings = await getSettings();
  const response = await fetch(`${settings.apiBaseUrl.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Clarify API returned ${response.status}`);
  }
  return response.json();
}

async function explain(text) {
  const settings = await getSettings();
  const key = cacheKey(text, settings);
  const cached = await chrome.storage.local.get(key);
  if (cached[key]) {
    await recordHistory({ type: "explanation", text, result: cached[key] });
    return { ...cached[key], source: "cache" };
  }

  try {
    const result = await callProxy("/v1/explain", {
      text,
      nativeLanguage: settings.nativeLanguage,
      readingLevel: settings.readingLevel,
      subject: settings.subject
    });
    const explanation = { ...result, original: text, source: "api" };
    await chrome.storage.local.set({ [key]: explanation });
    await recordHistory({ type: "explanation", text, result: explanation });
    return explanation;
  } catch (error) {
    // The extension remains useful offline, but the UI clearly labels the fallback.
    return {
      ...DEMO_EXPLANATION,
      original: text,
      plainEnglish: `Connect the Clarify API to explain “${text}”.`,
      translation: `No translation was generated because the API is unavailable.`,
      source: "offline",
      error: error.message
    };
  }
}

async function recordHistory(entry) {
  const stored = await chrome.storage.local.get(["history"]);
  const history = Array.isArray(stored.history) ? stored.history : [];
  history.unshift({ ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() });
  await chrome.storage.local.set({ history: history.slice(0, 100) });
}

async function saveMemory(memory) {
  const stored = await chrome.storage.local.get(["memories"]);
  const memories = Array.isArray(stored.memories) ? stored.memories : [];
  const item = { ...memory, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
  await chrome.storage.local.set({ memories: [item, ...memories].slice(0, 200) });
  await recordHistory({ type: "memory", text: memory.text, result: item });
  return item;
}

async function generateNotes(transcript) {
  try {
    const result = await callProxy("/v1/notes", transcript);
    await chrome.storage.local.set({ notes: result });
    return result;
  } catch (error) {
    throw new Error(`Notes pipeline unavailable: ${error.message}`);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "explain") {
    explain(message.text)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === "saveTranscript") {
    chrome.storage.local.set({ latestTranscript: message.transcript })
      .then(() => generateNotes(message.transcript))
      .then((notes) => sendResponse({ success: true, data: notes }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (message.action === "getNotes") {
    chrome.storage.local.get(["notes"]).then((result) => {
      sendResponse({ success: true, data: result.notes || null });
    });
    return true;
  }

  if (message.action === "getHistory" || message.action === "getMemories") {
    const key = message.action === "getHistory" ? "history" : "memories";
    chrome.storage.local.get([key]).then((result) => {
      sendResponse({ success: true, data: result[key] || [] });
    });
    return true;
  }

  if (message.action === "saveMemory") {
    saveMemory(message.memory)
      .then((memory) => sendResponse({ success: true, data: memory }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  const keys = {
    getTranslatedNotes: "notes",
    getClarifyHistory: "history",
    getClarifyMemories: "memories"
  };
  if (keys[message.action]) {
    chrome.storage.local.get([keys[message.action]]).then((result) => {
      sendResponse({ success: true, data: result[keys[message.action]] || (message.action === "getTranslatedNotes" ? null : []) });
    });
    return true;
  }
  if (message.action === "saveClarifyMemory") {
    saveMemory(message.memory)
      .then((memory) => sendResponse({ success: true, data: memory }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
});
