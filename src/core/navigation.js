// ---------------------------
// Navigation utilities + active nav highlighting
// ---------------------------
// URL helpers, active nav link highlighting, and history event handlers.
// Self-registers afterSwap/afterSettle/pushedIntoHistory/popstate listeners.

export function normalizePath(p) {
    if (!p) return '/';
    if (p === '/') return '/';
    return p.endsWith('/') ? p : `${p}/`;
}

export function setActiveNav(pathOverride) {
    const current = normalizePath(pathOverride ?? window.location.pathname);

    // Subnav link highlighting (exact match, or prefix match via data-nav-match)
    document.querySelectorAll('a[data-nav]').forEach((a) => {
        const href = normalizePath(a.getAttribute('href'));
        const matchPrefix = a.getAttribute('data-nav-match');
        const isActive = href === current || (matchPrefix && current.startsWith(matchPrefix));

        a.classList.toggle('active-nav', isActive);
        a.classList.toggle('underline', isActive);
    });

    // Section tab highlighting (prefix match)
    document.querySelectorAll('a[data-nav-section]').forEach((a) => {
        const prefix = a.getAttribute('data-nav-section');
        const isActive = current.startsWith(prefix);

        a.classList.toggle('active-nav', isActive);
        a.classList.toggle('underline', isActive);
    });

    // Subnav toggling — show the matching section, hide others
    document.querySelectorAll('[data-subnav]').forEach((el) => {
        const prefix = el.getAttribute('data-subnav');
        const show = current.startsWith(prefix);
        el.style.display = show ? '' : 'none';
        el.classList.remove('hidden');
    });
}

export function setUrlParam(key, value) {
    try {
        const url = new URL(window.location.href);
        if (value === null || value === undefined || value === '') {
            url.searchParams.delete(key);
        } else {
            url.searchParams.set(key, String(value));
        }
        history.pushState({}, '', url.pathname + url.search + url.hash);
    } catch {
        // ignore
    }
}

export function getUrlParam(key) {
    try {
        return new URL(window.location.href).searchParams.get(key);
    } catch {
        return null;
    }
}

export function mergeHxVals(el, vals) {
    let existing = {};
    try {
        existing = JSON.parse(el.getAttribute('hx-vals') || '{}');
    } catch { /* ignore */ }
    el.setAttribute('hx-vals', JSON.stringify({ ...existing, ...vals }));
}

export function getUrlParamInt(key, fallback = 1) {
    try {
        const url = new URL(window.location.href);
        const v = url.searchParams.get(key);
        if (!v) return fallback;
        const n = parseInt(v, 10);
        return Number.isFinite(n) && n > 0 ? n : fallback;
    } catch {
        return fallback;
    }
}

// ---------------------------
// Self-registered lifecycle handlers
// ---------------------------

document.addEventListener('DOMContentLoaded', () => {
    setActiveNav();
});

document.body.addEventListener('htmx:afterSwap', (e) => {
    // Always update nav (nav elements are outside #app, so they persist across swaps)
    setActiveNav();
});

// Update nav highlighting after HTMX pushes a new URL to history.
// Use e.detail.path since window.location may not be updated yet.
document.body.addEventListener('htmx:pushedIntoHistory', (e) => {
    const newPath = e.detail?.path;
    setActiveNav(newPath);
});

// Also try afterSettle as a fallback (with microtask delay to ensure URL is updated)
document.body.addEventListener('htmx:afterSettle', (e) => {
    queueMicrotask(() => {
        setActiveNav();
    });
});

window.addEventListener('popstate', () => {
    setActiveNav();
});
