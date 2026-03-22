import { escapeHtml } from '../helpers/escape-html.js';

/**
 * Reusable typeahead/autocomplete widget factory.
 *
 * @param {Object} options
 * @param {Element} options.input - text input element
 * @param {Element} options.dropdown - dropdown container element
 * @param {Function} options.onSelect - called with the selected item
 * @param {Array} [options.items] - searchable items (each should have .name)
 * @param {Function} [options.renderItem] - (item) → innerHTML string
 * @param {Function} [options.filterItem] - (item, query) → boolean
 * @param {Array} [options.prependItems] - items always prepended to results
 * @param {string|null} [options.noMatchText] - text when no results; null hides dropdown
 * @param {number} [options.minQueryLength] - 0 = show all on empty, 1+ = require chars
 * @param {number} [options.debounceMs] - debounce input events
 * @param {boolean} [options.clearOnSelect] - clear input after selection
 * @param {Element} [options.closeParent] - for outside-click detection
 * @returns {{ setItems: Function, destroy: Function }}
 */
export function createTypeahead({
    input,
    dropdown,
    onSelect,
    items = [],
    renderItem,
    filterItem,
    prependItems = [],
    noMatchText = 'No matches',
    minQueryLength = 1,
    debounceMs = 0,
    clearOnSelect = false,
    closeParent,
}) {
    var highlightIndex = -1;
    var debounceTimer = null;

    if (!renderItem) {
        renderItem = function(item) { return escapeHtml(item.name); };
    }
    if (!filterItem) {
        filterItem = function(item, query) {
            return item.name.toLowerCase().indexOf(query) !== -1;
        };
    }

    function getFiltered() {
        var query = input.value.trim().toLowerCase();
        var matches = query
            ? items.filter(function(item) { return filterItem(item, query); })
            : items;
        return prependItems.concat(matches);
    }

    function render() {
        var query = input.value.trim().toLowerCase();
        if (query.length < minQueryLength) {
            hide();
            return;
        }

        var filtered = getFiltered();

        if (filtered.length === 0) {
            if (noMatchText) {
                dropdown.innerHTML = '<div class="px-3 py-2 text-sm text-slate-400">' + escapeHtml(noMatchText) + '</div>';
                dropdown.classList.remove('hidden');
            } else {
                hide();
            }
            highlightIndex = -1;
            return;
        }

        var html = '';
        filtered.forEach(function(item, i) {
            html += '<div class="px-3 py-2 text-sm cursor-pointer hover:bg-slate-100" data-ta-index="' + i + '">';
            html += renderItem(item);
            html += '</div>';
        });
        dropdown.innerHTML = html;
        dropdown.classList.remove('hidden');
        highlightIndex = -1;

        // Mousedown (not click) so input keeps focus
        dropdown.querySelectorAll('[data-ta-index]').forEach(function(el) {
            el.addEventListener('mousedown', function(e) {
                e.preventDefault();
                select(filtered[parseInt(el.dataset.taIndex, 10)]);
            });
        });
    }

    function highlight() {
        var els = dropdown.querySelectorAll('[data-ta-index]');
        els.forEach(function(el, i) {
            if (i === highlightIndex) {
                el.classList.add('bg-slate-100');
                el.scrollIntoView({ block: 'nearest' });
            } else {
                el.classList.remove('bg-slate-100');
            }
        });
    }

    function hide() {
        dropdown.classList.add('hidden');
        highlightIndex = -1;
    }

    function select(item) {
        hide();
        if (clearOnSelect) input.value = '';
        onSelect(item);
    }

    function onInput() {
        if (debounceMs > 0) {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(render, debounceMs);
        } else {
            render();
        }
    }

    function onFocus() {
        if (input.value.trim().length >= minQueryLength) {
            render();
        }
    }

    function onKeydown(e) {
        if (dropdown.classList.contains('hidden')) {
            if (e.key === 'ArrowDown' && minQueryLength === 0) {
                e.preventDefault();
                render();
            }
            return;
        }

        var els = dropdown.querySelectorAll('[data-ta-index]');
        if (els.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlightIndex = Math.min(highlightIndex + 1, els.length - 1);
            highlight();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlightIndex = Math.max(highlightIndex - 1, 0);
            highlight();
        } else if (e.key === 'Enter') {
            if (highlightIndex >= 0 && highlightIndex < els.length) {
                e.preventDefault();
                var filtered = getFiltered();
                select(filtered[highlightIndex]);
            }
        } else if (e.key === 'Escape') {
            hide();
        }
    }

    function onOutsideClick(e) {
        if (!input.contains(e.target) && !dropdown.contains(e.target)) {
            hide();
        }
    }

    input.addEventListener('input', onInput);
    input.addEventListener('focus', onFocus);
    input.addEventListener('keydown', onKeydown);

    var clickTarget = closeParent || document;
    clickTarget.addEventListener('click', onOutsideClick);

    return {
        setItems: function(newItems) { items = newItems; },
        destroy: function() {
            input.removeEventListener('input', onInput);
            input.removeEventListener('focus', onFocus);
            input.removeEventListener('keydown', onKeydown);
            clickTarget.removeEventListener('click', onOutsideClick);
            clearTimeout(debounceTimer);
        },
    };
}
