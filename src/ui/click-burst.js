/**
 * Click Burst Effect
 * Creates a visual feedback burst (expanding ring) on click events.
 */

const BURST_DURATION_MS = 500;
const BURST_SIZE_START = 20;
const BURST_SIZE_END = 80;

/**
 * Create and animate a burst element at the given coordinates.
 * @param {number} x - X coordinate (client)
 * @param {number} y - Y coordinate (client)
 * @param {Object} options - Optional overrides
 * @param {string} options.color - RGB color for the burst, e.g. "255, 200, 50" (default: gold)
 * @param {number} options.opacity - Peak opacity 0-1 (default: 0.5)
 * @param {number} options.duration - Animation duration in ms (default: 500)
 * @param {number} options.startSize - Initial size in px (default: 20)
 * @param {number} options.endSize - Final size in px (default: 80)
 */
export function createBurst(x, y, options = {}) {
    const {
        color = '255, 200, 50',
        opacity = 0.5,
        duration = BURST_DURATION_MS,
        startSize = BURST_SIZE_START,
        endSize = BURST_SIZE_END,
    } = options;

    // Build radial gradient: hollow center, solid ring, soft outer edge
    const gradient = `radial-gradient(circle,
        transparent 0%,
        transparent 40%,
        rgba(${color}, ${opacity}) 50%,
        rgba(${color}, ${opacity}) 93%,
        transparent 100%
    )`;

    const burst = document.createElement('div');
    burst.className = 'click-burst';
    burst.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: ${startSize}px;
        height: ${startSize}px;
        margin-left: ${-startSize / 2}px;
        margin-top: ${-startSize / 2}px;
        border-radius: 50%;
        background: ${gradient};
        pointer-events: none;
        z-index: 99999;
        opacity: 0;
        transform: scale(1);
        transition: opacity ${duration * 0.15}ms ease-out, transform ${duration}ms ease-out, width ${duration}ms ease-out, height ${duration}ms ease-out, margin ${duration}ms ease-out;
    `;

    document.body.appendChild(burst);

    // Force layout to apply initial styles before animating
    void burst.getBoundingClientRect();

    // Animate: fade in fast, grow, then fade out
    burst.style.opacity = '1';
    burst.style.width = `${endSize}px`;
    burst.style.height = `${endSize}px`;
    burst.style.marginLeft = `${-endSize / 2}px`;
    burst.style.marginTop = `${-endSize / 2}px`;
    burst.style.transform = 'scale(1)';

    // Fade out after growing
    setTimeout(() => {
        burst.style.opacity = '0';
    }, duration * 0.4);

    // Remove element after animation completes
    setTimeout(() => {
        burst.remove();
    }, duration);
}

/**
 * Attach click burst to an element.
 * @param {HTMLElement} element - The element to attach the burst handler to
 * @param {Object} options - Options passed to createBurst
 * @returns {Function} - Cleanup function to remove the listener
 */
export function attachClickBurst(element, options = {}) {
    const handler = (e) => {
        createBurst(e.clientX, e.clientY, options);
    };
    element.addEventListener('click', handler);
    return () => element.removeEventListener('click', handler);
}

/**
 * Auto-attach click burst to elements with data-click-burst attribute.
 * Call on DOMContentLoaded and after HTMX swaps.
 * @param {Document|Element} root - Root element to search within
 */
export function initClickBurst(root = document) {
    root.querySelectorAll('[data-click-burst]').forEach((el) => {
        if (el.__clickBurstAttached) return;
        el.__clickBurstAttached = true;

        // Parse options from data attributes
        const options = {};
        if (el.dataset.clickBurstColor) options.color = el.dataset.clickBurstColor;
        if (el.dataset.clickBurstOpacity) options.opacity = parseFloat(el.dataset.clickBurstOpacity);
        if (el.dataset.clickBurstDuration) options.duration = parseInt(el.dataset.clickBurstDuration, 10);
        if (el.dataset.clickBurstStartSize) options.startSize = parseInt(el.dataset.clickBurstStartSize, 10);
        if (el.dataset.clickBurstEndSize) options.endSize = parseInt(el.dataset.clickBurstEndSize, 10);

        attachClickBurst(el, options);
    });
}
