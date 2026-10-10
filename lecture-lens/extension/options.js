const F = ['native', 'level', 'subject', 'siteUrl'];
const D = { native: 'Spanish', level: 'intermediate', subject: 'general', siteUrl: 'http://localhost:5173' };
chrome.storage.local.get(D).then(s => F.forEach(k => document.getElementById(k).value = s[k]));
document.getElementById('save').onclick = async () => {
  await chrome.storage.local.set(Object.fromEntries(F.map(k => [k, document.getElementById(k).value.trim() || D[k]])));
  document.getElementById('ok').textContent = 'Saved';
};
