# Graspr Frontend Framework — Claude Code Notes

## Architecture

HTMX + Handlebars + Tailwind CSS frontend framework, built with Vite. Installed via npm as `@phillipsharring/graspr-framework`.

## HTMX Boosted Navigation (CRITICAL)

Apps use `hx-boost="true"` on `<body>`. Every `<a>` and `<form>` is automatically AJAX-ified.

### How It Works

- `<body>` has `hx-target="#app" hx-select="#app" hx-swap="outerHTML"` — all boosted links swap only `<main id="app">`, preserving header/footer/templates.
- Elements outside `#app` (header widgets) persist across navigation.
- Elements inside `#app` are fresh DOM nodes after every nav.
- Cross-layout navigation forces a full page reload (layout mismatch detection).

### The Rule

**Every feature must work in BOTH scenarios:**
1. Full page load (direct URL, refresh, cross-layout nav)
2. Boosted nav (clicking a link within the same layout)

Key implications:
- `DOMContentLoaded` does NOT fire on boosted nav — only `htmx:afterSwap`/`htmx:afterSettle`
- HTMX lifecycle: `beforeSwap` → DOM swap → `afterSwap` → settle (processes `hx-trigger`) → `afterSettle`
- Fire custom events in `afterSettle`, NOT `afterSwap` — new elements' `hx-trigger` isn't wired until settle

## Self-Loading Elements

Elements that load their own content via HTMX:

```html
<div hx-get="/api/..." hx-trigger="auth-load, refresh"
     hx-target="this" hx-select="unset" hx-swap="innerHTML"
     handlebars-array-template="..." data-requires-auth>
```

- `hx-target="this"` + `hx-select="unset"` overrides body's `#app` targeting
- `data-requires-auth` needed for `auth-load` to fire
- Do NOT use `hx-disinherit` — breaks boosted nav by blocking `hx-boost` inheritance
- Do NOT use `hx-push-url="false"` — unnecessary and child links inherit it, breaking URL updates

## Auth System

- `auth.js` makes a single `/api/auth/me` call per page load, caches the result
- `checkAuth()` → `Promise<boolean>`
- `getAuthData()` → `Promise<{authenticated, username, permissions}>`
- `refreshAuthData()` → invalidates cache, re-fetches

### Auth-Gated Elements

```html
<!-- Loads content only when authenticated -->
<div data-requires-auth hx-trigger="auth-load, refresh" ...></div>

<!-- Visible only when logged in -->
<div data-show-if-auth hidden>...</div>

<!-- Visible only when logged out -->
<div data-hide-if-auth hidden>...</div>

<!-- Login/logout links (one of each, both start hidden) -->
<a data-auth-login hidden>Login</a>
<a data-auth-logout hidden>Logout</a>
```

- `data-requires-auth` widgets must use `hx-trigger="auth-load"`, never `"load"` (fires before auth resolves)
- `data-show-if-auth` / `data-hide-if-auth` must include `hidden` attribute in markup (no flash)
- `auth-load` fires from `applyAuthState()` in `afterSettle`, NOT `afterSwap`

### Permission Gating

```html
<div data-requires-permission="admin.access" hidden>Admin only content</div>
```

Revealed by `applyAuthState()` if user has the permission.

## Dynamic Routes

File-based routing with `[id]` or `[slug]` parameters:
- `pages/things/[id]/index.html` → route `/things/{uuid}/`
- Both `[id]/index.html` and `[id].html` work

### Pattern

```js
window.onReady(function() {
    var params = App.getRouteParams('/things/[id]/');
    if (!params || !params.id) return;
    detail.setAttribute('hx-get', '/api/things/' + params.id);
    window.htmx.process(detail);
    window.htmx.trigger(detail, 'refresh');
});
```

- Don't use `hx-trigger="auth-load"` with dynamically-set `hx-get` — race condition
- After changing `hx-get`, call `htmx.process(el)` before triggering
- CloudFront URL rewrite function must be updated for new dynamic routes in production

## `window.onReady(fn)` (CRITICAL)

Defined in each layout's `<head>`. Defers callback to `DOMContentLoaded` unless `readyState` is `'complete'`.

```js
window.onReady = function(fn) {
    if (document.readyState === 'complete') {
        fn();
    } else {
        document.addEventListener('DOMContentLoaded', fn);
    }
};
```

Must check for `'complete'`, NOT `'loading'`. Module scripts (`type="module"`) execute between `'interactive'` and `DOMContentLoaded`. Checking `readyState !== 'loading'` would run the callback immediately at `'interactive'`, before modules have set up `window.App`.

## Handlebars Templates

### Two Template Types

- `handlebars-array-template` — renders ONCE with `{ data: rows }`. Template must use `{{#each data}}`.
- `handlebars-template` (non-array) — spreads data into context. Use `{{data.field}}` for fields that collide with the response envelope (e.g. `status`).

### Template Gotchas

- `{{#if}}` as bare HTML attributes inside `<template>` tags gets mangled by the HTML parser. Duplicate the element with `{{#if}}/{{else}}` between tags instead.
- `{{> partial}}` in templates: `innerHTML` escapes `>` to `&gt;`. Framework handles this centrally.
- `eq` helper is an expression helper, not a block helper. Use `{{#if (eq status "active")}}`, NOT `{{#eq status "active"}}` (outputs "true"/"false" as text).
- Other expression helpers: `neq`, `and`, `or`, `notin`, `truncate`, `upper`, `humanize`, `json`, `timeAgo`, `formatDateTime`.

## Modal Form API

```js
App.ui.openFormModal({
    templateId: 'my-form-template',
    title: 'Edit Thing',
    formUrl: '/api/things/' + id,
    formMethod: 'patch',
    fields: { name: 'current value' },
    size: 'sm',  // 'sm' | 'lg' | 'takeover'
});
```

- `fields: { name: value }` — populates form inputs by name attribute
- `formUrl` + `formMethod` must both be specified

### Modal Refresh After Submit

On the `<form>` element:
- `data-refresh-target="#some-element"` — fires HTMX `refresh` trigger on that element
- `data-refresh-event="event-name"` — dispatches custom event on `document.body`

## Inline Script Rules

- Scope event listeners to elements INSIDE `#app` so they're GC'd on boosted nav
- Exception: `DOMContentLoaded` listeners are fine (fire once per page load)
- All inline scripts should be wrapped in `window.onReady(function() { ... })`

## Lifecycle Hooks

```js
import { onPageLoad, onAfterSwap, onAfterSettle } from '@phillipsharring/graspr-framework';
onPageLoad(function(doc) { ... });      // DOMContentLoaded (safe if already fired)
onAfterSwap(function(target) { ... });  // #app swap via boosted nav
onAfterSettle(function(target) { ... }); // after HTMX processes hx-trigger on new elements
```

## Namespace Convention

Apps define a global namespace (e.g. `window.App`) in their entry point:

```js
window.App = {
    api: { fetch: apiFetch },
    getRouteParams,
    escapeHtml,
    ui: {
        toast: GrasprToast,
        modal: { open, close, isOpen },
        confirm: GrasprConfirm,
        openFormModal,
    },
    hooks: { onAfterSwap, onAfterSettle, onPageLoad },
};
```

The namespace name is app-specific (not framework-defined).

## Tailwind + Framework CSS

App's `style.css` must scan framework JS for dynamic class names:

```css
@source "../../node_modules/@phillipsharring/graspr-framework/src/**/*.js";
```

Tailwind v4 doesn't detect classes in inline `<script>` tags. Use `@source inline("...")` to safelist dynamic class names built in JS.

## A/B Testing

### HTML Markup

```html
<!-- Variant A -->
<div data-ab-test="test-name" data-ab-variant="a" style="display:none">...</div>
<!-- Variant B -->
<div data-ab-test="test-name" data-ab-variant="b" style="display:none">...</div>
```

- Both variants start `display:none`
- Framework fetches assignments from `/api/ab/assignments`, shows the assigned variant, removes the other
- Fallback on API failure: shows variant "a"
- When a test is paused/completed: no assignment returned, both variants removed (hole in page)
- Intended workflow: run test → pick winner → update HTML to only have winning variant (remove `data-ab-test` attributes)

### Conversion Tracking

```html
<button data-ab-capture="signup">Sign Up</button>
```

Or programmatically: `App.ab.capture('event-name')`

## FOUC Prevention

For production builds, inject inline CSS that hides the page until the stylesheet loads:

```js
// In build script (html-compiler)
'<style>.css-loading{visibility:hidden}.css-loading body{visibility:hidden}</style>' +
'<link rel="stylesheet" href="..." onload="document.documentElement.classList.remove(\'css-loading\')" />'
```

Add `css-loading` class to `<html>` in all layouts.

## Common Pitfalls

1. **Forgetting boosted nav**: Works on refresh but not link-click = boosted nav issue.
2. **`hx-trigger="load"` for auth widgets**: Fires before auth resolves. Use `auth-load`.
3. **`hx-disinherit`**: Breaks boosted nav. Never use it.
4. **`hx-push-url="false"` on self-loading elements**: Unnecessary and breaks child link URL updates.
5. **Body-level inheritance**: All children inherit `hx-target="#app" hx-select="#app"`. Self-loading elements must set `hx-target="this" hx-select="unset"`.
6. **Listener accumulation**: Scope to elements inside `#app`, not `document.body`.
7. **`afterSwap` vs `afterSettle`**: Custom events targeting `hx-trigger` must fire in `afterSettle`.
8. **`handlebars-template` on elements with links**: Boosted links inherit the template attribute. Framework handles this centrally.
9. **Template wrapper divs eat negative margins**: Put bleed classes on the wrapper, not template content.
10. **HTMX + json-enc can't send arrays**: `FormData` collapses duplicate keys. Collect in `htmx:configRequest` and `JSON.stringify()`.
11. **Module script timing**: `window.onReady` must check `readyState === 'complete'`, not `!== 'loading'`, or callbacks run before modules define globals like `window.App`.

## S3/CloudFront Deployment

- `aws s3 sync` flag order matters: `--exclude "*" --include "*.html"` (exclude FIRST).
- Reversed order excludes everything.
- HTML files get short cache (`max-age=300`), assets get immutable cache (`max-age=31536000`).
- CloudFront Function handles URL rewriting for dynamic routes (`/things/{uuid}/` → `/things/[id]/index.html`).
- Don't use `--delete` on the HTML sync pass — it deletes assets uploaded by the first pass.
