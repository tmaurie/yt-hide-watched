const STORAGE_KEY = "yt_hide_watched_enabled";
const TOPBAR_BTN_ID = "yt-hide-watched-pill-btn";
const HIDE_CLASS = "yt-hide-watched__hidden";
const DIM_CLASS = "yt-hide-watched__dim";
const BADGE_CLASS = "yt-hide-watched__badge";

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

    // Classes natives YouTube (pill button)
    btn.className =
        "yt-spec-button-shape-next yt-spec-button-shape-next--filled " +
        "yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m";

    btn.style.marginRight = "8px";

    btn.setAttribute(
        "aria-label",
        enabled ? "Masquer vidéos vues activé" : "Masquer vidéos vues désactivé"
    );

    btn.textContent = enabled ? "Vues masquées" : "Vues visibles";

    btn.addEventListener("click", async () => {
        const next = !(await getEnabled());
        await setEnabled(next);
        updatePillButton(next);
        applyHide(next);
    });

    return btn;
}



function updatePillButton(enabled) {
    const btn = document.getElementById(TOPBAR_BTN_ID);
    if (!btn) return;

    btn.textContent = enabled ? "Vues : cachées" : "Vues : grisées";
    btn.setAttribute("aria-label", enabled ? "Mode cacher les vidéos vues" : "Mode griser les vidéos vues");

    btn.classList.toggle("yt-spec-button-shape-next--filled", enabled);
    btn.classList.toggle("yt-spec-button-shape-next--tonal", !enabled);
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

function applyMode(enabled) {
    const containers = document.querySelectorAll(CARD_CONTAINERS);

    containers.forEach((container) => {
        const watched = isWatchedWithin(container);
        const target = getBestHideTarget(container);

        if (!(target instanceof HTMLElement)) return;

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


function isWatchedWithin(container) {
    if (container.querySelector("ytd-thumbnail-overlay-resume-playback-renderer")) return true;
    if (container.querySelector("yt-thumbnail-overlay-progress-bar-view-model")) return true;

    const progressEl = container.querySelector("#progress");
    return !!progressEl;


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

    const enabled = await getEnabled();
    await ensurePillButton(enabled);
    applyMode(enabled);

    const debounced = debounce(async () => {
        const e = await getEnabled();
        await ensurePillButton(e);
        applyMode(e);
    }, 300);

    const obs = new MutationObserver(() => debounced());
    obs.observe(document.body, { childList: true, subtree: true });

    document.addEventListener("yt-navigate-finish", () => debounced());

    setInterval(() => debounced(), 2000);
}

boot();
