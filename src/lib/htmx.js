import htmx from 'htmx.org';

// Ensure there's exactly one shared HTMX instance, available both as an ES module
// import and as a global for any inline scripts / extensions that expect `window.htmx`.
window.htmx = window.htmx || htmx;

export default window.htmx;
