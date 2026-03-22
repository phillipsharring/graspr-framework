// ---------------------------
// Form error handling + modal form lifecycle
// ---------------------------
// Manages inline form errors, error response interception, form submission
// tracking, modal auto-open on content swap, and modal close + refresh on success.
// Fully self-registering — import for side effects only.

import htmx from '../lib/htmx.js';
import { GrasprToast } from '../ui/toast.js';
import {
    openGlobalModal,
    closeGlobalModal,
    isGlobalModalOpen,
} from '../ui/index.js';

// ---------------------------
// Form inline error handling
// ---------------------------

/**
 * Show inline errors on form fields.
 * @param {HTMLFormElement} form - The form element
 * @param {Object} errors - Object mapping field names to error messages
 * @param {string} generalMessage - General error message for the form
 */
function showFormErrors(form, errors, generalMessage) {
    if (!(form instanceof HTMLFormElement)) {
        return;
    }

    // Show field-level errors
    for (const [fieldName, errorMessage] of Object.entries(errors || {})) {
        const input = form.querySelector(`[name="${fieldName}"]`);
        if (!input) continue;

        // Add error class to input
        input.classList.add('field-error');

        // Find or create error text element
        let errorText = input.parentElement?.querySelector('.field-error-text');
        if (!errorText) {
            errorText = document.createElement('div');
            errorText.className = 'field-error-text hidden';
            input.parentElement?.appendChild(errorText);
        }

        errorText.textContent = errorMessage;
        errorText.classList.remove('hidden');
    }

    // Show general error message at top of form
    if (generalMessage) {
        let errorBanner = form.querySelector('.form-error-banner');
        if (!errorBanner) {
            errorBanner = document.createElement('div');
            errorBanner.className = 'form-error-banner';
            form.insertBefore(errorBanner, form.firstChild);
        }
        errorBanner.textContent = generalMessage;
    }
}

/**
 * Clear all inline errors from a form.
 * @param {HTMLFormElement} form - The form element
 */
function clearFormErrors(form) {
    if (!(form instanceof HTMLFormElement)) return;

    // Remove error classes from inputs
    form.querySelectorAll('.field-error').forEach((input) => {
        input.classList.remove('field-error');
    });

    // Hide error text elements
    form.querySelectorAll('.field-error-text').forEach((errorText) => {
        errorText.classList.add('hidden');
        errorText.textContent = '';
    });

    // Remove error banner
    form.querySelectorAll('.form-error-banner').forEach((banner) => {
        banner.remove();
    });
}

/**
 * Clear error state for a specific field.
 * @param {HTMLElement} input - The input element
 */
function clearFieldError(input) {
    if (!(input instanceof HTMLElement)) return;

    input.classList.remove('field-error');

    const errorText = input.parentElement?.querySelector('.field-error-text');
    if (errorText) {
        errorText.classList.add('hidden');
        errorText.textContent = '';
    }
}

// Clear field errors when user interacts with the field
document.addEventListener('focus', (e) => {
    const input = e.target;
    if (input instanceof HTMLElement && input.classList.contains('field-error')) {
        clearFieldError(input);
    }
}, true);

// ---------------------------
// Form submission tracking
// ---------------------------

// Track the currently submitting form for error handling
let currentSubmittingForm = null;

document.body.addEventListener('htmx:beforeRequest', (e) => {
    const elt = e.detail?.elt;
    if (elt instanceof HTMLFormElement) {
        currentSubmittingForm = elt;
    } else if (elt instanceof Element) {
        currentSubmittingForm = elt.closest('form');
    }
});

// ---------------------------
// Error response interception
// ---------------------------

// Intercept HTMX responses BEFORE swap to handle form errors (inline or toast)
document.body.addEventListener('htmx:beforeSwap', (e) => {
    const detail = e.detail || {};
    const xhr = detail.xhr;
    const elt = detail.elt;

    // Try to parse JSON response
    let responseData = null;
    try {
        const responseText = xhr?.responseText;
        if (responseText) {
            responseData = JSON.parse(responseText);
        }
    } catch {
        // Not JSON or parsing failed
        return;
    }

    // Check if this is an error response
    const status = responseData?.status;
    const message = responseData?.message;

    if (status !== 'error' || !message) {
        return; // Not an error response, let HTMX handle normally
    }

    // Find the form that triggered this request
    // Use the tracked form first, then try to detect from the element
    let form = currentSubmittingForm;

    if (!form && elt instanceof HTMLFormElement) {
        form = elt;
    } else if (!form && elt instanceof Element) {
        form = elt.closest('form');
    }

    // If elt is not inside a form (e.g., it's the toast target), look for forms in the modal
    if (!form && isGlobalModalOpen()) {
        form = document.querySelector('#global-modal-content form[data-form-errors="inline"]');
    }

    const useInlineErrors = form?.getAttribute('data-form-errors') === 'inline';
    const hasFieldErrors = responseData.errors && typeof responseData.errors === 'object' && Object.keys(responseData.errors).length > 0;

    // Handle error responses
    if (useInlineErrors && hasFieldErrors) {
        // Show inline errors on the form - prevent the swap to toast
        detail.shouldSwap = false;
        clearFormErrors(form);
        showFormErrors(form, responseData.errors, message);
    } else if (useInlineErrors && !hasFieldErrors) {
        // Invariant/form-level errors on inline-error forms: show in form, not toast
        detail.shouldSwap = false;
        clearFormErrors(form);
        showFormErrors(form, {}, message);
    } else {
        // Forms without inline errors: show toast
        // Allow the swap if targeting toast, otherwise show manually
        if (detail.target && detail.target.id === 'global-toast-content') {
            detail.shouldSwap = true; // Allow HTMX to swap the error response into toast
        } else {
            detail.shouldSwap = false;
            GrasprToast?.show?.({ message, status: 'error' });
        }
    }
});

// ---------------------------
// Modal auto-open + close/refresh on success
// ---------------------------

// If an HTMX request swaps content into the modal container, auto-open it.
document.body.addEventListener('htmx:afterSwap', (e) => {
    const target = e.detail?.target;
    if (target && target.id === 'global-modal-content') {
        openGlobalModal();
    }
});

// If an HTMX request is triggered from inside the global modal and succeeds,
// automatically dismiss the modal.
//
// Example: POST /api/series from the "Create series" modal should close the modal on success.
document.body.addEventListener('htmx:afterRequest', (e) => {
    // Clear the tracked submitting form
    currentSubmittingForm = null;

    const detail = e.detail || {};
    const xhr = detail.xhr;
    const status = typeof xhr?.status === 'number' ? xhr.status : null;
    const ok = status !== null ? status >= 200 && status < 300 : !!detail.successful;
    if (!ok) return;
    if (!isGlobalModalOpen()) return;

    const elt = detail.elt;
    if (!(elt instanceof Element)) return;

    // Only close if the request originated inside the modal (not just targeting it).
    if (elt.closest('#global-modal')) {
        // Check for success redirect - first from response meta, then from data attribute
        const form = elt.closest('form');
        let successRedirect = form?.getAttribute('data-success-redirect');

        // Try to get redirect from response meta
        try {
            const responseData = JSON.parse(xhr?.responseText || '{}');
            if (responseData.meta?.redirect) {
                successRedirect = responseData.meta.redirect;
            }
        } catch {
            // Ignore parse errors
        }

        if (successRedirect) {
            // If already on a real page (not landing/login), reload in place —
            // auth-state.js handles permission checks after the page loads.
            const currentPath = window.location.pathname;
            if (currentPath !== '/' && !currentPath.startsWith('/login') && !currentPath.startsWith('/signup')) {
                window.location.reload();
            } else {
                window.location.href = successRedirect;
            }
            return;
        }

        closeGlobalModal();

        // Clear any form errors on successful submit
        if (form instanceof HTMLFormElement) {
            clearFormErrors(form);
        }

        // Optional: refresh something after a successful modal submit.
        // Two patterns supported:
        //
        // 1. data-refresh-target="#some-element" — fires HTMX "refresh" trigger
        //    on the element (used by list pages with hx-trigger="... refresh").
        //
        // 2. data-refresh-event="event-name" — dispatches a custom event on
        //    document.body (used by detail pages where multiple elements listen
        //    via hx-trigger="... event-name from:body").
        //
        // Both are read from the form first, then from the triggering element.

        const refreshSelector = form?.getAttribute('data-refresh-target')
            || elt.getAttribute('data-refresh-target')
            || elt.getAttribute('data-refresh-click');
        if (refreshSelector) {
            const refreshEl = document.querySelector(refreshSelector);
            if (refreshEl instanceof HTMLElement && typeof htmx?.trigger === 'function') {
                htmx.trigger(refreshEl, 'refresh');
            }
        }

        const refreshEvent = form?.getAttribute('data-refresh-event') || elt.getAttribute('data-refresh-event');
        if (refreshEvent) {
            document.body.dispatchEvent(new CustomEvent(refreshEvent, { bubbles: true }));
        }
    }
});
