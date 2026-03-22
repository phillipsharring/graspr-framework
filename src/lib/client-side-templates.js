import htmx from './htmx.js';
import Handlebars from 'handlebars';

htmx.defineExtension('client-side-templates', {
    transformResponse(text, xhr, elt) {
        const tplHost = htmx.closest(elt, '[handlebars-template], [handlebars-array-template]');
        if (!tplHost) return text;

        // Boosted <a> links inside a template-attributed container inherit the
        // attribute, but their responses are full HTML pages — not JSON.
        // Skip transformation so the beforeSwap handler can fix the target.
        if (elt instanceof HTMLAnchorElement && !elt.hasAttribute('hx-get') && !elt.hasAttribute('hx-post')) {
            return text;
        }

        const isArray = tplHost.hasAttribute('handlebars-array-template');
        const templateId = tplHost.getAttribute(isArray ? 'handlebars-array-template' : 'handlebars-template');

        const templateEl = htmx.find('#' + templateId);
        if (!templateEl) throw new Error('Unknown handlebars template: ' + templateId);

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error('Response was not valid JSON for handlebars template: ' + templateId);
        }

        // innerHTML escapes ">" to "&gt;" in text nodes (per the HTML serialization
        // spec), which mangles Handlebars partial calls: {{> partial}} → {{&gt; partial}}.
        // Reverse this specific escaping before compiling.
        const render = Handlebars.compile(templateEl.innerHTML.replaceAll('{{&gt;', '{{>'));

        // Object templates: spread `data` into the top level so templates can use
        // both {{message}}/{{status}} (for toasts) and {{name}}/{{id}} (for entities).
        // Envelope props (status, message) overlay record props — toasts need
        // {{status}} = "success"/"error". Entity templates that collide with envelope
        // keys (e.g. a `status` column) should use {{data.status}} instead.
        if (!isArray) {
            const hasDataObject = data && typeof data === 'object' && 'data' in data &&
                typeof data.data === 'object' && !Array.isArray(data.data);
            const renderData = hasDataObject
                ? { ...data.data, ...data, data: data.data }  // spread data props, then overlay top-level (status/message win)
                : data;
            return render(renderData);
        }

        // Array templates: normalize to { data: Array, meta?: Object }
        // Supports both raw arrays and { data: [...], meta: {...} } responses
        const isArrayResponse = Array.isArray(data);
        const rows = isArrayResponse ? data : Array.isArray(data?.data) ? data.data : [];
        const meta = !isArrayResponse && data && typeof data === 'object' ? data.meta ?? null : null;

        // Stash table sort meta on the element for the table-sort module
        if (meta?.table_sorts) {
            tplHost.dataset.tableSorts = JSON.stringify(meta.table_sorts);
        }

        // Optional: render pagination from meta as a side effect
        const pagTargetSel = tplHost.getAttribute('data-pagination-target');
        const pagTemplateId = tplHost.getAttribute('data-pagination-template');
        const pagSource = tplHost.getAttribute('data-pagination-source') || '';
        const pagParam = tplHost.getAttribute('data-pagination-param') || 'page';
        if (pagTargetSel && pagTemplateId) {
            const targetEl = document.querySelector(pagTargetSel);
            const tpl = document.getElementById(pagTemplateId);
            if (targetEl instanceof HTMLElement && tpl instanceof HTMLTemplateElement) {
                const pagRender = Handlebars.compile(tpl.innerHTML.replaceAll('{{&gt;', '{{>'));
                targetEl.innerHTML = pagRender({ meta, source: pagSource, param: pagParam });
            }
        }

        return render({ data: rows, meta });
    },
});
