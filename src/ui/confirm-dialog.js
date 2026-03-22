import Handlebars from 'handlebars';
import htmx from '../lib/htmx.js';
import { GrasprToast } from './toast.js';
import {
    openGlobalModal,
    closeGlobalModal,
    getGlobalModalHeader,
    getGlobalModalCloseButton,
    setOnModalCloseWithConfirm,
} from './modal.js';

// ---------------------------
// Confirm Dialog
// ---------------------------

let confirmState = null;

function renderConfirmHtml(data) {
    const tpl = document.getElementById('global-confirm-template');
    if (!(tpl instanceof HTMLTemplateElement)) return null;
    const render = Handlebars.compile(tpl.innerHTML);
    return render(data || {});
}

function setConfirmMode(enabled) {
    const header = getGlobalModalHeader();
    const closeBtn = getGlobalModalCloseButton();
    const dialog = document.querySelector('#global-modal [role="dialog"]');
    if (enabled) {
        // Entering confirm mode
        if (header) header.classList.add('hidden');
        if (closeBtn) closeBtn.classList.add('hidden');
        if (dialog) {
            dialog.classList.add('confirm-mode');
            dialog.querySelectorAll('.card-detail-nav').forEach(btn => {
                btn.style.display = 'none';
            });
        }
    } else {
        // Exiting confirm mode — restore header/close/chevrons immediately,
        // but leave confirm-mode class for modal.js close transition to clean up
        if (header) header.classList.remove('hidden');
        if (closeBtn) closeBtn.classList.remove('hidden');
        if (dialog) {
            dialog.querySelectorAll('.card-detail-nav').forEach(btn => {
                btn.style.display = '';
            });
        }
    }
}

function finalizeConfirm(result) {
    if (!confirmState) return;
    const { resolve } = confirmState;
    confirmState = null;
    // Don't call setConfirmMode(false) — confirm-mode class is cleaned up
    // by modal.js after the close transition to avoid a flash of unstyled modal.
    setOnModalCloseWithConfirm(null);
    resolve(result);
}

async function runConfirmAction() {
    if (!confirmState) return;

    const okBtn = document.querySelector('#global-modal [data-confirm-ok]');
    const cancelBtn = document.querySelector('#global-modal [data-confirm-cancel]');
    if (okBtn instanceof HTMLButtonElement) okBtn.disabled = true;
    if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = true;

    try {
        if (typeof confirmState.onConfirm === 'function') {
            await confirmState.onConfirm();
        }
        finalizeConfirm(true);
        closeGlobalModal();
    } catch (err) {
        // Keep the modal open if the confirm action fails.
        console.error('Confirm action failed:', err);
        if (okBtn instanceof HTMLButtonElement) okBtn.disabled = false;
        if (cancelBtn instanceof HTMLButtonElement) cancelBtn.disabled = false;
    }
}

export const GrasprConfirm = {
    /**
     * Open a confirm dialog.
     * Returns a Promise<boolean> (true = confirmed, false = canceled).
     */
    open({ message, subtext = '', cancelText = 'Cancel', confirmText = 'Confirm', checkboxLabel = '', onConfirm } = {}) {
        const content = document.getElementById('global-modal-content');
        const title = document.getElementById('global-modal-title');
        if (!content) return Promise.resolve(false);

        // Replace modal content with confirm UI
        if (title) title.textContent = '';
        setConfirmMode(true);

        const html = renderConfirmHtml({ message, subtext, cancelText, confirmText, checkboxLabel });
        if (html) content.innerHTML = html;

        openGlobalModal();

        // Focus confirm by default
        const okBtn = content.querySelector('[data-confirm-ok]');
        if (okBtn instanceof HTMLElement) queueMicrotask(() => okBtn.focus());

        return new Promise((resolve) => {
            confirmState = { resolve, onConfirm };
            // Register callback so modal.js can cancel the confirm when modal is closed
            setOnModalCloseWithConfirm(() => finalizeConfirm(false));
        });
    },
};

// ---------------------------
// Helper Functions
// ---------------------------

function notifyAfterAction({ refreshTarget, trigger, payload, eventName }) {
    if (refreshTarget) {
        const el = document.querySelector(refreshTarget);
        if (el && typeof htmx?.trigger === 'function') {
            htmx.trigger(el, 'refresh');
        }
    }
    if (eventName) {
        const customEvent = new CustomEvent(eventName, { detail: { trigger, payload }, bubbles: true });
        document.body.dispatchEvent(customEvent);
    }
}

function parseDatasetValue(v) {
    if (v === '') return true;
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^-?\d+$/.test(v)) return Number.parseInt(v, 10);
    return v;
}

function getConfirmPayload(trigger) {
    const payload = {};
    for (const [k, v] of Object.entries(trigger.dataset || {})) {
        // Strip confirm-specific data-* keys; everything else becomes payload.
        if (k.startsWith('confirm')) continue;
        payload[k] = parseDatasetValue(v);
    }

    return payload;
}

async function runConfirmRequest({ method, url, payload, refreshTarget, trigger, eventName, spinner }) {
    const m = String(method || 'POST').toUpperCase();
    const u = String(url || '').trim();
    if (!u) return;

    if (spinner) {
        const content = document.getElementById('global-modal-content');
        if (content) content.innerHTML = renderSpinnerUI(spinner);
        // Prevent modal close while request is in flight
        setOnModalCloseWithConfirm(null);
    }

    try {
        const res = await fetch(u, {
            method: m,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload ?? {}),
        });

        // Try to show a toast based on JSON response (if any).
        let data = null;
        try {
            data = await res.json();
        } catch {
            // ignore
        }

        if (res.ok) {
            if (data && typeof data === 'object' && ('message' in data || 'status' in data)) {
                GrasprToast?.show?.({
                    message: String(data.message ?? 'Done.'),
                    status: String(data.status ?? 'success'),
                });
            } else {
                GrasprToast?.show?.({ message: 'Done.', status: 'success' });
            }
        } else {
            const msg = data?.error || data?.message || `Request failed (${res.status})`;
            GrasprToast?.show?.({ message: String(msg), status: 'error' });
            throw new Error(String(msg));
        }
    } finally {
        notifyAfterAction({ refreshTarget, trigger, payload, eventName });
    }
}

// ---------------------------
// Spinner Mode Helper
// ---------------------------

function renderSpinnerUI(message) {
    return `
        <div class="flex flex-col items-center gap-3 py-4">
            <svg class="animate-spin h-8 w-8 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p class="text-sm text-slate-600">${message}</p>
        </div>
    `;
}

// ---------------------------
// Progress Mode Helpers
// ---------------------------

async function fetchPendingCount(progressUrl) {
    try {
        const res = await fetch(progressUrl, {
            headers: { Accept: 'application/json' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        const count = data?.meta?.count ?? null;
        if (count === null) return null;
        return { count, total: data?.meta?.total ?? null };
    } catch {
        return null;
    }
}

function renderProgressUI(total, { progressLabel = 'Processing...', progressItemLabel = 'processed' } = {}) {
    return `
        <div class="space-y-4 py-2" data-progress-container>
            <p class="text-sm text-slate-700 font-medium">${progressLabel}</p>
            <div class="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                <div class="confirm-progress-bar bg-slate-700 h-3 rounded-full" style="width: 0%"></div>
            </div>
            <p class="text-sm text-slate-500" data-progress-text>0 of ${total} ${progressItemLabel}</p>
        </div>
    `;
}

function updateProgressUI(done, total, progressItemLabel = 'processed') {
    const bar = document.querySelector('#global-modal .confirm-progress-bar');
    const text = document.querySelector('#global-modal [data-progress-text]');
    const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
    if (bar) bar.style.width = `${pct}%`;
    if (text) text.textContent = `${done} of ${total} ${progressItemLabel}`;
}

async function runProgressLoop({
    method, url, payload, refreshTarget, trigger, eventName, total,
    progressLabel, progressItemLabel,
}) {
    const content = document.getElementById('global-modal-content');
    if (content) content.innerHTML = renderProgressUI(total, { progressLabel, progressItemLabel });

    // Prevent modal close during progress
    setOnModalCloseWithConfirm(null);

    let done = 0;

    while (done < total) {
        let generated = 0;
        try {
            const res = await fetch(url, {
                method: String(method || 'POST').toUpperCase(),
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                const data = await res.json();
                generated = data?.meta?.count ?? 0;
            } else {
                console.warn(`Generate images request failed (${res.status})`);
                break;
            }
        } catch (err) {
            console.warn('Generate images network error:', err);
            break;
        }

        if (generated === 0) break;
        done += generated;
        updateProgressUI(done, total, progressItemLabel);
    }

    // Brief pause before closing
    await new Promise((r) => setTimeout(r, 500));

    // Show toast
    if (done === total) {
        GrasprToast?.show?.({ message: `${done} of ${total} ${progressItemLabel}.`, status: 'success' });
    } else if (done > 0) {
        GrasprToast?.show?.({ message: `${done} of ${total} ${progressItemLabel}.`, status: 'warning' });
    } else {
        GrasprToast?.show?.({ message: `Nothing ${progressItemLabel}.`, status: 'error' });
    }

    notifyAfterAction({ refreshTarget, trigger, payload, eventName });
}

// ---------------------------
// Event Listeners
// ---------------------------

// Delegated HTML trigger:
// <button
//   data-confirm
//   data-confirm-message="Retire this series?"
//   data-confirm-subtext="This cannot be undone."
//   data-confirm-confirm-text="Confirm"
//   data-confirm-cancel-text="Cancel"
//   data-confirm-event="series:retire-confirmed"
//   data-confirm-progress-url="/api/admin/generate-images/count?type=series"
// >
document.addEventListener('click', async (e) => {
    const trigger = e.target.closest('[data-confirm]');
    if (!(trigger instanceof HTMLElement)) return;

    let message = trigger.getAttribute('data-confirm-message') || '';
    const subtext = trigger.getAttribute('data-confirm-subtext') || '';
    const confirmText = trigger.getAttribute('data-confirm-confirm-text') || 'Confirm';
    const cancelText = trigger.getAttribute('data-confirm-cancel-text') || 'Cancel';
    const eventName = trigger.getAttribute('data-confirm-event') || '';
    const payload = getConfirmPayload(trigger);
    const requestMethod = trigger.getAttribute('data-confirm-request-method') || '';
    const requestUrl = trigger.getAttribute('data-confirm-request-url') || '';
    const refreshTarget = trigger.getAttribute('data-confirm-refresh-target') || '';
    const progressUrl = trigger.getAttribute('data-confirm-progress-url') || '';
    const checkboxLabel = trigger.getAttribute('data-confirm-checkbox-label') || '';
    const checkboxKey = trigger.getAttribute('data-confirm-checkbox-key') || '';
    const spinner = trigger.getAttribute('data-confirm-spinner') || '';
    const progressLabel = trigger.getAttribute('data-confirm-progress-label') || 'Processing...';
    const progressItemLabel = trigger.getAttribute('data-confirm-progress-item-label') || 'processed';

    let progressTotal = 0;
    let preCheckForce = false;

    // Phase 1: Pre-fetch count for progress mode
    if (progressUrl) {
        trigger.disabled = true;
        const result = await fetchPendingCount(progressUrl);
        trigger.disabled = false;

        if (result === null) {
            GrasprToast?.show?.({ message: 'Could not fetch count.', status: 'error' });
            return;
        }

        const { count, total } = result;

        if (count === 0) {
            // Nothing missing — but if a force checkbox is offered and items exist,
            // show the dialog with the checkbox pre-checked so the user can regenerate.
            if (checkboxLabel && total > 0) {
                progressTotal = total;
                preCheckForce = true;
            } else {
                GrasprToast?.show?.({ message: 'Nothing to generate — all images already exist.', status: 'info' });
                return;
            }
        } else {
            progressTotal = count;
        }

        message = message.replace('{count}', String(progressTotal));
    }

    GrasprConfirm.open({
        message,
        subtext,
        confirmText,
        cancelText,
        checkboxLabel,
        onConfirm: async () => {
            // Read actual checkbox state — preCheckForce only affects the visual default
            const checkbox = document.querySelector('#global-modal [data-confirm-checkbox]');
            const checked = checkbox instanceof HTMLInputElement && checkbox.checked;
            if (checked && checkboxKey) {
                payload[checkboxKey] = true;
            }

            // If all images existed (preCheckForce) but user unchecked — nothing to do
            if (preCheckForce && !checked) {
                GrasprToast?.show?.({ message: 'Nothing to generate — all images already exist.', status: 'info' });
                return;
            }

            if (progressTotal > 0 && requestMethod && requestUrl) {
                let total = progressTotal;

                // If force was manually checked, re-fetch count including records with images
                // (when preCheckForce, progressTotal is already the full count)
                if (checked && !preCheckForce && progressUrl) {
                    const sep = progressUrl.includes('?') ? '&' : '?';
                    const forceResult = await fetchPendingCount(progressUrl + sep + 'force=1');
                    if (forceResult !== null && forceResult.count > 0) {
                        total = forceResult.count;
                    }
                }

                await runProgressLoop({
                    method: requestMethod,
                    url: requestUrl,
                    payload,
                    refreshTarget,
                    trigger,
                    eventName,
                    total,
                    progressLabel,
                    progressItemLabel,
                });
            } else if (requestMethod && requestUrl) {
                await runConfirmRequest({
                    method: requestMethod,
                    url: requestUrl,
                    payload,
                    refreshTarget,
                    trigger,
                    eventName,
                    spinner,
                });
            } else if (eventName) {
                notifyAfterAction({ trigger, payload, eventName });
            }
        },
    });

    // Visually pre-check the force checkbox when all images already exist
    if (preCheckForce) {
        const checkbox = document.querySelector('#global-modal [data-confirm-checkbox]');
        if (checkbox instanceof HTMLInputElement) checkbox.checked = true;
    }

});

// Confirm buttons
document.addEventListener('click', (e) => {
    if (!confirmState) {
        return;
    }
    if (e.target.closest('[data-confirm-cancel]')) {
        closeGlobalModal();
        return;
    }
    if (e.target.closest('[data-confirm-ok]')) {
        runConfirmAction();
    }
});
