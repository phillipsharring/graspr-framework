// ---------------------------
// Graspr Framework — barrel export
// ---------------------------
// Public API for apps to import from '@phillipsharring/graspr-framework'.
// Side-effect modules (csrf, boosted-nav, auth-state, forms, search, sortable)
// are NOT imported here — use '@phillipsharring/graspr-framework/init' for those.

// Auth
export { checkAuth, getAuthData, refreshAuthData } from './auth.js';

// API client
export { apiFetch } from './fetch-client.js';

// Core — pagination & table sort (init functions)
export { initPagination } from './core/pagination.js';
export { initTableSort } from './core/table-sort.js';

// Core — auth-state (configurable)
export { registerAdminPermissionPrefixes } from './core/auth-state.js';

// Core — navigation utilities
export {
    normalizePath,
    setActiveNav,
    setUrlParam,
    getUrlParam,
    getUrlParamInt,
    mergeHxVals,
} from './core/navigation.js';

// Core — CSRF token access
export { getCsrfToken, setCsrfToken } from './core/csrf.js';

// UI — toast
export {
    GrasprToast,
    registerToastHelpers,
    initToastEventHandlers,
    openToast,
    closeToast,
} from './ui/toast.js';

// UI — modal
export {
    setOnModalCloseWithConfirm,
    getGlobalModal,
    getGlobalModalDialog,
    getGlobalModalHeader,
    getGlobalModalCloseButton,
    isGlobalModalOpen,
    openGlobalModal,
    closeGlobalModal,
} from './ui/modal.js';

// UI — modal form
export { openFormModal } from './ui/modal-form.js';

// UI — confirm dialog
export { GrasprConfirm } from './ui/confirm-dialog.js';

// UI — click burst
export { createBurst, attachClickBurst, initClickBurst } from './ui/click-burst.js';

// UI — typeahead
export { createTypeahead } from './ui/typeahead.js';

// Helpers
export { registerHandlebarsHelpers } from './helpers/handlebars-helpers.js';
export { initCopyIdHandler } from './helpers/utils.js';
export { escapeHtml } from './helpers/escape-html.js';
export { populateSelect } from './helpers/populate-select.js';
export { getRouteParams } from './helpers/route-params.js';
export { debounce, scrubSearchInput } from './helpers/debounce.js';
