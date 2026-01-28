const STORAGE_KEY = "yt_hide_watched_enabled";
const THRESHOLD_STORAGE_KEY = "yt_hide_watched_threshold";
const GRID_SIZE_STORAGE_KEY = "yt_hide_watched_grid_size";
const DEFAULT_THRESHOLD = 0.8;
const DEFAULT_GRID_SIZE = 4;

const toggle = document.getElementById("toggle-enabled");
const slider = document.getElementById("threshold-slider");
const sliderValue = document.getElementById("threshold-value");
const gridSizeSelect = document.getElementById("select-grid-size");

function getStoredSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get([STORAGE_KEY, THRESHOLD_STORAGE_KEY, GRID_SIZE_STORAGE_KEY], (res) => {
      const enabled = Boolean(res[STORAGE_KEY]);
      const stored = parseFloat(res[THRESHOLD_STORAGE_KEY]);
      const threshold = Number.isFinite(stored) ? stored : DEFAULT_THRESHOLD;
      const gridStored = parseInt(res[GRID_SIZE_STORAGE_KEY], 10);
      const gridSize = Number.isFinite(gridStored) ? gridStored : DEFAULT_GRID_SIZE;
      resolve({ enabled, threshold, gridSize });
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
  const { enabled, threshold, gridSize } = await getStoredSettings();
  toggle.checked = enabled;
  slider.value = String(threshold);
  sliderValue.textContent = formatPercent(threshold);
  gridSizeSelect.value = String(normalizeGridSize(gridSize));
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

init();
