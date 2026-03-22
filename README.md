# Graspr Framework

A frontend framework for building server-driven web applications with **HTMX + Handlebars + Tailwind CSS**.

Graspr handles the hard parts of HTMX-based apps: boosted navigation, auth-gated widgets, modal/toast systems, CSRF token management, form error handling, and client-side template rendering — so you can focus on your pages and domain logic.

## Installation

```bash
npm install @phillipsharring/graspr-framework
```

Peer dependencies (your app must install these):
```bash
npm install htmx.org handlebars sortablejs
```

For a ready-to-go project structure, use the [Graspr App Skeleton](https://github.com/phillipsharring/graspr-app-skeleton).

## What's Included

### Core Infrastructure (`core/`)
- **boosted-nav** — fixes HTMX boosted navigation edge cases (inherited targets, `hx-select` overrides, layout mismatch detection)
- **csrf** — global `fetch()` interceptor + HTMX hook for automatic CSRF token headers
- **auth-state** — auth-gated UI orchestration (`auth-load` events, permission gating, login modal, 401/403 handling)
- **forms** — inline form error display, modal form lifecycle, success redirect/refresh patterns
- **pagination** — paginated table controls with URL param syncing
- **search** — debounced search input with HTMX integration
- **sortable** — drag-and-drop reordering via SortableJS wrapper
- **table-sort** — clickable column header sorting with URL persistence
- **navigation** — URL helpers, active nav highlighting

### UI Widgets (`ui/`)
- **modal** — global modal state machine with focus management and overlay/escape handling
- **modal-form** — modal form populator (set fields, method, clear errors, focus)
- **toast** — toast notification system with auto-dismiss
- **confirm-dialog** — confirmation dialog with optional progress mode for batch operations
- **typeahead** — autocomplete widget factory with keyboard navigation
- **click-burst** — visual click feedback animation

### HTMX Extensions (`lib/`)
- **json-enc** — JSON encoding extension for HTMX requests
- **client-side-templates** — Handlebars template rendering for HTMX JSON responses

### Helpers (`helpers/`)
- **handlebars-helpers** — generic Handlebars helpers (eq, neq, and, or, truncate, timeAgo, formatDateTime, json, treeIndent, etc.)
- **escape-html** — HTML escape utility
- **populate-select** — `<select>` field populator
- **route-params** — URL parameter extraction for dynamic routes (`[id]` patterns)
- **debounce** — debounce utility + search input sanitization

### Auth (`auth.js`)
- Single `/api/auth/me` call per page load, cached
- `checkAuth()` — returns `Promise<boolean>`
- `getAuthData()` — returns full auth response with permissions
- `refreshAuthData()` — invalidates cache and re-fetches

### API Client (`fetch-client.js`)
- `apiFetch(url, options)` — wraps `fetch()` with CSRF headers, JSON content type, body serialization

### Styles (`styles/base.css`)
- Form error styles, HTMX request dimming, modal/takeover animations, sortable drag-and-drop, table sort headers, confirm dialog, active nav highlighting

## Usage

### Import everything at once
```js
import {
    GrasprToast, openFormModal, GrasprConfirm,
    initPagination, initTableSort,
    getRouteParams, escapeHtml,
} from '@phillipsharring/graspr-framework';
```

### Side-effect initialization
```js
// Registers CSRF interceptors, boosted-nav handlers, auth-state listeners,
// form error handling, search, and sortable — in the correct order.
import '@phillipsharring/graspr-framework/init';
```

### HTMX extensions (import after setting window.Handlebars)
```js
import '@phillipsharring/graspr-framework/src/lib/json-enc.js';
import '@phillipsharring/graspr-framework/src/lib/client-side-templates.js';
```

### Styles
```css
@import 'tailwindcss';
@source "../../content/**/*.html";
@source "../**/*.js";
@import '@phillipsharring/graspr-framework/styles/base.css';
```

### Configurable auth permissions
```js
import { registerAdminPermissionPrefixes } from '@phillipsharring/graspr-framework';

registerAdminPermissionPrefixes([
    ['/admin/design/', 'design.access'],
    ['/admin/story/', 'story.access'],
    ['/admin/', 'admin.access'],
]);
```

## Designed For

Graspr is the frontend companion to [Handlr Framework](https://github.com/phillipsharring/handlr-framework) (PHP backend), but works with any backend that serves JSON APIs and HTML pages. The auth system expects a `/api/auth/me` endpoint; everything else is configurable.

## Requirements

- Vite 7+
- Tailwind CSS 4+
- Node.js 18+

## License

MIT
