// ---------------------------
// Pagination controls
// ---------------------------
// Wires up paginated HTMX sources, prev/next buttons, goto-page forms,
// and popstate re-sync. Self-registering — also exports initPagination()
// for use in DOMContentLoaded/afterSwap orchestration.

import htmx from '../lib/htmx.js';
import { setUrlParam, getUrlParamInt, mergeHxVals } from './navigation.js';

/**
 * Wire paginated HTMX sources to read the current page from the URL.
 * @param {Document|HTMLElement} root - The root to search within
 */
export function initPagination(root = document) {
    root.querySelectorAll('[data-pagination-param]').forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        const param = el.getAttribute('data-pagination-param') || 'page';
        const page = getUrlParamInt(param, 1);
        mergeHxVals(el, { [param]: page });
    });
}

// Pagination controls: Prev/Next
// Buttons are rendered by the pagination component template and carry:
// - data-page="N"
// - data-pagination-source="#selector-for-hx-element"
// - data-pagination-param="page"
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="paginate-prev"], [data-action="paginate-next"]');
    if (!(btn instanceof HTMLElement)) return;

    const pageStr = btn.getAttribute('data-page') || '';
    const page = parseInt(pageStr, 10);
    if (!Number.isFinite(page) || page <= 0) return;

    const sourceSel = btn.getAttribute('data-pagination-source') || '';
    const param = btn.getAttribute('data-pagination-param') || 'page';
    if (!sourceSel) return;

    const sourceEl = document.querySelector(sourceSel);
    if (!(sourceEl instanceof HTMLElement)) return;

    mergeHxVals(sourceEl, { [param]: page });

    // Update URL so pagination is shareable and back/forward works.
    setUrlParam(param, page);

    // Trigger the refresh request (and pagination will re-render from the response meta).
    if (typeof htmx?.trigger === 'function') {
        htmx.trigger(sourceEl, 'refresh');
    }
});

// Pagination controls: Go to page
document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-action="paginate-goto"]');
    if (!form) return;
    e.preventDefault();

    const input = form.querySelector('input[type="number"]');
    if (!input) return;

    const page = parseInt(input.value, 10);
    const lastPage = parseInt(form.getAttribute('data-last-page') || '1', 10);
    if (!Number.isFinite(page) || page < 1 || page > lastPage) return;

    const sourceSel = form.getAttribute('data-pagination-source') || '';
    const param = form.getAttribute('data-pagination-param') || 'page';
    if (!sourceSel) return;

    const sourceEl = document.querySelector(sourceSel);
    if (!(sourceEl instanceof HTMLElement)) return;

    mergeHxVals(sourceEl, { [param]: page });
    setUrlParam(param, page);

    if (typeof htmx?.trigger === 'function') {
        htmx.trigger(sourceEl, 'refresh');
    }
});

// Re-sync paginated sources on back/forward navigation.
window.addEventListener('popstate', () => {
    document.querySelectorAll('[data-pagination-param]').forEach((el) => {
        if (!(el instanceof HTMLElement)) return;
        const param = el.getAttribute('data-pagination-param') || 'page';
        const page = getUrlParamInt(param, 1);
        mergeHxVals(el, { [param]: page });
        if (typeof htmx?.trigger === 'function') {
            htmx.trigger(el, 'refresh');
        }
    });
});
