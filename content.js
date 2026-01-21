const STORAGE_KEY = "yt_hide_watched_enabled";
const HIDE_CLASS = "yt-hide-watched__hidden";

const CARD_CONTAINERS = [
    "ytd-rich-item-renderer",      // Home grid items
    "ytd-rich-grid-media",         // Home card
    "ytd-video-renderer",          // Search
    "ytd-grid-video-renderer",     // Channel grid
    "ytd-compact-video-renderer",  // Sidebar suggestions
    "ytd-playlist-video-renderer"  // Playlists
].join(",");

function ensureStyles() {
    if (document.getElementById("yt-hide-watched-style")) return;
    const style = document.createElement("style");
    style.id = "yt-hide-watched-style";
    style.textContent = `
    .${HIDE_CLASS} { display: none !important; }
    #yt-hide-watched-toggle {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 999999;
      padding: 10px 12px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.25);
      background: rgba(0,0,0,0.85);
      color: white;
      cursor: pointer;
      font-size: 12px;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      box-shadow: 0 6px 20px rgba(0,0,0,0.35);
    }
  `;
    document.documentElement.appendChild(style);
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

function ensureToggleButton(enabled) {
    const existing = document.getElementById("yt-hide-watched-toggle");
    if (existing) {
        existing.textContent = enabled ? "👀 Vues : cachées" : "👀 Vues : visibles";
        existing.setAttribute("aria-pressed", String(enabled));
        return;
    }

    const btn = document.createElement("button");
    btn.id = "yt-hide-watched-toggle";
    btn.type = "button";
    btn.textContent = enabled ? "👀 Vues : cachées" : "👀 Vues : visibles";
    btn.setAttribute("aria-pressed", String(enabled));

    btn.addEventListener("click", async () => {
        const next = !(await getEnabled());
        await setEnabled(next);
        ensureToggleButton(next);
        applyHide(next);
    });

    document.documentElement.appendChild(btn);
}


function isWatchedWithin(container) {
    if (container.querySelector("ytd-thumbnail-overlay-resume-playback-renderer")) return true;
    if (container.querySelector("yt-thumbnail-overlay-progress-bar-view-model")) return true;

    const progressEl = container.querySelector("#progress");
    return !!progressEl;


}

function getBestHideTarget(container) {
    return container.closest("ytd-rich-item-renderer") || container;
}

function applyHide(enabled) {
    const containers = document.querySelectorAll(CARD_CONTAINERS);

    containers.forEach((container) => {
        const watched = isWatchedWithin(container);
        const target = getBestHideTarget(container);

        if (enabled && watched) {
            target.classList.add(HIDE_CLASS);
            target.setAttribute("data-yt-hide-watched", "true");
        } else if (target.getAttribute("data-yt-hide-watched") === "true") {
            target.classList.remove(HIDE_CLASS);
            target.removeAttribute("data-yt-hide-watched");
        }
    });
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

    const enabled = await getEnabled();
    ensureToggleButton(enabled);
    applyHide(enabled);

    const debounced = debounce(async () => {
        const e = await getEnabled();
        ensureToggleButton(e);
        applyHide(e);
    }, 300);

    const obs = new MutationObserver(() => debounced());
    obs.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("yt-navigate-finish", () => debounced());

    setInterval(() => debounced(), 2000);
}

boot();
