const STORAGE_KEY = "yt_hide_watched_enabled";
const THRESHOLD_STORAGE_KEY = "yt_hide_watched_threshold";
const GRID_SIZE_STORAGE_KEY = "yt_hide_watched_grid_size";
const HIDE_SHORTS_KEY = "yt_hide_watched_hide_shorts";

const TOPBAR_BTN_ID = "yt-hide-watched-pill-btn";

const HIDE_CLASS = "yt-hide-watched__hidden";
const DIM_CLASS = "yt-hide-watched__dim";
const BADGE_CLASS = "yt-hide-watched__badge";
const BUTTON_CLASS = "yt-hide-watched__pill";

const DEFAULT_THRESHOLD = 0.8;
const DEFAULT_GRID_SIZE = 4;

const CARD_CONTAINERS = [
    "ytd-rich-item-renderer",      // Home grid items
    "ytd-rich-grid-media",         // Home card
    "ytd-video-renderer",          // Search
    "ytd-grid-video-renderer",     // Channel grid
    "ytd-compact-video-renderer",  // Sidebar suggestions
    "ytd-playlist-video-renderer"  // Playlists
].join(",");

function waitForElement(selector, { timeout = 15000 } = {}) {
    return new Promise((resolve) => {
        const el = document.querySelector(selector);
        if (el) return resolve(el);

        const obs = new MutationObserver(() => {
            const found = document.querySelector(selector);
            if (found) {
                obs.disconnect();
                resolve(found);
            }
        });

        obs.observe(document.documentElement, { childList: true, subtree: true });

        if (timeout) {
            setTimeout(() => {
                obs.disconnect();
                resolve(null);
            }, timeout);
        }
    });
}

function buildPillButton(enabled) {
    const btn = document.createElement("button");
    btn.id = TOPBAR_BTN_ID;
    btn.type = "button";

    btn.textContent = enabled ? "Vues : cachees" : "Vues : grisees";
    btn.setAttribute("aria-label", enabled ? "Mode cacher les videos vues" : "Mode griser les videos vues");
    btn.textContent = enabled ? "Vues : cachees" : "Vues : grisees";
    btn.setAttribute("aria-label", enabled ? "Mode cacher les videos vues" : "Mode griser les videos vues");
    btn.className = BUTTON_CLASS;

    btn.setAttribute(
        "aria-label",
        enabled ? "Masquer vidéos vues activé" : "Masquer vidéos vues désactivé"
    );

    btn.textContent = enabled ? "Vues masquées" : "Vues visibles";

    btn.textContent = enabled ? "Vues : cachees" : "Vues : grisees";
    btn.setAttribute("aria-label", enabled ? "Mode cacher les videos vues" : "Mode griser les videos vues");
    btn.dataset.mode = enabled ? "hide" : "dim";

    btn.addEventListener("click", async () => {
        const next = !(await getEnabled());
        await setEnabled(next);
        updatePillButton(next);
        const [threshold, hideShorts] = await Promise.all([getThreshold(), getHideShorts()]);
        applyMode(next, threshold, hideShorts);
    });

    return btn;
}


function updatePillButton(enabled) {
    const btn = document.getElementById(TOPBAR_BTN_ID);
    if (!btn) return;

    btn.textContent = enabled ? "Vues : cachees" : "Vues : grisees";
    btn.setAttribute("aria-label", enabled ? "Mode cacher les videos vues" : "Mode griser les videos vues");

    btn.textContent = enabled ? "Vues : cachées" : "Vues : grisées";
    btn.setAttribute("aria-label", enabled ? "Mode cacher les vidéos vues" : "Mode griser les vidéos vues");

    btn.className = BUTTON_CLASS;
    btn.dataset.mode = enabled ? "hide" : "dim";
    btn.textContent = enabled ? "Vues : cachees" : "Vues : grisees";
    btn.setAttribute("aria-label", enabled ? "Mode cacher les videos vues" : "Mode griser les videos vues");
}


async function ensurePillButton(enabled) {
    const end = await waitForElement("#masthead #end");
    if (!end) return;

    // Déjà présent → update seulement
    if (document.getElementById(TOPBAR_BTN_ID)) {
        updatePillButton(enabled);
        return;
    }

    // Bouton "Créer"
    const createBtn = [...end.querySelectorAll("button")]
        .find(b => b.textContent?.includes("Créer"));

    const pill = buildPillButton(enabled);

    if (createBtn && createBtn.parentElement) {
        createBtn.parentElement.insertBefore(pill, createBtn);
    } else {
        // fallback safe
        end.prepend(pill);
    }
}

function ensureBadge(targetCard) {
    // targetCard = le container qu’on “dim” (ou qu’on cache)
    // On cherche une zone miniature / thumbnail pour y mettre un badge
    const thumb =
        targetCard.querySelector("ytd-thumbnail") ||
        targetCard.querySelector("#thumbnail") ||
        targetCard;

    // Important : position relative pour que le badge soit bien ancré
    if (thumb instanceof HTMLElement) {
        const computed = getComputedStyle(thumb);
        if (computed.position === "static") thumb.style.position = "relative";
    }

    if (thumb.querySelector(`.${BADGE_CLASS}`)) return;

    const badge = document.createElement("div");
    badge.className = BADGE_CLASS;
    badge.textContent = "Déjà vue";
    thumb.appendChild(badge);
}

function removeBadge(targetCard) {
    const badge = targetCard.querySelector(`.${BADGE_CLASS}`);
    if (badge) badge.remove();
}

function applyMode(enabled, threshold = DEFAULT_THRESHOLD, hideShorts = false) {
    const containers = document.querySelectorAll(CARD_CONTAINERS);

    containers.forEach((container) => {
        const isShort = isShortVideo(container);
        const watched = isWatchedWithin(container, threshold);
        const target = getBestHideTarget(container);

        if (!(target instanceof HTMLElement)) return;

        if (hideShorts && isShort) {
            target.classList.add(HIDE_CLASS);
            target.classList.remove(DIM_CLASS);
            removeBadge(target);
            target.setAttribute("data-yt-hide-watched", "hide-short");
            return;
        }

        if (watched) {
            if (enabled) {
                // MODE HIDE
                target.classList.add(HIDE_CLASS);
                target.classList.remove(DIM_CLASS);
                removeBadge(target);
                target.setAttribute("data-yt-hide-watched", "hide");
            } else {
                // MODE VISIBLE (grisé)
                target.classList.remove(HIDE_CLASS);
                target.classList.add(DIM_CLASS);
                ensureBadge(target);
                target.setAttribute("data-yt-hide-watched", "dim");
            }
        } else {
            // Pas watched → on nettoie ce qu’on aurait appliqué
            target.classList.remove(HIDE_CLASS);
            target.classList.remove(DIM_CLASS);
            removeBadge(target);
            target.removeAttribute("data-yt-hide-watched");
        }
    });
}



function ensureStyles() {
    if (document.getElementById("yt-hide-watched-style")) return;

    const style = document.createElement("style");
    style.id = "yt-hide-watched-style";
    style.textContent = `
    .${BUTTON_CLASS} {
      appearance: none !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      min-width: 118px !important;
      height: 36px !important;
      margin-right: 8px !important;
      padding: 0 14px !important;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      border-radius: 18px !important;
      background: #0f0f0f !important;
      color: #ffffff !important;
      font: 600 14px/1.2 Roboto, Arial, sans-serif !important;
      cursor: pointer !important;
      white-space: nowrap !important;
      box-shadow: none !important;
      transition: background 120ms ease, color 120ms ease, border-color 120ms ease !important;
    }
    .${BUTTON_CLASS}:hover {
      background: #272727 !important;
    }
    .${BUTTON_CLASS}:focus-visible {
      outline: 2px solid #3ea6ff !important;
      outline-offset: 2px !important;
    }
    .${BUTTON_CLASS}[data-mode="dim"] {
      background: #f2f2f2 !important;
      border-color: #d9d9d9 !important;
      color: #0f0f0f !important;
    }
    .${BUTTON_CLASS}[data-mode="dim"]:hover {
      background: #e5e5e5 !important;
    }

    .${HIDE_CLASS} { display: none !important; }

    .${DIM_CLASS} {
      filter: grayscale(1) saturate(0.2);
      opacity: 0.45;
      transition: opacity 120ms ease, filter 120ms ease;
    }
    .${DIM_CLASS}:hover {
      opacity: 0.75;
      filter: grayscale(0.6) saturate(0.6);
    }

    .${BADGE_CLASS}{
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 3;
      font-size: 12px;
      line-height: 1;
      padding: 6px 8px;
      border-radius: 999px;
      background: rgba(0,0,0,0.72);
      color: white;
      pointer-events: none;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    }
  `;
    document.documentElement.appendChild(style);
}

function applyGridSize(size = DEFAULT_GRID_SIZE) {
    const clamped = Math.min(8, Math.max(4, Number(size) || DEFAULT_GRID_SIZE));
    let style = document.getElementById("yt-hide-watched-grid-style");
    if (!style) {
        style = document.createElement("style");
        style.id = "yt-hide-watched-grid-style";
        document.documentElement.appendChild(style);
    }

    style.textContent = `
    ytd-rich-grid-renderer {
      --ytd-rich-grid-items-per-row: ${clamped} !important;
      --ytd-rich-grid-slim-items-per-row: ${clamped} !important;
    }
    ytd-rich-grid-renderer #contents {
      grid-template-columns: repeat(${clamped}, minmax(0, 1fr)) !important;
    }
    ytd-rich-grid-row,
    ytd-rich-grid-renderer #contents ytd-rich-grid-row {
      grid-template-columns: repeat(${clamped}, minmax(0, 1fr)) !important;
      display: contents !important;
    }
  `;
}

function getEnabled() {
    return new Promise((resolve) => {
        chrome.storage.sync.get([STORAGE_KEY], (res) => resolve(Boolean(res[STORAGE_KEY])));
    });
}
function setEnabled(value) {
    return new Promise((resolve) => {
        chrome.storage.sync.set({ [STORAGE_KEY]: value }, () => resolve());
    });
}

function getThreshold() {
    return new Promise((resolve) => {
        chrome.storage.sync.get([THRESHOLD_STORAGE_KEY], (res) => {
            const stored = parseFloat(res[THRESHOLD_STORAGE_KEY]);
            const value = Number.isFinite(stored) ? stored : DEFAULT_THRESHOLD;
            resolve(clamp01(value) ?? DEFAULT_THRESHOLD);
        });
    });
}

function getGridSize() {
    return new Promise((resolve) => {
        chrome.storage.sync.get([GRID_SIZE_STORAGE_KEY], (res) => {
            const stored = parseInt(res[GRID_SIZE_STORAGE_KEY], 10);
            const value = Number.isFinite(stored) ? stored : DEFAULT_GRID_SIZE;
            resolve(Math.min(8, Math.max(4, value)));
        });
    });
}

function getHideShorts() {
    return new Promise((resolve) => {
        chrome.storage.sync.get([HIDE_SHORTS_KEY], (res) => resolve(Boolean(res[HIDE_SHORTS_KEY])));
    });
}

function isWatchedWithin(container, threshold = DEFAULT_THRESHOLD) {
    const progress = getWatchProgress(container);
    if (progress !== null) return progress >= threshold;

    return Boolean(
        container.querySelector("ytd-thumbnail-overlay-resume-playback-renderer") ||
        container.querySelector("yt-thumbnail-overlay-progress-bar-view-model") ||
        container.querySelector("#progress")
    );
}

function isShortVideo(container) {
    if (container.closest("ytd-reel-item-renderer")) return true;
    return Boolean(container.querySelector("a#thumbnail[href*='/shorts/']"));
}

function getWatchProgress(container) {
    const directProgressEl =
        container.querySelector("ytd-thumbnail-overlay-resume-playback-renderer #progress") ||
        container.querySelector("#progress");
    const fromDirect = extractProgressFromElement(directProgressEl);
    if (fromDirect !== null) return fromDirect;

    const progressBarRole = container.querySelector("[role='progressbar'][aria-valuenow]");
    const fromAria = extractProgressFromAria(progressBarRole);
    if (fromAria !== null) return fromAria;

    const viewModel = container.querySelector("yt-thumbnail-overlay-progress-bar-view-model");
    const fromViewModel = extractProgressFromElement(viewModel);
    if (fromViewModel !== null) return fromViewModel;

    return null;
}

function extractProgressFromAria(el) {
    if (!el) return null;

    const min = parseFloat(el.getAttribute("aria-valuemin") || "0");
    const max = parseFloat(el.getAttribute("aria-valuemax") || "100");
    const now = parseFloat(el.getAttribute("aria-valuenow") || "0");
    const range = max - min;

    if (!Number.isFinite(range) || range <= 0) return null;

    const normalized = (now - min) / range;
    return clamp01(normalized);
}

function extractProgressFromElement(el) {
    if (!el) return null;

    const computed = getComputedStyle(el);
    const transform = el.style.transform || computed.transform;
    const scale = parseScaleX(transform);
    if (scale !== null) return scale;

    const widthStyle = el.style.width;
    const widthMatch = widthStyle && widthStyle.match(/([\d.]+)%/);
    if (widthMatch) {
        const pct = parseFloat(widthMatch[1]) / 100;
        const clamped = clamp01(pct);
        if (clamped !== null) return clamped;
    }

    return null;
}

function parseScaleX(transform) {
    if (!transform || transform === "none") return null;

    const scaleMatch = transform.match(/scaleX\(([-\d.]+)\)/);
    if (scaleMatch) return clamp01(parseFloat(scaleMatch[1]));

    const matrixMatch = transform.match(/matrix\(([-\d.]+),/);
    if (matrixMatch) return clamp01(parseFloat(matrixMatch[1]));

    return null;
}

function clamp01(num) {
    const n = Number(num);
    if (!Number.isFinite(n)) return null;
    return Math.min(1, Math.max(0, n));
}

function getBestHideTarget(container) {
    return container.closest("ytd-rich-item-renderer") || container;
}


function debounce(fn, delay = 250) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    };
}

async function boot() {
    ensureStyles();

    const [enabled, threshold, gridSize, hideShorts] = await Promise.all([
        getEnabled(),
        getThreshold(),
        getGridSize(),
        getHideShorts()
    ]);
    await ensurePillButton(enabled);
    applyMode(enabled, threshold, hideShorts);
    applyGridSize(gridSize);

    const debounced = debounce(async () => {
        const [e, t, g, hs] = await Promise.all([
            getEnabled(),
            getThreshold(),
            getGridSize(),
            getHideShorts()
        ]);
        await ensurePillButton(e);
        applyMode(e, t, hs);
        applyGridSize(g);
    }, 300);

    const obs = new MutationObserver(() => debounced());
    obs.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("yt-navigate-finish", () => debounced());

    setInterval(() => debounced(), 2000);
}

boot();
