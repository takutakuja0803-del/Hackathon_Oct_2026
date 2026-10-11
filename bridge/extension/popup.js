const captureBtn = document.getElementById('capture');
const captureStatus = document.getElementById('captureStatus');
const languageSelect = document.getElementById('targetLanguage');
const saved = document.getElementById('saved');

function renderCapture(capturing) {
  captureBtn.textContent = capturing ? 'Stop Lecture Capture' : 'Start Lecture Capture';
  captureBtn.classList.toggle('bg-red-600', capturing);
  captureBtn.classList.toggle('hover:bg-red-700', capturing);
  captureBtn.classList.toggle('bg-blue-600', !capturing);
  captureBtn.classList.toggle('hover:bg-blue-700', !capturing);
  captureStatus.textContent = capturing ? 'Capturing (mock)… no audio is recorded yet.' : 'Not capturing.';
}

chrome.storage.local.get({ targetLanguage: 'Spanish', capturing: false }).then(({ targetLanguage, capturing }) => {
  languageSelect.value = targetLanguage;
  renderCapture(capturing);
});

// Mock only: the Web Speech API (SpeechRecognition) will be started here later.
captureBtn.addEventListener('click', async () => {
  const { capturing } = await chrome.storage.local.get({ capturing: false });
  await chrome.storage.local.set({ capturing: !capturing });
  renderCapture(!capturing);
});

languageSelect.addEventListener('change', async () => {
  await chrome.storage.local.set({ targetLanguage: languageSelect.value });
  saved.textContent = 'Saved';
  setTimeout(() => { saved.textContent = ''; }, 1200);
});
