# Changelog

## 0.2.9

### Fixed
- `checkAdminPermissions()` (auth-state.js): registered admin prefixes ending in `/` failed to match when the URL was the prefix root without its trailing slash (e.g. `/admin` for prefix `/admin/`). The opacity gate on `<main id="app">` was never cleared, leaving the page area transparent on the index URL. Pathname is now normalized with a trailing slash before the `startsWith` check.

## 0.2.8 addendum

### Graspr Build
- Build mechanics now live in @phillipsharring/graspr-build  - separate package, no impact on runtime

## 0.2.0

### Added
- **Lifecycle hooks**  - central hook registry for app and page scripts to register callbacks at key points in the page lifecycle. Avoids scattered `htmx:afterSwap` listeners across pages.
  - `onAfterSwap(fn)`  - runs after `#app` is swapped via boosted nav
  - `onAfterSettle(fn)`  - runs after HTMX settle phase (hx-trigger wired up on new elements)
  - `onPageLoad(fn)`  - runs on DOMContentLoaded (full page load only)
  - `onHistoryRestore(fn)`  - runs on browser back/forward (history cache restore)
- Hooks are registered via the barrel export (`import { onAfterSwap } from '@phillipsharring/graspr-framework'`) or via the app namespace (`App.hooks.onAfterSwap(fn)`).
- `hooks.js` is auto-loaded via `init.js`  - no additional imports needed.

## 0.1.0

Initial release. Nothing changed, except everything.
