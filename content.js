const STORAGE_KEY = "yt_hide_watched_enabled";
const THRESHOLD_STORAGE_KEY = "yt_hide_watched_threshold";
const GRID_SIZE_STORAGE_KEY = "yt_hide_watched_grid_size";
const HIDE_SHORTS_KEY = "yt_hide_watched_hide_shorts";
const DEBUG_MODE_KEY = "yt_hide_watched_debug_mode";

const TOPBAR_BTN_ID = "yt-hide-watched-pill-btn";

const HIDE_CLASS = "yt-hide-watched__hidden";
const DIM_CLASS = "yt-hide-watched__dim";
const BADGE_CLASS = "yt-hide-watched__badge";
const DEBUG_BADGE_CLASS = "yt-hide-watched__debug-badge";
const BUTTON_CLASS = "yt-hide-watched__pill";

const DEFAULT_THRESHOLD = 0.8;
const DEFAULT_GRID_SIZE = 4;

const CARD_CONTAINERS = [
    "ytd-rich-item-renderer",      // Home grid items
    "ytd-rich-section-renderer",   // Home Shorts shelves
    "ytd-rich-grid-media",         // Home card
    "ytd-rich-grid-slim-media",    // Shorts grid cards
    "ytd-video-renderer",          // Search
    "ytd-grid-video-renderer",     // Channel grid
    "ytd-compact-video-renderer",  // Sidebar suggestions
    "ytd-playlist-video-renderer", // Playlists
    "ytd-reel-shelf-renderer",
    "ytd-reel-item-renderer"
].join(",");

const SHORTS_LINK_SELECTOR = [
    "a[href^='/shorts/']",
    "a[href*='youtube.com/shorts/']"
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
    btn.className = BUTTON_CLASS;

    updatePillButtonState(btn, enabled);

    btn.addEventListener("click", async () => {
        const next = !(await getEnabled());
        await setEnabled(next);
        updatePillButton(next);
        const [threshold, hideShorts, debugMode] = await Promise.all([
            getThreshold(),
            getHideShorts(),
            getDebugMode()
        ]);
        applyMode(next, threshold, hideShorts, debugMode);
    });

    return btn;
}

function updatePillButtonState(btn, enabled) {
    btn.textContent = enabled ? "Vues : cachees" : "Vues : grisees";
    btn.setAttribute("aria-label", enabled ? "Mode cacher les videos vues" : "Mode griser les videos vues");
    btn.dataset.mode = enabled ? "hide" : "dim";
}

function updatePillButton(enabled) {
    const btn = document.getElementById(TOPBAR_BTN_ID);
    if (!btn) return;

    btn.className = BUTTON_CLASS;
    updatePillButtonState(btn, enabled);
}

async function ensurePillButton(enabled) {
    const end = await waitForElement("#masthead #end");
    if (!end) return;

    if (document.getElementById(TOPBAR_BTN_ID)) {
        updatePillButton(enabled);
        return;
    }

    const createBtn = [...end.querySelectorAll("button")]
        .find((button) => button.textContent?.includes("Créer") || button.textContent?.includes("Creer"));

    const pill = buildPillButton(enabled);

    if (createBtn && createBtn.parentElement) {
        createBtn.parentElement.insertBefore(pill, createBtn);
    } else {
        end.prepend(pill);
    }
}

function ensureBadge(targetCard) {
    const thumb = getBadgeAnchor(targetCard);
    if (!(thumb instanceof HTMLElement)) return;

    ensureRelativePosition(thumb);

    if (thumb.querySelector(`.${BADGE_CLASS}`)) return;

    const badge = document.createElement("div");
    badge.className = BADGE_CLASS;
    badge.textContent = "Deja vue";
    thumb.appendChild(badge);
}

function removeBadge(targetCard) {
    const badge = targetCard.querySelector(`.${BADGE_CLASS}`);
    if (badge) badge.remove();
}

function updateDebugBadge(targetCard, progressDetails, threshold, isShort, debugMode) {
    if (!debugMode) {
        removeDebugBadge(targetCard);
        return;
    }

    const thumb = getBadgeAnchor(targetCard);
    if (!(thumb instanceof HTMLElement)) return;

    ensureRelativePosition(thumb);

    let badge = thumb.querySelector(`.${DEBUG_BADGE_CLASS}`);
    if (!badge) {
        badge = document.createElement("div");
        badge.className = DEBUG_BADGE_CLASS;
        thumb.appendChild(badge);
    }

    const progress = progressDetails.value;
    const percent = progress === null ? "??" : `${Math.round(progress * 100)}%`;
    const thresholdPercent = `${Math.round(threshold * 100)}%`;
    const source = progressDetails.source || "none";
    badge.textContent = isShort ? `Short | ${percent} | ${source}` : `${percent} / ${thresholdPercent} | ${source}`;
    badge.dataset.state = isShort ? "short" : progress !== null && progress >= threshold ? "watched" : "visible";
}

function removeDebugBadge(targetCard) {
    targetCard.querySelectorAll(`.${DEBUG_BADGE_CLASS}`).forEach((badge) => badge.remove());
}

function getBadgeAnchor(targetCard) {
    return (
        targetCard.querySelector("ytd-thumbnail") ||
        targetCard.querySelector("#thumbnail") ||
        targetCard
    );
}

function ensureRelativePosition(el) {
    const computed = getComputedStyle(el);
    if (computed.position === "static") el.style.position = "relative";
}

function applyMode(enabled, threshold = DEFAULT_THRESHOLD, hideShorts = false, debugMode = false) {
    const containers = document.querySelectorAll(CARD_CONTAINERS);

    containers.forEach((container) => {
        const isShort = isShortVideo(container);
        const progressDetails = getWatchProgressDetails(container);
        const progress = progressDetails.value;
        const watched = isWatchedWithin(container, threshold, progress);
        const target = isShort ? getBestShortsHideTarget(container) : getBestHideTarget(container);

        if (!(target instanceof HTMLElement)) return;

        if (hideShorts && isShort) {
            target.classList.add(HIDE_CLASS);
            target.classList.remove(DIM_CLASS);
            removeBadge(target);
            removeDebugBadge(target);
            target.setAttribute("data-yt-hide-watched", "hide-short");
            return;
        }

        if (watched) {
            if (enabled) {
                target.classList.add(HIDE_CLASS);
                target.classList.remove(DIM_CLASS);
                removeBadge(target);
                removeDebugBadge(target);
                target.setAttribute("data-yt-hide-watched", "hide");
            } else {
                target.classList.remove(HIDE_CLASS);
                target.classList.add(DIM_CLASS);
                ensureBadge(target);
                updateDebugBadge(target, progressDetails, threshold, isShort, debugMode);
                target.setAttribute("data-yt-hide-watched", "dim");
            }
        } else {
            target.classList.remove(HIDE_CLASS);
            target.classList.remove(DIM_CLASS);
            removeBadge(target);
            updateDebugBadge(target, progressDetails, threshold, isShort, debugMode);
            target.removeAttribute("data-yt-hide-watched");
        }

        if (!debugMode) removeDebugBadge(target);
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

    .${DEBUG_BADGE_CLASS}{
      position: absolute;
      right: 8px;
      bottom: 8px;
      z-index: 4;
      font-size: 11px;
      line-height: 1;
      padding: 6px 7px;
      border-radius: 8px;
      background: rgba(12, 12, 12, 0.82);
      color: #fff;
      pointer-events: none;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
    .${DEBUG_BADGE_CLASS}[data-state="watched"] {
      background: rgba(227, 82, 56, 0.92);
    }
    .${DEBUG_BADGE_CLASS}[data-state="short"] {
      background: rgba(30, 120, 210, 0.92);
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

function applyHideShortsCss(hideShorts = false) {
    let style = document.getElementById("yt-hide-watched-shorts-style");

    if (!hideShorts) {
        if (style) style.remove();
        return;
    }

    if (!style) {
        style = document.createElement("style");
        style.id = "yt-hide-watched-shorts-style";
        document.documentElement.appendChild(style);
    }

    style.textContent = `
    ytd-rich-item-renderer:has(${SHORTS_LINK_SELECTOR}),
    ytd-rich-section-renderer:has(${SHORTS_LINK_SELECTOR}),
    ytd-rich-grid-media:has(${SHORTS_LINK_SELECTOR}),
    ytd-rich-grid-slim-media:has(${SHORTS_LINK_SELECTOR}),
    ytd-video-renderer:has(${SHORTS_LINK_SELECTOR}),
    ytd-grid-video-renderer:has(${SHORTS_LINK_SELECTOR}),
    ytd-compact-video-renderer:has(${SHORTS_LINK_SELECTOR}),
    ytd-playlist-video-renderer:has(${SHORTS_LINK_SELECTOR}),
    ytd-reel-shelf-renderer,
    ytd-reel-item-renderer {
      display: none !important;
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

function getDebugMode() {
    return new Promise((resolve) => {
        chrome.storage.sync.get([DEBUG_MODE_KEY], (res) => resolve(Boolean(res[DEBUG_MODE_KEY])));
    });
}

function isWatchedWithin(container, threshold = DEFAULT_THRESHOLD, knownProgress = null) {
    const progress = knownProgress ?? getWatchProgress(container);
    if (progress !== null) return progress >= threshold;

    return hasWatchedMarker(container);
}

function hasWatchedMarker(container) {
    return getProgressCandidates(container).length > 0;
}

function isShortVideo(container) {
    if (container.closest("ytd-reel-item-renderer")) return true;
    if (container.matches("ytd-reel-shelf-renderer, ytd-rich-section-renderer")) {
        return Boolean(container.querySelector(SHORTS_LINK_SELECTOR));
    }
    return Boolean(container.querySelector(SHORTS_LINK_SELECTOR));
}

function getWatchProgress(container) {
    return getWatchProgressDetails(container).value;
}

function getWatchProgressDetails(container) {
    const candidates = getProgressCandidates(container);
    const details = [];

    for (const candidate of candidates) {
        const progress = extractProgressFromElement(candidate);
        if (progress.value !== null) details.push(progress);
    }

    if (!details.length) return { value: null, source: "none", count: candidates.length };

    // YouTube often exposes decorative 0% values before the real progress bar.
    const best = details.reduce((max, current) => current.value > max.value ? current : max);
    return { ...best, count: candidates.length };
}

function getProgressCandidates(container) {
    const selectors = [
        "ytd-thumbnail [style*='scale']",
        "ytd-thumbnail [style*='translate']",
        "ytd-thumbnail [style*='width']",
        "ytd-thumbnail [id*='progress' i]",
        "ytd-thumbnail [class*='progress' i]",
        "ytd-thumbnail-overlay-resume-playback-renderer [style*='scale']",
        "ytd-thumbnail-overlay-resume-playback-renderer [style*='translate']",
        "ytd-thumbnail-overlay-resume-playback-renderer [style*='width']",
        "ytd-thumbnail-overlay-resume-playback-renderer [aria-valuetext]",
        "ytd-thumbnail-overlay-resume-playback-renderer [aria-valuenow]",
        "ytd-thumbnail-overlay-resume-playback-renderer #progress",
        "yt-thumbnail-overlay-progress-bar-view-model [style*='scale']",
        "yt-thumbnail-overlay-progress-bar-view-model [style*='translate']",
        "yt-thumbnail-overlay-progress-bar-view-model [style*='width']",
        "yt-thumbnail-overlay-progress-bar-view-model [aria-valuetext]",
        "yt-thumbnail-overlay-progress-bar-view-model [aria-valuenow]",
        "yt-thumbnail-overlay-progress-bar-view-model #progress",
        "#progress [style*='scale']",
        "#progress [style*='translate']",
        "#progress [style*='width']",
        "#progress [aria-valuetext]",
        "#progress [aria-valuenow]",
        "[role='progressbar'][aria-valuetext]",
        "[role='progressbar'][aria-valuenow]",
        "#progress"
    ];

    return [...new Set(selectors.flatMap((selector) => queryDeepAll(container, selector)))];
}

function queryDeepAll(root, selector, seen = new Set()) {
    const results = [];

    if (!root || seen.has(root)) return results;
    seen.add(root);

    if (root instanceof Element) {
        try {
            if (root.matches(selector)) results.push(root);
        } catch (_) {
            return results;
        }
    }

    const queryRoot = root instanceof ShadowRoot || root instanceof Element || root instanceof Document
        ? root
        : null;

    if (queryRoot) {
        try {
            results.push(...queryRoot.querySelectorAll(selector));
        } catch (_) {
            return results;
        }

        queryRoot.querySelectorAll("*").forEach((el) => {
            if (el.shadowRoot) results.push(...queryDeepAll(el.shadowRoot, selector, seen));
        });
    }

    return results;
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
    if (!el) return { value: null, source: "none" };

    const ariaText = el.getAttribute("aria-valuetext") || el.getAttribute("aria-label") || "";
    const fromText = parsePercentText(ariaText);
    if (fromText !== null) return { value: fromText, source: "text" };

    const computed = getComputedStyle(el);
    const transform = el.style.transform || computed.transform;
    const fromTransform = parseTransformProgress(transform);
    if (fromTransform !== null) return { value: fromTransform, source: "transform" };

    const fromStyle = parseWidthPercentText(el.getAttribute("style") || el.style.width || computed.width);
    if (fromStyle !== null) return { value: fromStyle, source: "style" };

    const fromGeometry = extractProgressFromGeometry(el);
    if (fromGeometry !== null) return { value: fromGeometry, source: "geometry" };

    const fromAria = extractProgressFromAria(el);
    if (fromAria !== null) return { value: fromAria, source: "aria" };

    return { value: null, source: "none" };
}

function extractProgressFromGeometry(el) {
    const progressRoot = el.closest(
        "ytd-thumbnail-overlay-resume-playback-renderer, yt-thumbnail-overlay-progress-bar-view-model, #progress"
    );
    const reference = progressRoot && progressRoot !== el ? progressRoot : el.parentElement;

    if (!(reference instanceof HTMLElement)) return null;

    const total = reference.getBoundingClientRect().width;
    const current = el.getBoundingClientRect().width;

    if (total <= 0 || current <= 0 || current > total) return null;

    return clamp01(current / total);
}

function parsePercentText(text) {
    const match = String(text).match(/([\d.]+)\s*%/);
    if (!match) return null;

    return clamp01(parseFloat(match[1]) / 100);
}

function parseWidthPercentText(text) {
    const value = String(text);
    const match =
        value.match(/(?:width|progress|scale)[^:]*:\s*([\d.]+)\s*%/i) ||
        value.match(/^([\d.]+)\s*%$/);

    if (!match) return null;

    return clamp01(parseFloat(match[1]) / 100);
}

function parseTransformProgress(transform) {
    if (!transform || transform === "none") return null;

    const scaleMatch = transform.match(/scaleX\(([-\d.]+)\)/);
    if (scaleMatch) return clamp01(parseFloat(scaleMatch[1]));

    const translateMatch = transform.match(/translateX\(([-\d.]+)%\)/);
    if (translateMatch) return clamp01(1 + parseFloat(translateMatch[1]) / 100);

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

function getBestShortsHideTarget(container) {
    return (
        container.closest("ytd-rich-section-renderer") ||
        container.closest("ytd-reel-shelf-renderer") ||
        container.closest("ytd-rich-item-renderer") ||
        container.closest("ytd-video-renderer") ||
        container.closest("ytd-grid-video-renderer") ||
        container.closest("ytd-compact-video-renderer") ||
        container.closest("ytd-playlist-video-renderer") ||
        container
    );
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

    const [enabled, threshold, gridSize, hideShorts, debugMode] = await Promise.all([
        getEnabled(),
        getThreshold(),
        getGridSize(),
        getHideShorts(),
        getDebugMode()
    ]);
    await ensurePillButton(enabled);
    applyMode(enabled, threshold, hideShorts, debugMode);
    applyHideShortsCss(hideShorts);
    applyGridSize(gridSize);

    const debounced = debounce(async () => {
        const [e, t, g, hs, d] = await Promise.all([
            getEnabled(),
            getThreshold(),
            getGridSize(),
            getHideShorts(),
            getDebugMode()
        ]);
        await ensurePillButton(e);
        applyMode(e, t, hs, d);
        applyHideShortsCss(hs);
        applyGridSize(g);
    }, 300);

    const obs = new MutationObserver(() => debounced());
    obs.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("yt-navigate-finish", () => debounced());

    setInterval(() => debounced(), 2000);
}

boot();
