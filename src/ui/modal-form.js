// ---------------------------
// Modal Form Utility
// ---------------------------
// Provides a unified way to open forms in the global modal.

import Handlebars from 'handlebars';
import htmx from '../lib/htmx.js';
import { openGlobalModal } from './modal.js';

/**
 * Opens a form in the global modal with the given configuration.
 *
 * @param {Object} config - Configuration object
 * @param {string} config.templateId - ID of the template element (without #)
 * @param {string} config.title - Modal title text
 * @param {string} [config.formUrl] - URL to set on form's hx-patch/hx-post and action attributes
 * @param {'post'|'patch'} [config.formMethod] - HTTP method for the form
 * @param {Object} [config.fields] - Object mapping field names to values to populate
 * @param {string[]} [config.removeFields] - Array of field names to remove from the form
 * @param {string} [config.submitButtonText] - Text to set on the submit button
 * @param {boolean} [config.clearErrors=true] - Whether to clear existing form errors
 * @param {string} [config.focusSelector] - Selector for element to focus (defaults to first input)
 * @param {function} [config.beforeOpen] - Callback(content, form) for custom setup before modal opens
 * @param {'sm'|'takeover'|'default'} [config.size] - Modal size variant
 */
export function openFormModal({
    templateId,
    title,
    formUrl,
    formMethod,
    fields,
    removeFields,
    submitButtonText,
    clearErrors = true,
    focusSelector,
    beforeOpen,
    size,
}) {
    const template = document.getElementById(templateId);
    const content = document.getElementById('global-modal-content');
    const dialog = document.querySelector('#global-modal [role="dialog"]');
    const titleEl = document.getElementById('global-modal-title');

    if (!template || !content) {
        console.error('openFormModal: template or modal content not found', { templateId });
        return;
    }

    // Set modal title
    if (titleEl) {
        titleEl.textContent = title;
    }

    // Set modal size
    const modal = document.getElementById('global-modal');
    if (dialog) {
        dialog.classList.remove('modal-sm', 'modal-lg');
        if (size === 'sm') {
            dialog.classList.add('modal-sm');
        } else if (size === 'lg') {
            dialog.classList.add('modal-lg');
        }
    }
    if (modal) {
        modal.classList.remove('modal-takeover');
        if (size === 'takeover') {
            modal.classList.add('modal-takeover');
        }
    }

    // Inject template HTML — compile through Handlebars to resolve partials
    // (e.g. {{> formButtons}}). innerHTML escapes ">" to "&gt;" per the HTML
    // serialization spec, so unescape partial calls first.
    const source = template.innerHTML.replaceAll('{{&gt;', '{{>');
    content.innerHTML = Handlebars.compile(source)({});

    // Find the form
    const form = content.querySelector('form');

    if (form) {
        // Set form URL and method if provided
        if (formUrl) {
            if (formMethod === 'patch') {
                form.removeAttribute('hx-post');
                form.setAttribute('hx-patch', formUrl);
                form.setAttribute('method', 'patch');
            } else if (formMethod === 'post') {
                form.removeAttribute('hx-patch');
                form.setAttribute('hx-post', formUrl);
                form.setAttribute('method', 'post');
            }
            form.setAttribute('action', formUrl);
        }

        // Remove specified fields
        if (removeFields && Array.isArray(removeFields)) {
            for (const fieldName of removeFields) {
                const field = form.querySelector(`[name="${fieldName}"]`);
                if (field) {
                    field.remove();
                }
            }
        }

        // Populate fields
        if (fields && typeof fields === 'object') {
            for (const [name, value] of Object.entries(fields)) {
                const input = form.querySelector(`[name="${name}"]`);
                if (input) {
                    if (input.tagName === 'TEXTAREA') {
                        input.value = value || '';
                    } else if (input.tagName === 'INPUT') {
                        input.value = value || '';
                    } else if (input.tagName === 'SELECT') {
                        input.value = value || '';
                    }
                }
            }
        }

        // Update submit button text if provided
        if (submitButtonText) {
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = submitButtonText;
            }
        }

        // Clear form errors if requested
        if (clearErrors) {
            content.querySelectorAll('.field-error-text').forEach((el) => {
                el.textContent = '';
                el.classList.add('hidden');
            });
            content.querySelectorAll('.form-field').forEach((el) => {
                el.classList.remove('has-error');
            });
            content.querySelectorAll('.field-error').forEach((el) => {
                el.classList.remove('field-error');
            });
        }

        // Call custom setup callback if provided
        if (typeof beforeOpen === 'function') {
            beforeOpen(content, form);
        }
    }

    // Process HTMX attributes
    htmx.process(content);

    // Open the modal
    openGlobalModal();

    // Focus the appropriate element
    const focusTarget = focusSelector
        ? content.querySelector(focusSelector)
        : content.querySelector('input, select, textarea, button');
    if (focusTarget) {
        focusTarget.focus();
    }
}
