/**
 * Toast notification system
 */

import Handlebars from 'handlebars';

let toastHideTimer = null;
const DEFAULT_TOAST_MS = 5_000;
let lastFocusBeforeToast = null;
let toastTransitionTimer = null;
const TOAST_TRANSITION_MS = 200;

function getToastWrap() {
    return document.getElementById('global-toast-wrap');
}

function openToast({ timeoutMs = DEFAULT_TOAST_MS } = {}) {
    const wrap = getToastWrap();
    if (!wrap) return;

    lastFocusBeforeToast = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (toastTransitionTimer) window.clearTimeout(toastTransitionTimer);
    wrap.classList.remove('hidden');
    wrap.setAttribute('aria-hidden', 'false');

    // Fade in: ensure the "from" styles are applied before switching to "to" styles.
    wrap.classList.add('opacity-0', 'translate-y-2');
    wrap.classList.remove('opacity-100', 'translate-y-0');
    // Force layout so the browser commits the initial state (prevents "just appears").
    void wrap.getBoundingClientRect();
    wrap.classList.remove('opacity-0', 'translate-y-2');
    wrap.classList.add('opacity-100', 'translate-y-0');

    if (toastHideTimer) window.clearTimeout(toastHideTimer);
    toastHideTimer = window.setTimeout(() => closeToast(), timeoutMs);
}

function closeToast() {
    const wrap = getToastWrap();
    if (!wrap) return;

    // Avoid hiding a focused element from assistive tech (prevents aria-hidden warning).
    const active = document.activeElement;
    if (active instanceof HTMLElement && wrap.contains(active)) {
        active.blur();
    }

    if (toastHideTimer) window.clearTimeout(toastHideTimer);
    toastHideTimer = null;

    if (lastFocusBeforeToast && document.contains(lastFocusBeforeToast)) {
        queueMicrotask(() => lastFocusBeforeToast?.focus());
    }
    lastFocusBeforeToast = null;

    // Fade out, then fully hide
    if (toastTransitionTimer) window.clearTimeout(toastTransitionTimer);
    wrap.classList.remove('opacity-100', 'translate-y-0');
    wrap.classList.add('opacity-0', 'translate-y-2');
    toastTransitionTimer = window.setTimeout(() => {
        wrap.classList.add('hidden');
        wrap.setAttribute('aria-hidden', 'true');
        toastTransitionTimer = null;
    }, TOAST_TRANSITION_MS);
}

function renderToastHtml(data) {
    const tpl = document.getElementById('global-toast-template');
    if (!(tpl instanceof HTMLTemplateElement)) return null;
    const html = tpl.innerHTML;
    const render = Handlebars.compile(html);
    return render(data || {});
}

// Public API
export const GrasprToast = {
    show({ message, status = 'success', timeoutMs = DEFAULT_TOAST_MS } = {}) {
        const wrap = getToastWrap();
        const content = document.getElementById('global-toast-content');
        if (!wrap || !content) return;
        const html = renderToastHtml({ message, status });
        if (html) content.innerHTML = html;
        openToast({ timeoutMs });
    },
    close: closeToast,
};

// Handlebars helper for toast styling
export function registerToastHelpers(Handlebars) {
    Handlebars.registerHelper('toastClass', (status) => {
        const s = String(status || 'success').toLowerCase();
        const normalized = s === 'eror' ? 'error' : s;

        // Use CSS-var-driven classes for themeable toasts
        switch (normalized) {
            case 'warning':
                return 'graspr-toast-warning';
            case 'error':
                return 'graspr-toast-error';
            case 'success':
            default:
                return 'graspr-toast-success';
        }
    });
}

// Toast event handlers
export function initToastEventHandlers() {
    // Close toast on dismiss button
    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('[data-toast-close]');
        if (!closeBtn) return;
        closeToast();
    });

    // Auto-show toast when HTMX swaps content into the toast container
    document.body.addEventListener('htmx:afterSwap', (e) => {
        const target = e.detail?.target;
        if (target && target.id === 'global-toast-content') {
            openToast();
        }
    });
}

// Internal exports for use by other modules
export { openToast, closeToast };
