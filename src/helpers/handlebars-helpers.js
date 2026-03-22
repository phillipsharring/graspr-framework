/**
 * Register generic/reusable Handlebars helpers.
 * @param {typeof import('handlebars')} Handlebars
 */
export function registerHandlebarsHelpers(Handlebars) {
    // ─── Partials ───

    Handlebars.registerPartial('formButtons', `<div class="flex justify-end gap-3 pt-2">
    <button type="button" class="border rounded px-3 py-2 hover:bg-slate-50" data-modal-close>
        Cancel
    </button>
    <button type="submit" class="rounded px-3 py-2 bg-slate-900 text-white hover:bg-slate-800">
        {{label}}
    </button>
</div>`);

    Handlebars.registerPartial('copyIdBtn', `<button
        type="button"
        class="copy-id-btn p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600"
        data-copy-value="{{id}}"
        title="Copy ID"
    >
        <svg class="copy-icon w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <svg class="check-icon w-3.5 h-3.5 hidden text-green-600" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    </button>`);

    // ─── Utilities ───

    // Parse a timestamp as UTC. MySQL datetimes arrive as "2026-03-11 14:30:00"
    // with no timezone indicator — JS Date parsing is ambiguous without one.
    // This normalizes to ISO 8601 with Z suffix so it's unambiguously UTC.
    function parseUtcDate(value) {
        if (value === null || value === undefined) return null;
        const s = String(value).trim();
        if (!s) return null;
        // If it already has a timezone indicator (Z, +, -) leave it alone,
        // otherwise treat as UTC by appending Z after converting space to T
        const normalized = /[Z+\-]\d{0,4}:?\d{0,2}$/.test(s) ? s : s.replace(' ', 'T') + 'Z';
        const d = new Date(normalized);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    // ─── Helpers ───

    // Equality comparison helper
    Handlebars.registerHelper('eq', (a, b) => a === b);

    // Inequality comparison helper
    Handlebars.registerHelper('neq', (a, b) => a !== b);

    // Logical AND helper
    Handlebars.registerHelper('and', function(...args) {
        args.pop(); // Remove Handlebars options object
        return args.every(Boolean);
    });

    // Logical OR helper
    Handlebars.registerHelper('or', function(...args) {
        args.pop(); // Remove Handlebars options object
        return args.some(Boolean);
    });

    Handlebars.registerHelper('notin', function(value, ...rest) {
        const options = rest.pop(); // Remove Handlebars options object
        let listArgs = rest;

        // If a single array was provided from context, use it
        if (listArgs.length === 1 && Array.isArray(listArgs[0])) {
            listArgs = listArgs[0];
        }

        if (!listArgs || !Array.isArray(listArgs)) {
            return true; // treat missing list as "not in"
        }

        return listArgs.indexOf(value) === -1;
    });

    // Truncate a string to a max length, adding ellipsis if truncated.
    Handlebars.registerHelper('truncate', (value, length) => {
        if (value === null || value === undefined) return '';
        const s = String(value);
        if (s.length <= length) return s;
        return s.slice(0, length) + '…';
    });

    // Make a string all upper case
    Handlebars.registerHelper('upper', (value) => {
        if (value === null || value === undefined) return '';
        const s = String(value);
        return s.toUpperCase();
    });

    // Convert snake_case to human-readable text: "on_pack_open" → "on pack open"
    Handlebars.registerHelper('humanize', (value) => {
        if (value === null || value === undefined) return '';
        return String(value).replace(/_/g, ' ');
    });

    // Convert snake_case to Title Case: "level_up" → "Level Up"
    Handlebars.registerHelper('titleHumanize', (value) => {
        if (value === null || value === undefined) return '';
        return String(value).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    });

    // Tree indent indicator — shows depth via left margin + ↳ arrow.
    // sort_key format: "00" (root), "00.01" (depth 1), "00.01.ff" (depth 2), etc.
    Handlebars.registerHelper('treeIndent', (sortKey) => {
        if (!sortKey) return '';
        const depth = (String(sortKey).match(/\./g) || []).length;
        if (depth === 0) return '';
        const ml = depth * 16;
        return new Handlebars.SafeString(
            `<span class="text-slate-300 inline-block" style="margin-left:${ml}px">↳</span> `
        );
    });

    // Serialize a value to a JSON string (safe for embedding in HTML attributes).
    Handlebars.registerHelper('json', (value) => {
        if (value === null || value === undefined) return 'null';
        return JSON.stringify(value);
    });

    // Relative time helper: "3 minutes ago", "2 days ago", etc.
    Handlebars.registerHelper('timeAgo', (value) => {
        const d = parseUtcDate(value);
        if (!d) return '';

        const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
        if (seconds < 0) return 'just now';

        const intervals = [
            [60, 'second'],
            [60, 'minute'],
            [24, 'hour'],
            [30, 'day'],
            [12, 'month'],
            [Infinity, 'year'],
        ];

        let remaining = seconds;
        for (const [divisor, unit] of intervals) {
            if (remaining < divisor) {
                if (unit === 'second' && remaining < 10) return 'just now';
                const n = Math.floor(remaining);
                return n + ' ' + unit + (n !== 1 ? 's' : '') + ' ago';
            }
            remaining /= divisor;
        }
        return '';
    });

    // Format a UTC timestamp to the user's local timezone as a readable datetime string.
    Handlebars.registerHelper('formatDateTime', (value) => {
        const d = parseUtcDate(value);
        if (!d) return '';

        return new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }).format(d);
    });
}
