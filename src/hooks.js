// ---------------------------
// Lifecycle Hooks
// ---------------------------
// Central hook registry for app and page scripts to register callbacks
// that fire at key points in the page lifecycle. Avoids direct
// htmx:afterSwap / DOMContentLoaded listeners scattered across pages.
//
// Usage from app code:
//   import { onAfterSwap } from '@phillipsharring/graspr-framework';
//   onAfterSwap(function(target) { initMyWidget(target); });
//
// Usage from inline page scripts:
//   App.hooks.onAfterSwap(function(target) { ... });

const hooks = {
    afterSwap: [],
    afterSettle: [],
    pageLoad: [],
    historyRestore: [],
};

var pageLoaded = document.readyState !== 'loading';

/** Register a callback that runs after #app is swapped via boosted nav. */
export function onAfterSwap(fn) {
    hooks.afterSwap.push(fn);
}

/** Register a callback that runs after HTMX settle phase (hx-trigger wired up). */
export function onAfterSettle(fn) {
    hooks.afterSettle.push(fn);
}

/** Register a callback that runs on DOMContentLoaded (full page load only).
 *  If DOMContentLoaded already fired, runs immediately. */
export function onPageLoad(fn) {
    hooks.pageLoad.push(fn);
    if (pageLoaded) fn(document);
}

/** Register a callback that runs on browser back/forward (history restore). */
export function onHistoryRestore(fn) {
    hooks.historyRestore.push(fn);
}

// ── Wire up the actual event listeners (one each, calls all registered hooks) ──

document.body.addEventListener('htmx:afterSwap', function(e) {
    var target = e.detail?.target;
    if (target && target.id === 'app') {
        hooks.afterSwap.forEach(function(fn) { fn(target); });
    }
});

document.body.addEventListener('htmx:afterSettle', function(e) {
    var target = e.detail?.target;
    if (target && target.id === 'app') {
        hooks.afterSettle.forEach(function(fn) { fn(target); });
    }
});

document.addEventListener('DOMContentLoaded', function() {
    pageLoaded = true;
    hooks.pageLoad.forEach(function(fn) { fn(document); });
});

document.body.addEventListener('htmx:historyRestore', function() {
    hooks.historyRestore.forEach(function(fn) { fn(); });
});
