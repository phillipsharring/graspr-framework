import { openGlobalModal } from './modal.js';

document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-image-preview]');
    if (!(trigger instanceof HTMLElement)) return;

    e.preventDefault();

    const src = trigger.getAttribute('data-image-src');
    const alt = trigger.getAttribute('data-image-alt') || '';
    if (!src) return;

    const title = document.getElementById('global-modal-title');
    const content = document.getElementById('global-modal-content');
    if (!content) return;

    if (title) title.textContent = alt;
    content.innerHTML = `<div class="flex justify-center"><img src="${src}" alt="${alt}" class="max-w-full max-h-[70dvh] rounded" /></div>`;

    openGlobalModal();
});
