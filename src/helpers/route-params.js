import { normalizePath } from '../core/navigation.js';

/**
 * Extract route parameters from the current URL based on a route pattern.
 * @param {string} pattern - Route pattern with [param] placeholders (e.g., '/series/[seriesId]/collections/')
 * @param {string} [url] - URL to extract from (defaults to current pathname)
 * @returns {Object} - Object mapping parameter names to values
 *
 * @example
 * // On page /series/abc123/collections/
 * getRouteParams('/series/[seriesId]/collections/')
 * // Returns: { seriesId: 'abc123' }
 *
 * @example
 * // Multiple params
 * getRouteParams('/series/[seriesId]/collections/[collectionId]/')
 * // On /series/abc123/collections/xyz789/
 * // Returns: { seriesId: 'abc123', collectionId: 'xyz789' }
 */
export function getRouteParams(pattern, url = window.location.pathname) {
    const params = {};

    const urlNorm = normalizePath(url);
    const patternNorm = normalizePath(pattern);

    const urlSegments = urlNorm.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
    const patternSegments = patternNorm.replace(/^\/|\/$/g, '').split('/').filter(Boolean);

    if (urlSegments.length !== patternSegments.length) {
        return params; // Pattern doesn't match, return empty object
    }

    for (let i = 0; i < patternSegments.length; i++) {
        const urlSeg = urlSegments[i];
        const patternSeg = patternSegments[i];

        // Check if this is a parameter segment
        if (patternSeg.startsWith('[') && patternSeg.endsWith(']')) {
            const paramName = patternSeg.slice(1, -1); // Remove [ and ]
            params[paramName] = urlSeg;
        } else {
            // Static segment should match exactly
            if (patternSeg !== urlSeg) {
                return {}; // Mismatch, return empty object
            }
        }
    }

    return params;
}
