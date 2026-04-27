const STORAGE_KEYS = {
    enabled: "yt_hide_watched_enabled",
    threshold: "yt_hide_watched_threshold",
    gridSize: "yt_hide_watched_grid_size",
    hideShorts: "yt_hide_watched_hide_shorts",
    debugMode: "yt_hide_watched_debug_mode"
};

const TOPBAR_BTN_ID = "yt-hide-watched-pill-btn";
const TOPBAR_CONTROL_ID = "yt-hide-watched-topbar-control";
const TOPBAR_MENU_ID = "yt-hide-watched-topbar-menu";
const STYLE_IDS = {
    base: "yt-hide-watched-style",
    grid: "yt-hide-watched-grid-style",
    shorts: "yt-hide-watched-shorts-style"
};

const CLASSES = {
    hidden: "yt-hide-watched__hidden",
    dim: "yt-hide-watched__dim",
    badge: "yt-hide-watched__badge",
    debugBadge: "yt-hide-watched__debug-badge",
    button: "yt-hide-watched__pill",
    topbarControl: "yt-hide-watched__topbar-control",
    menu: "yt-hide-watched__menu",
    menuRow: "yt-hide-watched__menu-row",
    menuLabel: "yt-hide-watched__menu-label",
    menuValue: "yt-hide-watched__menu-value",
    menuButton: "yt-hide-watched__menu-button",
    menuSlider: "yt-hide-watched__menu-slider",
    menuSelect: "yt-hide-watched__menu-select"
};

const DEFAULTS = {
    threshold: 0.8,
    gridSize: 4
};

const CARD_CONTAINER_SELECTORS = [
    "ytd-rich-item-renderer",      // Home grid items
    "ytd-rich-section-renderer",   // Home Shorts shelves
    "ytd-rich-grid-media",         // Home cards
    "ytd-rich-grid-slim-media",    // Shorts grid cards
    "ytd-video-renderer",          // Search
    "ytd-grid-video-renderer",     // Channel grid
    "ytd-compact-video-renderer",  // Sidebar suggestions
    "ytd-playlist-video-renderer", // Playlists
    "ytd-reel-shelf-renderer",
    "ytd-reel-item-renderer"
];

const SHORTS_LINK_SELECTORS = [
    "a[href^='/shorts/']",
    "a[href*='youtube.com/shorts/']"
];

const SHORTS_HIDE_TARGET_SELECTORS = [
    "ytd-rich-section-renderer",
    "ytd-reel-shelf-renderer",
    "ytd-rich-item-renderer",
    "ytd-video-renderer",
    "ytd-grid-video-renderer",
    "ytd-compact-video-renderer",
    "ytd-playlist-video-renderer"
];

const PROGRESS_CANDIDATE_SELECTORS = [
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

const CARD_CONTAINERS = CARD_CONTAINER_SELECTORS.join(",");
const SHORTS_LINK_SELECTOR = SHORTS_LINK_SELECTORS.join(",");

function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.sync.get(keys, resolve));
}

function storageSet(values) {
    return new Promise((resolve) => chrome.storage.sync.set(values, () => resolve()));
}

async function getSettings() {
    const res = await storageGet(Object.values(STORAGE_KEYS));
    const storedThreshold = parseFloat(res[STORAGE_KEYS.threshold]);
    const storedGridSize = parseInt(res[STORAGE_KEYS.gridSize], 10);

    return {
        enabled: Boolean(res[STORAGE_KEYS.enabled]),
        threshold: clamp01(storedThreshold) ?? DEFAULTS.threshold,
        gridSize: clamp(storedGridSize, 4, 8) ?? DEFAULTS.gridSize,
        hideShorts: Boolean(res[STORAGE_KEYS.hideShorts]),
        debugMode: Boolean(res[STORAGE_KEYS.debugMode])
    };
}

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

function buildTopbarControl(settings) {
    const control = document.createElement("span");
    control.id = TOPBAR_CONTROL_ID;
    control.className = CLASSES.topbarControl;
    control.appendChild(buildPillButton(settings.enabled));
    control.appendChild(buildQuickMenu(settings));
    return control;
}

function buildPillButton(enabled) {
    const btn = document.createElement("button");
    btn.id = TOPBAR_BTN_ID;
    btn.type = "button";
    btn.className = CLASSES.button;

    updatePillButtonState(btn, enabled);

    btn.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleQuickMenu();
    });

    return btn;
}

function buildQuickMenu(settings) {
    const menu = document.createElement("div");
    menu.id = TOPBAR_MENU_ID;
    menu.className = CLASSES.menu;
    menu.hidden = true;
    menu.addEventListener("click", (event) => event.stopPropagation());

    const title = document.createElement("div");
    title.className = CLASSES.menuLabel;
    title.textContent = "YouTube Hide Watched";
    menu.appendChild(title);

    const modeButton = document.createElement("button");
    modeButton.type = "button";
    modeButton.className = CLASSES.menuButton;
    modeButton.dataset.control = "enabled";
    modeButton.addEventListener("click", async () => {
        const current = await getSettings();
        const enabled = !current.enabled;
        await storageSet({ [STORAGE_KEYS.enabled]: enabled });
        await refreshPageState({ enabled });
    });
    menu.appendChild(modeButton);

    const thresholdRow = createMenuRow("Seuil", "threshold-value");
    const thresholdSlider = document.createElement("input");
    thresholdSlider.type = "range";
    thresholdSlider.min = "0";
    thresholdSlider.max = "1";
    thresholdSlider.step = "0.01";
    thresholdSlider.className = CLASSES.menuSlider;
    thresholdSlider.dataset.control = "threshold";
    thresholdSlider.addEventListener("input", () => {
        thresholdRow.value.textContent = formatPercent(clamp01(thresholdSlider.value) ?? DEFAULTS.threshold);
    });
    thresholdSlider.addEventListener("change", async () => {
        const threshold = clamp01(thresholdSlider.value) ?? DEFAULTS.threshold;
        await storageSet({ [STORAGE_KEYS.threshold]: threshold });
        await refreshPageState({ threshold });
    });
    thresholdRow.row.appendChild(thresholdSlider);
    menu.appendChild(thresholdRow.row);

    const gridRow = createMenuRow("Grille", "grid-value");
    const gridSelect = document.createElement("select");
    gridSelect.className = CLASSES.menuSelect;
    gridSelect.dataset.control = "gridSize";
    [4, 5, 6, 7, 8].forEach((value) => {
        const option = document.createElement("option");
        option.value = String(value);
        option.textContent = String(value);
        gridSelect.appendChild(option);
    });
    gridSelect.addEventListener("change", async () => {
        const gridSize = clamp(gridSelect.value, 4, 8) ?? DEFAULTS.gridSize;
        await storageSet({ [STORAGE_KEYS.gridSize]: gridSize });
        await refreshPageState({ gridSize });
    });
    gridRow.row.appendChild(gridSelect);
    menu.appendChild(gridRow.row);

    const shortsRow = createMenuRow("Shorts", "shorts-value");
    const shortsToggle = document.createElement("input");
    shortsToggle.type = "checkbox";
    shortsToggle.dataset.control = "hideShorts";
    shortsToggle.addEventListener("change", async () => {
        const hideShorts = shortsToggle.checked;
        await storageSet({ [STORAGE_KEYS.hideShorts]: hideShorts });
        await refreshPageState({ hideShorts });
    });
    shortsRow.row.appendChild(shortsToggle);
    menu.appendChild(shortsRow.row);

    updateQuickMenu(settings, menu);
    return menu;
}

function createMenuRow(label, valueId) {
    const row = document.createElement("label");
    row.className = CLASSES.menuRow;

    const header = document.createElement("span");
    header.className = CLASSES.menuLabel;
    header.textContent = label;

    const value = document.createElement("span");
    value.className = CLASSES.menuValue;
    value.dataset.value = valueId;
    header.appendChild(value);

    row.appendChild(header);
    return { row, value };
}

function toggleQuickMenu(forceOpen = null) {
    const menu = document.getElementById(TOPBAR_MENU_ID);
    if (!menu) return;

    menu.hidden = forceOpen === null ? !menu.hidden : !forceOpen;
}

function closeQuickMenu() {
    toggleQuickMenu(false);
}

function updatePillButtonState(btn, enabled) {
    btn.textContent = enabled ? "Vues : cachees" : "Vues : grisees";
    btn.setAttribute("aria-label", enabled ? "Mode cacher les videos vues" : "Mode griser les videos vues");
    btn.dataset.mode = enabled ? "hide" : "dim";
}

function updatePillButton(enabled) {
    const btn = document.getElementById(TOPBAR_BTN_ID);
    if (!btn) return;

    btn.className = CLASSES.button;
    updatePillButtonState(btn, enabled);
}

async function ensurePillButton(settings) {
    const end = await waitForElement("#masthead #end");
    if (!end) return;

    if (document.getElementById(TOPBAR_CONTROL_ID)) {
        updatePillButton(settings.enabled);
        updateQuickMenu(settings);
        return;
    }

    const orphanButton = document.getElementById(TOPBAR_BTN_ID);
    if (orphanButton) orphanButton.remove();

    const createBtn = [...end.querySelectorAll("button")]
        .find((button) => button.textContent?.includes("Créer") || button.textContent?.includes("Creer"));
    const control = buildTopbarControl(settings);

    if (createBtn?.parentElement) {
        createBtn.parentElement.insertBefore(control, createBtn);
    } else {
        end.prepend(control);
    }
}

function updateQuickMenu(settings, menu = document.getElementById(TOPBAR_MENU_ID)) {
    if (!menu) return;

    const modeButton = menu.querySelector("[data-control='enabled']");
    const thresholdSlider = menu.querySelector("[data-control='threshold']");
    const gridSelect = menu.querySelector("[data-control='gridSize']");
    const shortsToggle = menu.querySelector("[data-control='hideShorts']");
    const thresholdValue = menu.querySelector("[data-value='threshold-value']");
    const gridValue = menu.querySelector("[data-value='grid-value']");
    const shortsValue = menu.querySelector("[data-value='shorts-value']");

    if (modeButton) {
        modeButton.textContent = settings.enabled ? "Mode : cacher les vues" : "Mode : griser les vues";
        modeButton.dataset.mode = settings.enabled ? "hide" : "dim";
    }
    if (thresholdSlider) thresholdSlider.value = String(settings.threshold);
    if (thresholdValue) thresholdValue.textContent = formatPercent(settings.threshold);
    if (gridSelect) gridSelect.value = String(settings.gridSize);
    if (gridValue) gridValue.textContent = `${settings.gridSize}/ligne`;
    if (shortsToggle) shortsToggle.checked = settings.hideShorts;
    if (shortsValue) shortsValue.textContent = settings.hideShorts ? "on" : "off";
}

function applyMode({ enabled, threshold, hideShorts, debugMode }) {
    document.querySelectorAll(CARD_CONTAINERS).forEach((container) => {
        const card = analyzeCard(container, threshold);
        if (!(card.target instanceof HTMLElement)) return;

        if (hideShorts && card.isShort) {
            applyHiddenState(card.target, "hide-short");
            return;
        }

        if (card.watched && enabled) {
            applyHiddenState(card.target, "hide");
            return;
        }

        if (card.watched) {
            applyDimmedState(card.target, card, debugMode);
            return;
        }

        applyVisibleState(card.target, card, debugMode);
    });
}

function analyzeCard(container, threshold) {
    const isShort = isShortVideo(container);
    const progressDetails = getWatchProgressDetails(container);
    const watched = isWatchedWithin(container, threshold, progressDetails.value);
    const target = isShort ? getBestShortsHideTarget(container) : getBestHideTarget(container);

    return { container, target, isShort, threshold, progressDetails, watched };
}

function applyHiddenState(target, reason) {
    target.classList.add(CLASSES.hidden);
    target.classList.remove(CLASSES.dim);
    removeBadge(target, CLASSES.badge);
    removeBadge(target, CLASSES.debugBadge);
    target.setAttribute("data-yt-hide-watched", reason);
}

function applyDimmedState(target, card, debugMode) {
    target.classList.remove(CLASSES.hidden);
    target.classList.add(CLASSES.dim);
    ensureWatchedBadge(target);
    updateDebugBadge(target, card, debugMode);
    target.setAttribute("data-yt-hide-watched", "dim");
}

function applyVisibleState(target, card, debugMode) {
    target.classList.remove(CLASSES.hidden);
    target.classList.remove(CLASSES.dim);
    removeBadge(target, CLASSES.badge);
    updateDebugBadge(target, card, debugMode);
    target.removeAttribute("data-yt-hide-watched");
}

function ensureWatchedBadge(targetCard) {
    const anchor = getBadgeAnchor(targetCard);
    if (!(anchor instanceof HTMLElement)) return;

    ensureRelativePosition(anchor);
    if (anchor.querySelector(`.${CLASSES.badge}`)) return;

    const badge = document.createElement("div");
    badge.className = CLASSES.badge;
    badge.textContent = "Deja vue";
    anchor.appendChild(badge);
}

function updateDebugBadge(targetCard, card, debugMode) {
    if (!debugMode) {
        removeBadge(targetCard, CLASSES.debugBadge);
        return;
    }

    const anchor = getBadgeAnchor(targetCard);
    if (!(anchor instanceof HTMLElement)) return;

    ensureRelativePosition(anchor);

    const badge = ensureChild(anchor, CLASSES.debugBadge);
    const progress = card.progressDetails.value;
    const percent = progress === null ? "??" : `${Math.round(progress * 100)}%`;
    const thresholdPercent = `${Math.round(card.threshold * 100)}%`;
    const source = card.progressDetails.source || "none";

    badge.textContent = card.isShort ? `Short | ${percent} | ${source}` : `${percent} / ${thresholdPercent} | ${source}`;
    badge.dataset.state = card.isShort ? "short" : progress !== null && progress >= card.threshold ? "watched" : "visible";
}

function ensureChild(parent, className) {
    let child = parent.querySelector(`.${className}`);
    if (!child) {
        child = document.createElement("div");
        child.className = className;
        parent.appendChild(child);
    }
    return child;
}

function removeBadge(targetCard, className) {
    targetCard.querySelectorAll(`.${className}`).forEach((badge) => badge.remove());
}

function getBadgeAnchor(targetCard) {
    return targetCard.querySelector("ytd-thumbnail") || targetCard.querySelector("#thumbnail") || targetCard;
}

function ensureRelativePosition(el) {
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
}

function ensureStyles() {
    if (document.getElementById(STYLE_IDS.base)) return;

    const style = document.createElement("style");
    style.id = STYLE_IDS.base;
    style.textContent = `
    .${CLASSES.topbarControl} {
      position: relative !important;
      display: inline-flex !important;
      align-items: center !important;
      margin-right: 8px !important;
    }

    .${CLASSES.button} {
      appearance: none !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      min-width: 118px !important;
      height: 36px !important;
      margin-right: 0 !important;
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
    .${CLASSES.button}:hover { background: #272727 !important; }
    .${CLASSES.button}:focus-visible {
      outline: 2px solid #3ea6ff !important;
      outline-offset: 2px !important;
    }
    .${CLASSES.button}[data-mode="dim"] {
      background: #f2f2f2 !important;
      border-color: #d9d9d9 !important;
      color: #0f0f0f !important;
    }
    .${CLASSES.button}[data-mode="dim"]:hover { background: #e5e5e5 !important; }

    .${CLASSES.menu} {
      position: absolute !important;
      top: calc(100% + 10px) !important;
      right: 0 !important;
      z-index: 2200 !important;
      width: 236px !important;
      padding: 12px !important;
      border: 1px solid rgba(255,255,255,0.14) !important;
      border-radius: 14px !important;
      background: rgba(18,18,18,0.96) !important;
      color: #fff !important;
      box-shadow: 0 12px 36px rgba(0,0,0,0.36) !important;
      font: 500 12px/1.25 Roboto, Arial, sans-serif !important;
    }
    .${CLASSES.menu}[hidden] { display: none !important; }
    .${CLASSES.menuRow} {
      display: flex !important;
      flex-direction: column !important;
      gap: 7px !important;
      margin-top: 12px !important;
      color: #fff !important;
    }
    .${CLASSES.menuLabel} {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      gap: 8px !important;
      color: #f1f1f1 !important;
      font-weight: 700 !important;
    }
    .${CLASSES.menuValue} {
      color: #aaa !important;
      font-weight: 600 !important;
    }
    .${CLASSES.menuButton} {
      width: 100% !important;
      margin-top: 10px !important;
      padding: 9px 10px !important;
      border: 0 !important;
      border-radius: 10px !important;
      background: #fff !important;
      color: #0f0f0f !important;
      font: 700 12px/1 Roboto, Arial, sans-serif !important;
      cursor: pointer !important;
    }
    .${CLASSES.menuButton}[data-mode="dim"] {
      background: #2b2b2b !important;
      color: #fff !important;
    }
    .${CLASSES.menuSlider} {
      width: 100% !important;
      accent-color: #ff4e45 !important;
    }
    .${CLASSES.menuSelect} {
      width: 100% !important;
      padding: 7px 8px !important;
      border: 1px solid #3d3d3d !important;
      border-radius: 9px !important;
      background: #202020 !important;
      color: #fff !important;
      font: 600 12px/1 Roboto, Arial, sans-serif !important;
    }

    .${CLASSES.hidden} { display: none !important; }

    .${CLASSES.dim} {
      filter: grayscale(1) saturate(0.2);
      opacity: 0.45;
      transition: opacity 120ms ease, filter 120ms ease;
    }
    .${CLASSES.dim}:hover {
      opacity: 0.75;
      filter: grayscale(0.6) saturate(0.6);
    }

    .${CLASSES.badge}{
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

    .${CLASSES.debugBadge}{
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
    .${CLASSES.debugBadge}[data-state="watched"] { background: rgba(227, 82, 56, 0.92); }
    .${CLASSES.debugBadge}[data-state="short"] { background: rgba(30, 120, 210, 0.92); }
  `;
    document.documentElement.appendChild(style);
}

function applyGridSize(size = DEFAULTS.gridSize) {
    const columns = clamp(Number(size), 4, 8) ?? DEFAULTS.gridSize;
    const style = ensureStyleElement(STYLE_IDS.grid);

    style.textContent = `
    ytd-rich-grid-renderer {
      --ytd-rich-grid-items-per-row: ${columns} !important;
      --ytd-rich-grid-slim-items-per-row: ${columns} !important;
    }
    ytd-rich-grid-renderer #contents {
      grid-template-columns: repeat(${columns}, minmax(0, 1fr)) !important;
    }
    ytd-rich-grid-row,
    ytd-rich-grid-renderer #contents ytd-rich-grid-row {
      grid-template-columns: repeat(${columns}, minmax(0, 1fr)) !important;
      display: contents !important;
    }
  `;
}

function applyHideShortsCss(hideShorts = false) {
    const existing = document.getElementById(STYLE_IDS.shorts);
    if (!hideShorts) {
        if (existing) existing.remove();
        return;
    }

    const style = existing || ensureStyleElement(STYLE_IDS.shorts);
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

function ensureStyleElement(id) {
    let style = document.getElementById(id);
    if (!style) {
        style = document.createElement("style");
        style.id = id;
        document.documentElement.appendChild(style);
    }
    return style;
}

function isWatchedWithin(container, threshold = DEFAULTS.threshold, knownProgress = null) {
    const progress = knownProgress ?? getWatchProgress(container);
    if (progress !== null) return progress >= threshold;

    return hasWatchedMarker(container);
}

function hasWatchedMarker(container) {
    return getProgressCandidates(container).length > 0;
}

function isShortVideo(container) {
    if (container.closest("ytd-reel-item-renderer")) return true;
    return Boolean(container.querySelector(SHORTS_LINK_SELECTOR));
}

function getWatchProgress(container) {
    return getWatchProgressDetails(container).value;
}

function getWatchProgressDetails(container) {
    const candidates = getProgressCandidates(container);
    const details = candidates
        .map(extractProgressFromElement)
        .filter((progress) => progress.value !== null);

    if (!details.length) return { value: null, source: "none", count: candidates.length };

    // YouTube often exposes decorative 0% values before the real progress bar.
    const best = details.reduce((max, current) => current.value > max.value ? current : max);
    return { ...best, count: candidates.length };
}

function getProgressCandidates(container) {
    const candidates = PROGRESS_CANDIDATE_SELECTORS.flatMap((selector) => queryDeepAll(container, selector));
    return [...new Set(candidates)];
}

function queryDeepAll(root, selector, seen = new Set()) {
    const results = [];
    if (!root || seen.has(root)) return results;
    seen.add(root);

    if (root instanceof Element && matchesSafely(root, selector)) results.push(root);

    const queryRoot = root instanceof ShadowRoot || root instanceof Element || root instanceof Document
        ? root
        : null;
    if (!queryRoot) return results;

    try {
        results.push(...queryRoot.querySelectorAll(selector));
    } catch (_) {
        return results;
    }

    queryRoot.querySelectorAll("*").forEach((el) => {
        if (el.shadowRoot) results.push(...queryDeepAll(el.shadowRoot, selector, seen));
    });

    return results;
}

function matchesSafely(el, selector) {
    try {
        return el.matches(selector);
    } catch (_) {
        return false;
    }
}

function extractProgressFromElement(el) {
    if (!el) return progressResult(null);

    const fromText = parsePercentText(el.getAttribute("aria-valuetext") || el.getAttribute("aria-label") || "");
    if (fromText !== null) return progressResult(fromText, "text");

    const computed = getComputedStyle(el);
    const fromTransform = parseTransformProgress(el.style.transform || computed.transform);
    if (fromTransform !== null) return progressResult(fromTransform, "transform");

    const fromStyle = parseWidthPercentText(el.getAttribute("style") || el.style.width || computed.width);
    if (fromStyle !== null) return progressResult(fromStyle, "style");

    const fromGeometry = extractProgressFromGeometry(el);
    if (fromGeometry !== null) return progressResult(fromGeometry, "geometry");

    const fromAria = extractProgressFromAria(el);
    if (fromAria !== null) return progressResult(fromAria, "aria");

    return progressResult(null);
}

function progressResult(value, source = "none") {
    return { value, source };
}

function extractProgressFromAria(el) {
    if (!el) return null;

    const min = parseFloat(el.getAttribute("aria-valuemin") || "0");
    const max = parseFloat(el.getAttribute("aria-valuemax") || "100");
    const now = parseFloat(el.getAttribute("aria-valuenow") || "0");
    const range = max - min;

    if (!Number.isFinite(range) || range <= 0) return null;
    return clamp01((now - min) / range);
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

function getBestHideTarget(container) {
    return container.closest("ytd-rich-item-renderer") || container;
}

function getBestShortsHideTarget(container) {
    return SHORTS_HIDE_TARGET_SELECTORS
        .map((selector) => container.closest(selector))
        .find(Boolean) || container;
}

function clamp01(num) {
    return clamp(num, 0, 1);
}

function clamp(num, min, max) {
    const n = Number(num);
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, n));
}

function formatPercent(value) {
    return `${Math.round(value * 100)}%`;
}

function debounce(fn, delay = 250) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    };
}

async function refreshPageState(overrides = {}) {
    const settings = { ...(await getSettings()), ...overrides };

    await ensurePillButton(settings);
    applyMode(settings);
    applyHideShortsCss(settings.hideShorts);
    applyGridSize(settings.gridSize);
}

async function boot() {
    ensureStyles();
    await refreshPageState();

    const debouncedRefresh = debounce(() => refreshPageState(), 300);
    const obs = new MutationObserver(() => debouncedRefresh());
    obs.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("click", closeQuickMenu);
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeQuickMenu();
    });
    document.addEventListener("yt-navigate-finish", () => debouncedRefresh());
    setInterval(() => debouncedRefresh(), 2000);
}

boot();
