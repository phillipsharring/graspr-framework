// ---------------------------
// Auth-gated UI
// ---------------------------
// Manages authentication state visibility, auth-gated widget triggering,
// admin permission checks, login modal, and 401 interception.
// Fully self-registering — import for side effects only.

import htmx from '../lib/htmx.js';
import { checkAuth, getAuthData, refreshAuthData } from '../auth.js';
import { isGlobalModalOpen } from '../ui/index.js';
import { openFormModal } from '../ui/modal-form.js';
import { GrasprToast } from '../ui/toast.js';

// ---------------------------
// Header widget refresh
// ---------------------------

function refreshHeaderWidgets({ selector = '[data-header-widget]', eventName = 'refresh' } = {}) {
    // Header widgets live outside #app, so they won't be re-initialized by page swaps.
    // Mark any widget with `data-header-widget` and give it `hx-trigger="auth-load, refresh"`.
    if (typeof htmx?.trigger !== 'function') return;
    document.querySelectorAll(selector).forEach((el) => {
        if (el instanceof HTMLElement) {
            htmx.trigger(el, eventName);
        }
    });
}

// ---------------------------
// Auth state application
// ---------------------------
// Reveals auth-dependent elements. Idempotent — safe to call after every swap.

const authPending = new WeakSet();

function applyAuthState(authData) {
    const authenticated = typeof authData === 'boolean' ? authData : authData.authenticated;
    const username = typeof authData === 'object' ? authData.username : null;

    // Auth links — both start hidden; reveal the correct one.
    const loginLink = document.querySelector('[data-auth-login]');
    const logoutLink = document.querySelector('[data-auth-logout]');

    if (authenticated) {
        logoutLink?.removeAttribute('hidden');
        // Show username in the user menu button
        const usernameEl = document.getElementById('user-menu-username');
        if (usernameEl && username) {
            usernameEl.textContent = username;
        }
    } else {
        loginLink?.removeAttribute('hidden');
    }

    // Auth-visibility elements — show or hide based on auth state.
    // Use hidden attribute in markup so they start invisible (no flash).
    //   data-show-if-auth:  hidden by default, revealed when authenticated
    //   data-hide-if-auth:  hidden by default, revealed when NOT authenticated
    document.querySelectorAll('[data-show-if-auth]').forEach(el => {
        if (authenticated) el.removeAttribute('hidden');
    });
    document.querySelectorAll('[data-hide-if-auth]').forEach(el => {
        if (!authenticated) el.removeAttribute('hidden');
    });

    // Widgets that require an authenticated session.
    // Track triggered elements in a WeakSet so each element only fires once,
    // even if multiple afterSwap/afterSettle handlers call applyAuthState while
    // requests are still in flight. New elements (e.g. after boosted nav swaps
    // #app) won't be in the set and will be triggered normally.
    if (authenticated && typeof htmx?.trigger === 'function') {
        document.querySelectorAll('[data-requires-auth]').forEach(el => {
            if (!el.children.length && !authPending.has(el)) {
                authPending.add(el);
                htmx.trigger(el, 'auth-load');
            }
        });
    }

    // Permission-gated elements — reveal if user has the required permission.
    // Uses cached getAuthData(), no extra network call.
    if (authenticated) {
        applyPermissionGating();
    }

    // If not authenticated and the page has auth-required content inside #app,
    // prompt the user to log in. (showLoginModal clears #app opacity itself.)
    if (!authenticated && document.querySelector('#app [data-requires-auth]')) {
        showLoginModal();
        return;
    }

    // Clear auth opacity gate for non-admin layouts.
    // Admin has its own permission-aware clearing in checkAdminPermissions().
    const app = document.getElementById('app');
    if (app && app.dataset?.layout !== 'admin') {
        app.style.opacity = '';
    }
}

// ---------------------------
// Permission-gated elements
// ---------------------------
// Elements with data-requires-permission="some.permission" start hidden
// and are revealed only if the user has that permission.

function applyPermissionGating() {
    const els = document.querySelectorAll('[data-requires-permission]');
    if (!els.length) return;

    getAuthData().then(({ permissions }) => {
        els.forEach(el => {
            if (permissions.includes(el.dataset.requiresPermission)) {
                el.removeAttribute('hidden');
            }
        });
    });
}

// Initial auth check + apply (pass full data for username).
getAuthData().then(applyAuthState);

// ---------------------------
// Admin permission checks
// ---------------------------
// Derives required permission from URL prefix — no per-page attributes needed.
// Apps register their own prefixes via registerAdminPermissionPrefixes().

let adminPermissionPrefixes = [];

/**
 * Register URL-prefix → permission mappings for admin permission checks.
 * More specific prefixes should come first (e.g. '/admin/design/' before '/admin/').
 * @param {Array<[string, string]>} prefixes - Array of [urlPrefix, permissionName] pairs
 */
export function registerAdminPermissionPrefixes(prefixes) {
    adminPermissionPrefixes = prefixes;
}

function checkAdminPermissions(appEl) {
    if (appEl.dataset?.layout !== 'admin') return;

    // Normalize so a request to a registered prefix root without its trailing
    // slash (e.g. `/admin` for prefix `/admin/`) still matches.
    const rawPath = window.location.pathname;
    const path = rawPath.endsWith('/') ? rawPath : rawPath + '/';
    const required = adminPermissionPrefixes.find(([prefix]) => path.startsWith(prefix))?.[1];
    if (!required) return;

    getAuthData().then(({ authenticated, permissions }) => {
        if (!authenticated) {
            showLoginModal();
        } else if (!permissions.includes(required)) {
            window.location.href = '/game/';
            return; // don't reveal — redirecting
        }
        appEl.style.opacity = '';
    });
}

// ---------------------------
// 401 / Unauthenticated → Login Modal
// ---------------------------

function showLoginModal() {
    // Drop a login link into #app so there's something to click if the modal is dismissed
    const app = document.getElementById('app');
    if (app && !app.querySelector('[data-login-prompt]')) {
        app.innerHTML = `
            <div data-login-prompt class="flex items-center justify-center min-h-[60vh]">
                <a href="/login/"
                    class="rounded px-6 py-3 bg-slate-900 text-white hover:bg-slate-800 text-lg no-underline"
                >Login</a>
            </div>`;
        app.style.opacity = '';
    }

    if (isGlobalModalOpen()) return;
    openFormModal({
        templateId: 'login-form-template',
        title: 'Login',
        size: 'sm',
    });
}

// Catch 401/403 responses before swap
document.body.addEventListener('htmx:beforeSwap', (e) => {
    const xhr = e.detail?.xhr;
    if (xhr?.status === 401) {
        e.detail.shouldSwap = false;
        showLoginModal();
    } else if (xhr?.status === 403) {
        // CSRF failure — the response includes a fresh token (captured by
        // the htmx:afterRequest hook in csrf.js), so the next request will work.
        e.detail.shouldSwap = false;
        GrasprToast.show({ message: 'Session expired, please try again.', status: 'warning' });
    }
}, true); // Use capture to run before other beforeSwap handlers

// ---------------------------
// Self-registered lifecycle handlers
// ---------------------------

// Check admin permissions on full page load.
document.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app');
    if (app) checkAdminPermissions(app);
});

// On #app swap: refresh header widgets + re-check admin permissions.
document.body.addEventListener('htmx:afterSwap', (e) => {
    const target = e.detail?.target;

    if (target && target.id === 'app') {
        checkAuth().then(auth => { if (auth) refreshHeaderWidgets(); });
        // outerHTML swap detaches the old target — grab the live element from DOM
        const app = document.getElementById('app');
        if (app) checkAdminPermissions(app);
    }
});

// Fire auth-load AFTER settle, not after swap.
// HTMX lifecycle: beforeSwap → DOM swap → afterSwap → settle (processes hx-trigger
// etc. on new elements) → afterSettle. Firing auth-load in afterSwap meant the
// custom event fired before HTMX had wired up hx-trigger="auth-load" on the new
// elements — so nothing was listening yet.
document.body.addEventListener('htmx:afterSettle', (e) => {
    const target = e.detail?.target;

    // Skip widget responses — otherwise the first widget's afterSettle would
    // re-trigger auth-load on sibling widgets that haven't loaded yet.
    if (!target?.closest('[data-requires-auth]')) {
        getAuthData().then(applyAuthState);
    }
});

// Re-fetch /api/auth/me and re-apply auth state (updates header username, etc.).
// Any code can fire this: document.body.dispatchEvent(new CustomEvent('auth-refresh'))
document.body.addEventListener('auth-refresh', () => {
    refreshAuthData().then(applyAuthState);
});
