const extensionId = ""; // Set this after loading the unpacked extension in chrome://extensions.
const $ = (id) => document.querySelector(`#${id}`);

function unavailable(message) {
  $("connection").textContent = message;
}

function send(action, payload = {}) {
  return new Promise((resolve, reject) => {
    if (!window.chrome?.runtime?.sendMessage || !extensionId) {
      reject(new Error("Set extensionId in web-app/app.js and open this page from an allowed origin."));
      return;
    }
    chrome.runtime.sendMessage(extensionId, { action, ...payload }, (response) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else if (!response?.success) reject(new Error(response?.error || "Extension request failed"));
      else resolve(response.data);
    });
  });
}

async function load() {
  try {
    const [notes, memories, history] = await Promise.all([
      send("getTranslatedNotes"),
      send("getClarifyMemories"),
      send("getClarifyHistory")
    ]);
    $("connection").textContent = "Connected to Clarify extension";
    $("notes").innerHTML = notes?.topics?.length
      ? notes.topics.map((topic) => `<article><b>${topic.title}</b><p>${topic.summary}</p></article>`).join("")
      : "No lecture notes yet.";
    $("memories").innerHTML = memories.length
      ? memories.map((item) => `<article><p>${item.text}</p><small>${new Date(item.createdAt).toLocaleString()}</small></article>`).join("")
      : "No saved memories yet.";
    $("history").innerHTML = history.length
      ? history.slice(0, 20).map((item) => `<article><b>${item.type === "memory" ? "Memory saved" : "Text clarified"}</b><p>${item.text}</p><small>${new Date(item.createdAt).toLocaleString()}</small></article>`).join("")
      : "No history yet.";
  } catch (error) {
    unavailable(error.message);
  }
}

$("refresh").addEventListener("click", load);
load();
