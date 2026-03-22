// ---------------------------
// Table column sorting (delegated)
// ---------------------------
// Clickable <th data-sort="column"> headers that toggle asc/desc sorting.
// Sort state is persisted in URL query params (?sort=col&dir=asc).
// Fully self-registering — import for side effects only.
// Also exports initTableSort() for use in DOMContentLoaded/afterSwap orchestration.

import htmx from '../lib/htmx.js';
import { setUrlParam, getUrlParam, mergeHxVals } from './navigation.js';

/**
 * Apply sort indicator classes to th[data-sort] headers based on current sort state.
 * @param {Document|HTMLElement} root
 */
export function initTableSort(root = document) {
    const sortCol = getUrlParam('sort');
    const sortDir = getUrlParam('dir');

    root.querySelectorAll('th[data-sort]').forEach((th) => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (sortCol && th.dataset.sort === sortCol) {
            th.classList.add(sortDir === 'desc' ? 'sort-desc' : 'sort-asc');
        }
    });

    // Set hx-vals on sortable tbody elements so the initial API request includes sort params
    if (sortCol) {
        root.querySelectorAll('th[data-sort]').forEach((th) => {
            const tbody = th.closest('table')?.querySelector('tbody');
            if (tbody instanceof HTMLElement && !tbody.dataset.sortInit) {
                mergeHxVals(tbody, { sort: sortCol, dir: sortDir || 'asc' });
                tbody.dataset.sortInit = '1';
            }
        });
    }
}

// Delegated click handler for sort headers
document.addEventListener('click', (e) => {
    const th = e.target.closest('th[data-sort]');
    if (!th) return;

    const column = th.dataset.sort;
    const tbody = th.closest('table')?.querySelector('tbody');
    if (!(tbody instanceof HTMLElement)) return;

    // Determine new direction: toggle if same column, else default to asc
    const currentSort = getUrlParam('sort');
    const currentDir = getUrlParam('dir');
    let newDir = 'asc';
    if (column === currentSort) {
        newDir = currentDir === 'asc' ? 'desc' : 'asc';
    }

    // Update sort indicator classes on all sibling headers
    const thead = th.closest('thead');
    if (thead) {
        thead.querySelectorAll('th[data-sort]').forEach((sibling) => {
            sibling.classList.remove('sort-asc', 'sort-desc');
        });
    }
    th.classList.add(newDir === 'desc' ? 'sort-desc' : 'sort-asc');

    // Reset pagination to page 1
    const pageParam = tbody.getAttribute('data-pagination-param') || 'page';
    mergeHxVals(tbody, { sort: column, dir: newDir, [pageParam]: 1 });
    setUrlParam(pageParam, null);

    // Update URL for bookmarkability
    setUrlParam('sort', column);
    setUrlParam('dir', newDir);

    // Trigger refresh
    htmx.process(tbody);
    if (typeof htmx?.trigger === 'function') {
        htmx.trigger(tbody, 'refresh');
    }
});

// Re-sync sort state on back/forward navigation
window.addEventListener('popstate', () => {
    const sortCol = getUrlParam('sort');
    const sortDir = getUrlParam('dir');

    document.querySelectorAll('th[data-sort]').forEach((th) => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (sortCol && th.dataset.sort === sortCol) {
            th.classList.add(sortDir === 'desc' ? 'sort-desc' : 'sort-asc');
        }
    });

    // Update hx-vals on tbody elements
    document.querySelectorAll('th[data-sort]').forEach((th) => {
        const tbody = th.closest('table')?.querySelector('tbody');
        if (tbody instanceof HTMLElement) {
            if (sortCol) {
                mergeHxVals(tbody, { sort: sortCol, dir: sortDir || 'asc' });
            } else {
                // Remove sort params from hx-vals when URL has none
                let existing = {};
                try {
                    existing = JSON.parse(tbody.getAttribute('hx-vals') || '{}');
                } catch { /* ignore */ }
                delete existing.sort;
                delete existing.dir;
                tbody.setAttribute('hx-vals', JSON.stringify(existing));
            }
        }
    });
});
