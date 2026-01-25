const STORAGE_KEY = "yt_hide_watched_enabled";
const THRESHOLD_STORAGE_KEY = "yt_hide_watched_threshold";
const DEFAULT_THRESHOLD = 0.8;

const toggle = document.getElementById("toggle-enabled");
const select = document.getElementById("select-threshold");

function getStoredSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY, THRESHOLD_STORAGE_KEY], (res) => {
      const enabled = Boolean(res[STORAGE_KEY]);
      const stored = parseFloat(res[THRESHOLD_STORAGE_KEY]);
      const threshold = Number.isFinite(stored) ? stored : DEFAULT_THRESHOLD;
      resolve({ enabled, threshold });
    });
  });
}

function setEnabled(value) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [STORAGE_KEY]: value }, () => resolve());
  });
}

function setThreshold(value) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [THRESHOLD_STORAGE_KEY]: value }, () => resolve());
  });
}

function normalizeThreshold(value) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return DEFAULT_THRESHOLD;
  return parsed;
}

async function init() {
  const { enabled, threshold } = await getStoredSettings();
  toggle.checked = enabled;
  select.value = String(threshold);
}

toggle.addEventListener("change", async (event) => {
  const checked = event.target.checked;
  await setEnabled(checked);
});

select.addEventListener("change", async (event) => {
  const next = normalizeThreshold(event.target.value);
  select.value = String(next);
  await setThreshold(next);
});

init();
