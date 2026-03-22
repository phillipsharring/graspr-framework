import htmx from './htmx.js';

htmx.defineExtension('json-enc', {
    onEvent(name, evt) {
        if (name !== 'htmx:configRequest') return;

        const verb = (evt.detail.verb || 'get').toLowerCase();

        // Only apply JSON content-type for non-GET requests.
        if (verb === 'get') return;

        evt.detail.headers['Content-Type'] = 'application/json';
        evt.detail.headers['Accept'] = 'application/json';
    },

    encodeParameters(xhr, parameters) {
        xhr.overrideMimeType('application/json');
        return JSON.stringify(parameters);
    },
});
