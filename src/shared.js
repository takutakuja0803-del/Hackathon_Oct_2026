export const DEFAULT_SETTINGS = {
  nativeLanguage: "Spanish",
  readingLevel: "plain",
  subject: "",
  apiBaseUrl: "http://localhost:8787"
};

export const DEMO_EXPLANATION = {
  original: "",
  plainEnglish: "This is a simpler explanation of the selected text.",
  translation: "A translation will appear here when an API is connected.",
  example: "Try connecting the idea to a familiar real-world example.",
  source: "demo"
};

export async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
