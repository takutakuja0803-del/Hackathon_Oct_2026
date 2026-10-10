// ============================================================
// Lecture Lens - extension/background.js
// Context Menu & Tab Management
// ============================================================

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'll_create_study_guide',
    title: '📖 Create Study Guide in Lecture Lens',
    contexts: ['page', 'selection']
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'll_create_study_guide' && tab?.id) {
    await sendPageToLectureLens(tab);
  }
});

chrome.action?.onClicked?.addListener(async (tab) => {
  if (tab?.id) {
    await sendPageToLectureLens(tab);
  }
});

async function sendPageToLectureLens(tab) {
  try {
    const { siteUrl = 'http://localhost:5173' } = await chrome.storage.local.get({ siteUrl: 'http://localhost:5173' });
    const appUrl = siteUrl.replace(/\/+$/, '');

    const response = await chrome.tabs.sendMessage(tab.id, { action: 'extract_page' });
    if (response?.text) {
      await chrome.storage.local.set({ pending_page: response });

      const existingTabs = await chrome.tabs.query({ url: `${appUrl}/*` });
      if (existingTabs.length > 0) {
        await chrome.tabs.update(existingTabs[0].id, { active: true });
        await chrome.tabs.reload(existingTabs[0].id);
      } else {
        await chrome.tabs.create({ url: appUrl });
      }
    }
  } catch (err) {
    console.error('[Lecture Lens] Extraction error:', err);
  }
}