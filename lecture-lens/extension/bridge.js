// Runs only on the review site. Lets the page read saved words, settings, and pending extracted pages.
window.addEventListener('message', async (e) => {
  if (e.source !== window || e.data?.ll !== 'get') return;

  try {
    const data = await chrome.storage.local.get(['words', 'native', 'level', 'subject', 'pending_page']);

    window.postMessage({
      ll: 'data',
      data: {
        words: data.words || [],
        native: data.native || 'Spanish',
        level: data.level || 'intermediate',
        subject: data.subject || 'general',
        pendingPage: data.pending_page || null
      }
    }, '*');

    // Remove pending page once sent so subsequent page reloads don't overwrite
    if (data.pending_page) {
      await chrome.storage.local.remove('pending_page');
    }
  } catch (err) {
    console.error('[Lecture Lens] Sync error:', err);
  }
});

window.postMessage({ ll: 'ready' }, '*');