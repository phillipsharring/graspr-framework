// ---------------------------
// Search input wiring (delegated)
// ---------------------------
// Debounced search: updates hx-get URL on target element and triggers refresh.
// Usage: <input data-search-target="#some-htmx-element" data-search-endpoint="/api/foo" />
// Fully self-registering — import for side effects only.

import htmx from '../lib/htmx.js';
import { debounce, scrubSearchInput } from '../helpers/index.js';
import { setUrlParam, mergeHxVals } from './navigation.js';

const searchDebouncers = new WeakMap();

document.addEventListener('input', (e) => {
    const input = e.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (!input.dataset.searchTarget) return;

    const targetSelector = input.dataset.searchTarget;
    const baseEndpoint = input.dataset.searchEndpoint || '/api/series';

    // Get or create debouncer for this input
    let debouncedSearch = searchDebouncers.get(input);
    if (!debouncedSearch) {
        debouncedSearch = debounce((inp, sel, endpoint) => {
            const target = document.querySelector(sel);
            if (!(target instanceof HTMLElement)) return;

            const rawValue = inp.value.trim();
            const scrubbed = scrubSearchInput(rawValue);

            // Detect UUID pattern
            const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const isUuid = uuidPattern.test(scrubbed);

            let url = endpoint;
            if (scrubbed) {
                const paramKey = isUuid ? 'id' : 'search';
                const params = new URLSearchParams({ [paramKey]: scrubbed });
                url = `${endpoint}?${params.toString()}`;
            }

            // Reset pagination to page 1 so search results aren't empty on page N
            const pageParam = target.getAttribute('data-pagination-param') || 'page';
            mergeHxVals(target, { [pageParam]: 1 });
            setUrlParam(pageParam, null);

            // Show loading state, then trigger refresh after min visible duration
            target.classList.add('search-loading');
            setTimeout(() => {
                target.setAttribute('hx-get', url);
                htmx.process(target);

                if (typeof htmx?.trigger === 'function') {
                    htmx.trigger(target, 'refresh');
                }
            }, 100);
        }, 350);
        searchDebouncers.set(input, debouncedSearch);
    }

    debouncedSearch(input, targetSelector, baseEndpoint);
});

// Remove search loading state after swap completes
document.body.addEventListener('htmx:afterSwap', (e) => {
    const target = e.detail?.target;
    if (target instanceof HTMLElement) {
        target.classList.remove('search-loading');
    }
});

// Re-init after HTMX history cache restoration (back/forward navigation)
document.body.addEventListener('htmx:historyRestore', () => {
    // No-op — search inputs are stateless (delegated input handler re-attaches automatically).
    // Kept for documentation: if search inputs ever need re-initialization, add it here.
});
