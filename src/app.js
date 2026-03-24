import htmx from '@phillipsharring/graspr-framework/src/lib/htmx.js';
import Handlebars from 'handlebars';
import './styles/style.css';
import {
    registerHandlebarsHelpers,
    registerAbHelpers,
    initCopyIdHandler,
    registerToastHelpers,
    initToastEventHandlers,
    initPagination,
    initTableSort,
    onPageLoad,
    onAfterSwap,
} from '@phillipsharring/graspr-framework';

// Boosted navigation defaults to scrolling the swapped content into view.
// That can feel like a "jump" when moving between short/long pages (or using back/forward).
htmx.config.scrollIntoViewOnBoost = false;

window.Handlebars = Handlebars;

// Register Handlebars helpers
registerToastHelpers(Handlebars);
registerHandlebarsHelpers(Handlebars);
registerAbHelpers(Handlebars);

// import extensions AFTER globals are set
import '@phillipsharring/graspr-framework/src/lib/json-enc.js';
import '@phillipsharring/graspr-framework/src/lib/client-side-templates.js';

// Core infrastructure (self-registering)
import '@phillipsharring/graspr-framework/init';

// Binder Quest specific initialization (registers BQ helpers, etc.)
import './binder-quest/index.js';

// A/B testing (self-registering — fetches assignments via lifecycle hooks)
import './ab.js';

// Assemble window.BQ namespace (must be after all module imports)
import './namespace.js';

// Delegated JS behavior survives HTMX swaps
document.addEventListener('click', (e) => {
    const btn = e.target.closest("[data-action='ping']");
    if (!btn) return;

    alert('pong ✅ (delegated binding survives swaps)');
});

// Copy-to-clipboard button handler
initCopyIdHandler();

onPageLoad(function(doc) {
    initPagination(doc);
    initTableSort(doc);
    initToastEventHandlers();
});

onAfterSwap(function(target) {
    initPagination(target);
    initTableSort(target);
});
