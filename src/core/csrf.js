// ---------------------------
// CSRF Protection
// ---------------------------
// Self-registering module — import for side effects only.
// Must be imported BEFORE auth.js so the fetch interceptor captures
// the initial /api/auth/me request.
//
// Two layers:
// 1. Global fetch() interceptor — protects all existing fetch() calls
// 2. HTMX event hooks — protects all HTMX-driven requests
//
// Token is stored in a cookie (XSRF-TOKEN) set by the backend.
// All tabs share the same cookie, preventing multi-tab desync.

const CSRF_HEADER = 'X-CSRF-Token';
const CSRF_COOKIE = 'XSRF-TOKEN';

function readTokenFromCookie() {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${CSRF_COOKIE}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

export function getCsrfToken() {
    return readTokenFromCookie();
}

export function setCsrfToken(_token) {
    // No-op — token is managed via Set-Cookie by the backend.
    // Kept for API compatibility (fetch-client.js imports this).
}

// ---------------------------
// Global fetch interceptor
// ---------------------------
// Patches window.fetch to inject CSRF header on /api/ requests.

const originalFetch = window.fetch.bind(window);

window.fetch = function (input, init = {}) {
    const url = typeof input === 'string' ? input : input?.url || '';

    if (url.startsWith('/api/')) {
        const headers = new Headers(init.headers || {});
        const token = readTokenFromCookie();
        if (token) {
            headers.set(CSRF_HEADER, token);
        }
        init = { ...init, headers };
    }

    return originalFetch(input, init);
};

// ---------------------------
// HTMX hooks
// ---------------------------

document.body.addEventListener('htmx:configRequest', (e) => {
    const token = readTokenFromCookie();
    if (token) {
        e.detail.headers[CSRF_HEADER] = token;
    }
});
