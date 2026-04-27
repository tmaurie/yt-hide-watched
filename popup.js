const STORAGE_KEY = "yt_hide_watched_enabled";
const THRESHOLD_STORAGE_KEY = "yt_hide_watched_threshold";
const GRID_SIZE_STORAGE_KEY = "yt_hide_watched_grid_size";
const HIDE_SHORTS_KEY = "yt_hide_watched_hide_shorts";
const DEBUG_MODE_KEY = "yt_hide_watched_debug_mode";
const DEFAULT_THRESHOLD = 0.8;
const DEFAULT_GRID_SIZE = 4;
const DEFAULT_SETTINGS = {
  enabled: false,
  threshold: DEFAULT_THRESHOLD,
  gridSize: DEFAULT_GRID_SIZE,
  hideShorts: false,
  debugMode: false
};

const toggle = document.getElementById("toggle-enabled");
const slider = document.getElementById("threshold-slider");
const sliderValue = document.getElementById("threshold-value");
const shortsToggle = document.getElementById("toggle-shorts");
const debugToggle = document.getElementById("toggle-debug");
const gridSizeSelect = document.getElementById("select-grid-size");
const resetButton = document.getElementById("reset-settings");

function getStoredSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      [STORAGE_KEY, THRESHOLD_STORAGE_KEY, GRID_SIZE_STORAGE_KEY, HIDE_SHORTS_KEY, DEBUG_MODE_KEY],
      (res) => {
      const enabled = Boolean(res[STORAGE_KEY]);
      const stored = parseFloat(res[THRESHOLD_STORAGE_KEY]);
      const threshold = Number.isFinite(stored) ? stored : DEFAULT_THRESHOLD;
      const gridStored = parseInt(res[GRID_SIZE_STORAGE_KEY], 10);
      const gridSize = Number.isFinite(gridStored) ? gridStored : DEFAULT_GRID_SIZE;
      const hideShorts = Boolean(res[HIDE_SHORTS_KEY]);
      const debugMode = Boolean(res[DEBUG_MODE_KEY]);
      resolve({ enabled, threshold, gridSize, hideShorts, debugMode });
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

function setGridSize(value) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [GRID_SIZE_STORAGE_KEY]: value }, () => resolve());
  });
}

function setHideShorts(value) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [HIDE_SHORTS_KEY]: value }, () => resolve());
  });
}

function setDebugMode(value) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [DEBUG_MODE_KEY]: value }, () => resolve());
  });
}

function setDefaultSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.set({
      [STORAGE_KEY]: DEFAULT_SETTINGS.enabled,
      [THRESHOLD_STORAGE_KEY]: DEFAULT_SETTINGS.threshold,
      [GRID_SIZE_STORAGE_KEY]: DEFAULT_SETTINGS.gridSize,
      [HIDE_SHORTS_KEY]: DEFAULT_SETTINGS.hideShorts,
      [DEBUG_MODE_KEY]: DEFAULT_SETTINGS.debugMode
    }, () => resolve());
  });
}

function normalizeThreshold(value) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return DEFAULT_THRESHOLD;
  return Math.min(1, Math.max(0, parsed));
}

function normalizeGridSize(value) {
  const parsed = parseInt(value, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_GRID_SIZE;
  return Math.min(8, Math.max(4, parsed));
}

function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

async function init() {
  const { enabled, threshold, gridSize, hideShorts, debugMode } = await getStoredSettings();
  renderSettings({ enabled, threshold, gridSize, hideShorts, debugMode });
}

function renderSettings({ enabled, threshold, gridSize, hideShorts, debugMode }) {
  toggle.checked = enabled;
  slider.value = String(threshold);
  sliderValue.textContent = formatPercent(threshold);
  gridSizeSelect.value = String(normalizeGridSize(gridSize));
  shortsToggle.checked = hideShorts;
  debugToggle.checked = debugMode;
}

toggle.addEventListener("change", async (event) => {
  const checked = event.target.checked;
  await setEnabled(checked);
});

slider.addEventListener("input", (event) => {
  const next = normalizeThreshold(event.target.value);
  slider.value = String(next);
  sliderValue.textContent = formatPercent(next);
});

slider.addEventListener("change", async (event) => {
  const next = normalizeThreshold(event.target.value);
  slider.value = String(next);
  sliderValue.textContent = formatPercent(next);
  await setThreshold(next);
});

gridSizeSelect.addEventListener("change", async (event) => {
  const next = normalizeGridSize(event.target.value);
  gridSizeSelect.value = String(next);
  await setGridSize(next);
});

shortsToggle.addEventListener("change", async (event) => {
  const checked = event.target.checked;
  await setHideShorts(checked);
});

debugToggle.addEventListener("change", async (event) => {
  const checked = event.target.checked;
  await setDebugMode(checked);
});

resetButton.addEventListener("click", async () => {
  await setDefaultSettings();
  renderSettings(DEFAULT_SETTINGS);
});

init();
