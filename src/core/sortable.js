// ---------------------------
// Drag-and-drop sorting (delegated)
// ---------------------------
// Initializes SortableJS on elements with [data-sortable] after HTMX swaps.
// Sends PATCH with redistributed sort_order values on drag end.
// Fully self-registering — import for side effects only.

import Sortable from 'sortablejs';
import htmx from '../lib/htmx.js';
import { GrasprToast } from '../ui/toast.js';

const instances = new WeakMap();

function isSearchActive(container) {
    const hxGet = container.getAttribute('hx-get') || '';
    return hxGet.includes('search=');
}

function initSortable(container) {
    // Tear down previous instance
    const prev = instances.get(container);
    if (prev) {
        prev.destroy();
        instances.delete(container);
    }

    // Disable when search is active
    if (isSearchActive(container)) {
        container.classList.add('sortable-disabled');
        return;
    }
    container.classList.remove('sortable-disabled');

    const endpoint = container.dataset.sortableEndpoint;
    const key = container.dataset.sortableKey || 'locations';
    if (!endpoint) return;

    const sortable = new Sortable(container, {
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd(evt) {
            if (evt.oldIndex === evt.newIndex) return;

            const rows = Array.from(container.querySelectorAll('tr[data-id]'));
            if (rows.length === 0) return;

            // Collect existing sort_order values and sort them numerically
            const sortOrders = rows
                .map((row) => parseInt(row.dataset.sortOrder, 10))
                .filter((n) => !isNaN(n))
                .sort((a, b) => a - b);

            if (sortOrders.length !== rows.length) return;

            // Redistribute: assign sorted values in new DOM order
            const payload = rows.map((row, i) => {
                const newOrder = sortOrders[i];
                // Optimistic UI: update data attribute and visible display
                row.dataset.sortOrder = String(newOrder);
                const display = row.querySelector('[data-sort-order-display]');
                if (display) display.textContent = String(newOrder);
                return { id: row.dataset.id, sort_order: newOrder };
            });

            // Send to server
            fetch(endpoint, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [key]: payload }),
            })
                .then((res) => {
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return res.json();
                })
                .then(() => {
                    GrasprToast?.show({ message: 'Sort order updated.', status: 'success' });
                })
                .catch(() => {
                    GrasprToast?.show({ message: 'Failed to update sort order.', status: 'error' });
                    // Reload server state
                    if (typeof htmx?.trigger === 'function') {
                        htmx.trigger(container, 'refresh');
                    }
                });
        },
    });

    instances.set(container, sortable);
}

function initAllSortables(root) {
    const containers = root.querySelectorAll
        ? root.querySelectorAll('[data-sortable]')
        : [];

    // Also check if root itself is a sortable container
    if (root instanceof HTMLElement && root.hasAttribute('data-sortable')) {
        initSortable(root);
    }

    containers.forEach((el) => initSortable(el));
}

// Init on full page load
document.addEventListener('DOMContentLoaded', () => {
    initAllSortables(document);
});

// Re-init after HTMX swaps (covers self-loading tbody, boosted nav, search clear)
document.body.addEventListener('htmx:afterSwap', (e) => {
    const target = e.detail?.target;
    if (!target) return;
    initAllSortables(target);
});
