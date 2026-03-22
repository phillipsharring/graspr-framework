/**
 * Creates a debounced version of a function.
 * @param {Function} fn - The function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function with a .cancel() method
 */
export function debounce(fn, delay) {
    let timeoutId = null;

    const debounced = (...args) => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => {
            timeoutId = null;
            fn(...args);
        }, delay);
    };

    debounced.cancel = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    return debounced;
}

/**
 * Scrub user input for safe use in search queries.
 * Removes potentially dangerous characters while preserving search functionality.
 * @param {string} input - Raw user input
 * @returns {string} - Scrubbed input
 */
export function scrubSearchInput(input) {
    if (typeof input !== 'string') return '';

    return input
        // Remove HTML/script injection characters
        .replace(/[<>]/g, '')
        // Remove potential SQL injection characters (belt-and-suspenders with BE)
        .replace(/[;'"\\]/g, '')
        // Collapse multiple spaces into one
        .replace(/\s+/g, ' ')
        // Trim whitespace
        .trim();
}
