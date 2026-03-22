/**
 * Initialize copy-to-clipboard button handler (delegated).
 * Buttons should have class `.copy-id-btn` and `data-copy-value` attribute.
 * Icons inside: `.copy-icon` (clipboard) and `.check-icon` (checkmark, hidden).
 */
export function initCopyIdHandler() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.copy-id-btn');
        if (!btn) return;

        const value = btn.dataset.copyValue;
        if (!value) return;

        navigator.clipboard.writeText(value).then(() => {
            const copyIcon = btn.querySelector('.copy-icon');
            const checkIcon = btn.querySelector('.check-icon');
            if (copyIcon && checkIcon) {
                copyIcon.classList.add('hidden');
                checkIcon.classList.remove('hidden');
                setTimeout(() => {
                    copyIcon.classList.remove('hidden');
                    checkIcon.classList.add('hidden');
                }, 1500);
            }
        });
    });
}
