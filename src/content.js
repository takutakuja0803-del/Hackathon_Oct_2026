const host = document.createElement("div");
host.id = "clarify-extension-root";
const shadow = host.attachShadow({ mode: "closed" });
shadow.innerHTML = `
  <style>
    :host { all: initial; }
    .wrap { position: fixed; z-index: 2147483647; font: 14px -apple-system, BlinkMacSystemFont, sans-serif; }
    button { border: 0; cursor: pointer; color: white; background: #5b4bdb; border-radius: 999px; padding: 10px 14px; font-weight: 700; box-shadow: 0 5px 18px #17132755; }
    button:hover { background: #4434bd; }
    .popup { display: none; width: 300px; margin-top: 8px; padding: 16px; color: #17202a; background: white; border: 1px solid #e7e4f6; border-radius: 14px; box-shadow: 0 12px 35px #17132730; }
    .popup.open { display: block; }
    h3 { margin: 0 0 10px; font-size: 16px; } p { margin: 8px 0; line-height: 1.45; } .label { color: #665e82; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; font-weight: 700; }
    .error { color: #a03838; font-size: 12px; }
  </style>
  <div class="wrap">
    <button id="clarify">✨ Clarify</button>
    <section class="popup" id="popup" role="dialog" aria-live="polite">
      <h3>Clarify this</h3><div id="body"><p>Select a word or phrase first.</p></div>
    </section>
  </div>
`;

document.documentElement.append(host);
const wrap = shadow.querySelector(".wrap");
const popup = shadow.querySelector("#popup");
const body = shadow.querySelector("#body");
const button = shadow.querySelector("#clarify");

function positionButton() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const rect = selection.getRangeAt(0).getBoundingClientRect();
  wrap.style.left = `${Math.min(window.innerWidth - 120, Math.max(8, rect.left))}px`;
  wrap.style.top = `${Math.max(8, rect.bottom + 8)}px`;
}

document.addEventListener("mouseup", () => {
  if (window.getSelection()?.toString().trim()) {
    positionButton();
    button.style.display = "inline-block";
  }
});

button.addEventListener("click", () => {
  const text = window.getSelection()?.toString().trim();
  if (!text) return;
  popup.classList.add("open");
  body.innerHTML = "<p>Thinking…</p>";
  chrome.runtime.sendMessage({ action: "explain", text }, (response) => {
    if (chrome.runtime.lastError || !response?.success) {
      body.innerHTML = `<p class="error">${chrome.runtime.lastError?.message || response?.error || "Unable to clarify this text."}</p>`;
      return;
    }
    const data = response.data;
    body.innerHTML = `
      <div class="label">Plain English</div><p>${data.plainEnglish}</p>
      <div class="label">In your language</div><p>${data.translation}</p>
      <div class="label">Example</div><p>${data.example || "No example returned."}</p>
      ${data.source === "offline" ? `<p class="error">API unavailable; showing an offline placeholder.</p>` : ""}
    `;
  });
});
