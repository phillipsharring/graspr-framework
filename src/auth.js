// ---------------------------
// Centralized Auth Check
// ---------------------------
// Makes a single /api/auth/me call per page load and caches the result.
// Import `checkAuth` for a boolean, or `getAuthData` for the full response.
// Call `refreshAuthData()` to invalidate the cache and re-fetch.

function fetchAuthData() {
    return fetch('/api/auth/me', { credentials: 'same-origin' })
        .then(r => r.json())
        .then(data => ({
            authenticated: !!data.data?.authenticated,
            username: data.data?.user?.username || null,
            permissions: data.meta?.permissions || [],
        }))
        .catch(() => ({ authenticated: false, username: null, permissions: [] }));
}

let authPromise = fetchAuthData();

/**
 * Resolves with `true` when the user is authenticated, `false` otherwise.
 * The check runs once per page load; subsequent calls return the cached result.
 * @returns {Promise<boolean>}
 */
export function checkAuth() {
    return authPromise.then(d => d.authenticated);
}

/**
 * Resolves with the full auth data object: { authenticated, username, permissions }.
 * Same cache as checkAuth — no extra network call.
 * @returns {Promise<{authenticated: boolean, username: string|null, permissions: string[]}>}
 */
export function getAuthData() {
    return authPromise;
}

/**
 * Invalidates the cached auth data and re-fetches from /api/auth/me.
 * Returns the fresh auth data promise.
 * @returns {Promise<{authenticated: boolean, username: string|null, permissions: string[]}>}
 */
export function refreshAuthData() {
    authPromise = fetchAuthData();
    return authPromise;
}
