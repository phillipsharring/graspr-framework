// ----------------------------
// Boosted-nav infrastructure
// ----------------------------
// Handles three concerns for HTMX apps with hx-boost="true" on <body>:
//
// 1. hx-select override: <body> has hx-select="#app" for boosted nav. Non-boosted
//    elements (buttons, forms) inherit it, but their JSON/template responses don't
//    contain #app — so hx-select filters everything out. Fix: clear inherited
//    hx-select for non-boosted requests via selectOverride = 'unset'.
//
// 2. Inherited target fix: Self-loading elements (tbody, detail divs) use
//    hx-target="this". Boosted <a> links inside them inherit that target, causing
//    the next page to load inside the table/div. Detects and redirects to #app.
//
// 3. Layout mismatch: When boosted nav crosses layouts (e.g. game → admin), only
//    #app swaps — the chrome stays wrong. Detects layout differences and forces a
//    full page reload.

/**
 * Check if an element is a boosted page navigation link (not an explicit hx-get/hx-post).
 */
export function isBoostedPageNav(elt) {
    return elt instanceof HTMLAnchorElement
        && !elt.hasAttribute('hx-get')
        && !elt.hasAttribute('hx-post');
}

function extractLayoutFromResponse(html) {
    const match = html.match(/id=["']app["'][^>]*data-layout=["']([^"']+)["']/);
    return match?.[1] ?? null;
}

// hx-select override for non-boosted elements
document.body.addEventListener('htmx:beforeSwap', (e) => {
    const elt = e.detail.requestConfig?.elt;
    if (!elt || isBoostedPageNav(elt)) return;

    // Don't override if already set by another handler or the server
    if (e.detail.selectOverride) return;

    // Don't override if the element explicitly declares hx-select
    if (elt.hasAttribute('hx-select')) return;

    e.detail.selectOverride = 'unset';
});

// Boosted-nav interceptor + Layout mismatch detection
document.body.addEventListener('htmx:beforeSwap', (e) => {
    const detail = e.detail || {};
    const elt = detail.requestConfig?.elt;

    if (!elt || !isBoostedPageNav(elt)) return;

    const app = document.getElementById('app');
    if (!app) return;

    // --- Fix inherited target ---
    if (detail.target !== app) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(detail.serverResponse, 'text/html');
        const newApp = doc.getElementById('app');

        if (!newApp) return;

        detail.target = app;
        detail.serverResponse = newApp.outerHTML;
        detail.swapOverride = 'outerHTML';
    }

    // --- Strip admin opacity gate ---
    // Admin layout uses style="opacity: 0" on #app to prevent content flash before
    // auth check on full page load. On boosted nav auth is already verified, so strip
    // it from the response before HTMX swaps it in.
    if (detail.serverResponse) {
        detail.serverResponse = detail.serverResponse.replace(
            /(<[^>]*id=["']app["'][^>]*)\s*style=["']opacity:\s*0["']/,
            '$1'
        );
    }

    // --- Layout mismatch detection ---
    const currentLayout = app.dataset?.layout;
    if (!currentLayout) return;

    const incomingLayout = extractLayoutFromResponse(detail.serverResponse);

    if (incomingLayout && incomingLayout !== currentLayout) {
        detail.shouldSwap = false;
        const path = detail.pathInfo?.requestPath || detail.xhr?.responseURL;
        if (path) {
            window.location.href = path;
        }
    }
});
