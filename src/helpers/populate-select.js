/**
 * Populate a <select> from a JSON API endpoint.
 * Fetches { data: [{ id, name }, ...] } and appends <option> elements.
 * @param {HTMLSelectElement} select
 * @param {string} endpoint
 * @param {string} [selectedId]
 */
export function populateSelect(select, endpoint, selectedId) {
    fetch(endpoint)
        .then(function(r) { return r.json(); })
        .then(function(json) {
            if (json.status !== 'success' || !json.data) return;
            json.data.forEach(function(item) {
                var opt = document.createElement('option');
                opt.value = item.id;
                opt.textContent = item.name;
                if (selectedId && item.id === selectedId) opt.selected = true;
                select.appendChild(opt);
            });
        });
}
