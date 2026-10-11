// ============================================================
// Lecture Lens - extension/background.js
// Opens the hub page + Snip tool + Server relay
// ============================================================

const hubUrl = (tab) => chrome.runtime.getURL('hub.html') + (tab ? '#' + tab : '');

async function openHub(tab) {
  const existing = await chrome.tabs.query({ url: chrome.runtime.getURL('hub.html') + '*' });
  if (existing.length) {
    await chrome.tabs.update(existing[0].id, { active: true, url: hubUrl(tab) });
    await chrome.windows.update(existing[0].windowId, { focused: true });
    if (tab) await chrome.tabs.reload(existing[0].id);
  } else {
    await chrome.tabs.create({ url: hubUrl(tab) });
  }
}

// Clicking the toolbar icon opens your history / study guide / quiz (inside the extension)
chrome.action.onClicked.addListener(() => openHub());

// ------------------------------------------------------------
// Snip tool: keyboard shortcut (Alt+Shift+S) starts the highlighter on the page
// ------------------------------------------------------------
chrome.commands.onCommand.addListener(async (command, tab) => {
  const mode = { 'start-snip': 'auto', 'start-snip-solve': 'solve' }[command];
  if (!mode) return;
  const t = tab || (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
  if (!t || !t.id) return;
  try {
    await chrome.tabs.sendMessage(t.id, { action: 'start_snip', mode });
  } catch (e) {
    console.warn('[Lecture Lens] Snip tool could not start on this tab (restricted page, or the page needs a refresh).', e);
  }
});

// ------------------------------------------------------------
// Messages from content.js
// ------------------------------------------------------------
chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {

  if (req.type === 'open_hub') {
    openHub(req.tab);
    return false;
  }

  // Screenshot the visible tab, crop to the dragged rectangle, return it as a base64 JPEG
  if (req.type === 'capture_region') {
    (async () => {
      try {
        const shot = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'png' });
        const bmp = await createImageBitmap(await (await fetch(shot)).blob());

        const scale = bmp.width / req.viewportWidth;        // handles retina screens and browser zoom
        const sx = Math.max(0, Math.round(req.rect.x * scale));
        const sy = Math.max(0, Math.round(req.rect.y * scale));
        const sw = Math.max(1, Math.min(Math.round(req.rect.w * scale), bmp.width - sx));
        const sh = Math.max(1, Math.min(Math.round(req.rect.h * scale), bmp.height - sy));

        const maxW = 1600;                                  // keep uploads reasonably small
        const outW = Math.min(sw, maxW);
        const outH = Math.max(1, Math.round(sh * (outW / sw)));

        const canvas = new OffscreenCanvas(outW, outH);
        canvas.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, outW, outH);
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 });

        const bytes = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        }
        sendResponse({ ok: true, base64: btoa(bin), media_type: 'image/jpeg' });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true; // keep the message channel open for the async reply
  }

  // Shrink an image before it is saved to history (keeps storage small but still readable)
  if (req.type === 'shrink_image') {
    (async () => {
      try {
        const { base64, media_type } = req.image;
        const bmp = await createImageBitmap(await (await fetch(`data:${media_type};base64,${base64}`)).blob());
        const maxW = 1000;
        const scale = Math.min(1, maxW / bmp.width);
        const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
        const canvas = new OffscreenCanvas(w, h);
        canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        sendResponse({ ok: true, base64: btoa(bin), media_type: 'image/jpeg' });
      } catch (e) {
        sendResponse({ ok: false, error: e.message });
      }
    })();
    return true;
  }

  // Relay requests to your local server (avoids Chrome's per-site "access other apps" prompt)
  if (req.type === 'llm') {
    fetch(req.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req.payload)
    })
      .then(async (r) => sendResponse({ ok: r.ok, data: await r.json() }))
      .catch((e) => sendResponse({ ok: false, networkError: true, data: { error: e.message } }));
    return true;
  }
});
