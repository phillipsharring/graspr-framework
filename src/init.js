// ---------------------------
// Graspr Framework initialization (side effects)
// ---------------------------
// Import this module to register all framework event listeners,
// CSRF interceptors, boosted-nav handlers, form error handling, etc.
// Order matters: csrf must be before auth-state.

import './core/csrf.js';
import './core/boosted-nav.js';
import './core/auth-state.js';
import './core/forms.js';
import './core/search.js';
import './core/sortable.js';
import './hooks.js';
