/**
 * Register A/B testing Handlebars helpers.
 *
 * Usage in templates:
 *   {{#ab "test-name" "a"}}...content for variant a...{{/ab}}
 *   {{#ab "test-name" "b"}}...content for variant b...{{/ab}}
 *
 * The template context must include an `ab` object mapping test names to assigned variants.
 * This is typically set on the rendering context before template execution.
 *
 * @param {typeof import('handlebars')} Handlebars
 */
export function registerAbHelpers(Handlebars) {
    /**
     * Block helper: renders content only if the visitor's assignment matches.
     *
     * @example
     *   {{#ab "headline" "a"}}<h1>Original headline</h1>{{/ab}}
     *   {{#ab "headline" "b"}}<h1>New headline</h1>{{/ab}}
     */
    Handlebars.registerHelper('ab', function (testName, variant, options) {
        // `this` is the Handlebars context — look for ab assignments
        var assignments = this.ab || {};
        if (assignments[testName] === variant) {
            return options.fn(this);
        }
        return '';
    });
}
