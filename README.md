# HTMX + Tailwind + Vite

Just a quick repo to get started on projects with the aforementioned tools. I've also included [json-enc](https://htmx.org/extensions/json-enc/), [client-side-templates](https://htmx.org/extensions/client-side-templates/), and [Handlebars](https://handlebarsjs.com/) to work with JSON APIs. Remove these if you don't need them. If you prefer something other than Handlebars, install that instead. Both actions will require an update to `app.js`.

The _json-enc_ and _client-side-templates_ extensions are included in the repo. If you want or need a newer version, you'll have to download and replace them yourself. Although they are pretty simple so I doubt there'll be many changes to them.

## Pages: Vite `index.html` vs baked HTML pages

- **Dev (`npm run dev`)**: Vite serves “pretty URL” pages dynamically from `src/pages/**` (so `/about/` works, and HTMX boosted navigation works without a full reload).
- **Build/Preview (`npm run build` / `npm run preview`)**: `npm run build` runs Vite and then `scripts/build-pages.mjs`, which generates real site pages into `dist/` using:
  - `src/layouts/base.html`
  - `src/pages/**/*.html`

### File-based page routing

Pages are discovered automatically (no route list to maintain):

- `src/pages/index.html` → `/`
- `src/pages/about.html` → `/about/`
- `src/pages/game/index.html` → `/game/`
- `src/pages/game/binder.html` → `/game/binder/`

Build output mirrors those routes:

- `/about/` becomes `dist/about/index.html`
- `/game/binder/` becomes `dist/game/binder/index.html`

## Components (build-time)

Pages can include build-time components with props + slot content:

```html
<callout title="Hello" subtle class="mb-12">
  <p>slot content</p>
</callout>
```

Component templates live in `src/components/*.html` and use:
- `[[slot]]` for inner content
- `[[prop]]` for escaped prop values
- `[[{prop}]]` for raw prop values
- `[[#if flag]]...[[else]]...[[/if]]` for simple boolean conditionals (missing flags are false)

Notes:
- A component can also be invoked as `<component name="Callout" ...>` if you prefer.
- If the caller passes a `class="..."` prop and the component template’s first element already has a `class="..."`,
  the compiler will merge them (e.g. `class="p-6"` + `class="mb-12"` → `class="p-6 mb-12"`).

## API (Handlr) integration

In HTML, keep HTMX endpoints **same-origin** (e.g. `hx-post="/api/examples/echo"`). In production you route `/api/*` to Handlr at the CDN/reverse-proxy layer.

For local dev, Vite proxies `/api/*` to Handlr:

```bash
# example: if Handlr is running at http://localhost:8000
HANDLR_ORIGIN=http://localhost:8000 npm run dev
```

## Global Modal (HTMX-powered)

The app layout (`src/layouts/base.html`) includes a standard global modal that is **hidden by default** and intended to be populated via HTMX swaps.

### Targets / IDs

- `#global-modal`: modal root (shown/hidden)
- `#global-modal-content`: where HTMX responses should be swapped in

### Typical usage (HTMX → modal)

Point any HTMX request at the modal content container:

```html
<button
  hx-get="/api/examples/hello"
  hx-target="#global-modal-content"
  hx-swap="innerHTML"
  type="button"
>
  Open in modal
</button>
```

If you’re using `client-side-templates` + Handlebars with JSON APIs, add `handlebars-template="..."` as usual.

### Auto-open behavior

`src/app.js` listens for `htmx:afterSwap`. If the swap target is `#global-modal-content`, it automatically opens the modal.

### Closing behavior

The modal can be closed via:
- Clicking the overlay (the dark area behind the dialog)
- Clicking any element with `data-modal-close` (including the ✕ button)
- Pressing `Escape`

### Size / overflow behavior

- The dialog width is capped (`max-w-xl`) but is responsive (`w-full` on small screens).
- For large content, the modal body scrolls inside the dialog (`overflow-auto` with a viewport-based max height).

### Manual control (optional)

`src/app.js` exposes a tiny helper:

- `window.GrasprModal.open()`
- `window.GrasprModal.close()`

## Global Toast (HTMX-powered)

The layout also includes a global “toast” notification container in the **upper-right**.

### Targets / IDs

- `#global-toast-wrap`: toast root (shown/hidden)
- `#global-toast-content`: where HTMX responses should be swapped in
- `#global-toast-template`: Handlebars template used to render `{ status, message }`

### Typical usage (HTMX → toast)

Return JSON like:

```json
{ "status": "success", "message": "Saved!" }
```

Then target the toast container and use the template:

```html
<button
  hx-post="/api/something"
  hx-target="#global-toast-content"
  hx-swap="innerHTML"
  handlebars-template="global-toast-template"
  type="button"
>
  Save
</button>
```

### Status → styling

The template uses the `status` field to choose Tailwind classes:
- `success` (default)
- `warning`
- `error` (also accepts the typo `eror`)

### Auto-hide

After HTMX swaps into `#global-toast-content`, `src/app.js` auto-shows the toast and auto-hides it after ~10 seconds.

### Manual control (optional)

`src/app.js` exposes:
- `window.GrasprToast.show({ message, status, timeoutMs })`
- `window.GrasprToast.close()`

To use it just enter the commands below and start coding:

```bash
npm install
npm run dev
```

Once you're happy, do a prod preview:

```bash
npm run build
npm run preview
```

And then build it:

```bash
npm run build
```

And that's pretty much it. Enjoy!
