// ---------------------------
// Global Modal
// ---------------------------

let lastFocusBeforeModal = null;

// Callback for when modal is closed while confirm is active
let onModalCloseWithConfirm = null;

export function setOnModalCloseWithConfirm(callback) {
    onModalCloseWithConfirm = callback;
}

export function getGlobalModal() {
    return document.getElementById('global-modal');
}

export function getGlobalModalDialog() {
    return document.querySelector('#global-modal [role="dialog"]');
}

export function getGlobalModalHeader() {
    return document.getElementById('global-modal-header');
}

export function getGlobalModalCloseButton() {
    return document.getElementById('global-modal-close-btn');
}

export function isGlobalModalOpen() {
    const modal = getGlobalModal();
    return !!modal && modal.classList.contains('modal-open');
}

export function openGlobalModal(options = {}) {
    const modal = getGlobalModal();
    if (!modal) return;
    lastFocusBeforeModal = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Clear inline styles used to prevent flash of content on page load
    modal.removeAttribute('style');

    // Apply takeover mode if requested
    if (options.takeover) {
        modal.classList.add('modal-takeover');
    }

    modal.classList.add('modal-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overflow-hidden');

    const dialog = getGlobalModalDialog();
    if (dialog instanceof HTMLElement) {
        // Defer to ensure it's visible before focusing
        queueMicrotask(() => dialog.focus());
    }
}

export function closeGlobalModal() {
    const modal = getGlobalModal();
    if (!modal) return;

    // If a confirm dialog is active, closing the modal counts as "cancel".
    if (onModalCloseWithConfirm) {
        onModalCloseWithConfirm();
    }

    // Avoid hiding a focused element from assistive tech (prevents aria-hidden warning).
    const active = document.activeElement;
    if (active instanceof HTMLElement && modal.contains(active)) {
        active.blur();
    }

    // Check if takeover mode before removing modal-open
    const wasTakeover = modal.classList.contains('modal-takeover');

    modal.classList.remove('modal-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overflow-hidden');

    // Dispatch event so listeners can react (e.g. refresh widgets after pack opening)
    document.dispatchEvent(new CustomEvent('modal:closed', { detail: { takeover: wasTakeover } }));

    // Delay cleanup of size/mode classes until after transition completes
    // to prevent flash of default modal style
    setTimeout(() => {
        modal.classList.remove('modal-takeover');
        const header = getGlobalModalHeader();
        if (header) header.style.display = '';
        const dialog = getGlobalModalDialog();
        if (dialog) {
            dialog.classList.remove('modal-sm', 'modal-lg', 'confirm-mode');
        }
    }, wasTakeover ? 200 : 150);

    if (lastFocusBeforeModal && document.contains(lastFocusBeforeModal)) {
        queueMicrotask(() => lastFocusBeforeModal?.focus());
    }
    lastFocusBeforeModal = null;
}

// ---------------------------
// Event Listeners
// ---------------------------

// Close modal on overlay click / close button click (anything with data-modal-close)
document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-modal-close]');
    if (!closeBtn) return;

    // In takeover mode, only explicit close buttons work (not backdrop clicks)
    const modal = getGlobalModal();
    if (modal?.classList.contains('modal-takeover')) {
        // Check if this is the backdrop overlay (not an explicit close button)
        if (closeBtn.classList.contains('absolute') && closeBtn.classList.contains('inset-0')) {
            return; // Ignore backdrop clicks in takeover mode
        }
    }

    closeGlobalModal();
});

// Close modal on Escape
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!isGlobalModalOpen()) return;
    closeGlobalModal();
});
