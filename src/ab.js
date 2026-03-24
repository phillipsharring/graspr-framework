// ---------------------------
// A/B Testing Module
// ---------------------------
// Fetches variant assignments once per page lifetime from the backend,
// then re-applies them after each boosted navigation (new #app content).
//
// Initialization is automatic via lifecycle hooks — pages only need to:
//   1. Use data-ab-test / data-ab-variant attributes for static variant HTML
//   2. Use data-ab-capture="event-name" on clickable elements for conversion tracking
//   3. Or call BQ.ab.capture('event-name') programmatically

import { apiFetch, onPageLoad, onAfterSettle } from '@phillipsharring/graspr-framework';

let assignments = null;
let fetched = false;

/**
 * Fetch assignments from the backend (once per page lifetime).
 * Stores them in module scope for capture() and getAssignments().
 */
function fetchAssignments() {
    if (fetched) {
        applyVariants();
        return;
    }
    fetched = true;

    apiFetch('/api/ab/assignments')
        .then(function (r) { return r.json(); })
        .then(function (res) {
            assignments = (res.data && res.data.assignments) || {};
            applyVariants();
        })
        .catch(function () {
            assignments = {};
            // Fallback: show variant "a" elements
            var els = document.querySelectorAll('[data-ab-variant="a"]');
            els.forEach(function (el) { el.style.display = ''; });
        });
}

/**
 * Show/hide elements with data-ab-test / data-ab-variant attributes
 * based on current assignments.
 */
function applyVariants() {
    if (!assignments) return;

    var els = document.querySelectorAll('[data-ab-test]');
    if (!els.length) return;

    els.forEach(function (el) {
        var testName = el.getAttribute('data-ab-test');
        var variant = el.getAttribute('data-ab-variant');
        if (assignments[testName] === variant) {
            el.style.display = '';
        } else {
            el.remove();
        }
    });

    // Auto-capture impression when variant elements are on the page
    if (Object.keys(assignments).length) {
        capture('impression');
    }
}

/**
 * Record a conversion event with current assignments.
 * No-op if there are no active assignments.
 * @param {string} event - Event name (e.g. 'signup', 'purchase')
 */
export function capture(event) {
    if (!assignments || !Object.keys(assignments).length) return;

    apiFetch('/api/ab/capture', {
        method: 'POST',
        body: { event: event, assignments: assignments },
    }).catch(function () {});
}

/**
 * Get current assignments (may be null if not yet fetched).
 * @returns {{ [testName: string]: string } | null}
 */
export function getAssignments() {
    return assignments;
}

// ── Auto-initialize via lifecycle hooks ──

onPageLoad(fetchAssignments);
onAfterSettle(fetchAssignments);

// ── Delegated click handler for data-ab-capture ──

document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-ab-capture]');
    if (!el) return;
    capture(el.getAttribute('data-ab-capture'));
});
