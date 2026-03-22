// ---------------------------
// API Client
// ---------------------------
// Convenience wrapper around fetch for /api/ calls.
// Auto-handles CSRF headers, JSON content type, and body serialization.
// New code should use this; existing inline fetch() calls are protected
// by the global interceptor in core/csrf.js.

import { getCsrfToken, setCsrfToken } from './core/csrf.js';

const CSRF_HEADER = 'X-CSRF-Token';

/**
 * Fetch wrapper for API calls.
 * @param {string} url - The API URL (e.g. '/api/users')
 * @param {RequestInit & { body?: object | string }} [options={}]
 * @returns {Promise<Response>}
 */
export function apiFetch(url, options = {}) {
    const headers = new Headers(options.headers || {});
    const token = getCsrfToken();

    if (token) {
        headers.set(CSRF_HEADER, token);
    }

    headers.set('Accept', 'application/json');

    const method = (options.method || 'GET').toUpperCase();

    if (method !== 'GET' && method !== 'HEAD') {
        if (!headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
        }

        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
            options = { ...options, body: JSON.stringify(options.body) };
        }
    }

    return fetch(url, { ...options, headers, credentials: 'same-origin' }).then(response => {
        const newToken = response.headers.get(CSRF_HEADER);
        if (newToken) setCsrfToken(newToken);
        return response;
    });
}
