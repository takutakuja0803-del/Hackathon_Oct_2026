const LANGUAGES = [...document.getElementById('native').options].map(o => o.value).filter(v => v !== 'Other');
const F = ['level', 'subject', 'siteUrl', 'visualizerUrl'];
const D = {
  native: 'Spanish', level: 'intermediate', subject: 'general',
  siteUrl: 'http://localhost:5173', visualizerUrl: 'http://localhost:5174'
};
const nativeSelect = document.getElementById('native');
const nativeCustom = document.getElementById('nativeCustom');

function syncCustom() {
  nativeCustom.hidden = nativeSelect.value !== 'Other';
}

nativeSelect.onchange = syncCustom;

chrome.storage.local.get(D).then(s => {
  F.forEach(k => document.getElementById(k).value = s[k]);
  if (LANGUAGES.includes(s.native)) {
    nativeSelect.value = s.native;
    nativeCustom.value = '';
  } else {
    nativeSelect.value = 'Other';
    nativeCustom.value = s.native || '';
  }
  syncCustom();
});

document.getElementById('save').onclick = async () => {
  const native = nativeSelect.value === 'Other'
    ? (nativeCustom.value.trim() || D.native)
    : nativeSelect.value;
  const settings = Object.fromEntries(F.map(k => [k, document.getElementById(k).value.trim() || D[k]]));
  settings.native = native;
  settings.nativeAuto = false;
  await chrome.storage.local.set(settings);
  document.getElementById('ok').textContent = 'Saved';
};
