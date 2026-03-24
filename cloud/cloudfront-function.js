/**
 * CloudFront Function for Dynamic Route Rewriting
 *
 * This function rewrites URLs with dynamic segments to their corresponding
 * static template files that were generated during the build.
 *
 * HOW IT WORKS:
 * - During build, templates like `src/pages/series/[id]/index.html` are output
 *   to `dist/series/[id]/index.html`
 * - When a user visits `/series/abc123/`, CloudFront needs to serve
 *   `/series/[id]/index.html`
 * - This function performs that URL rewrite
 *
 * SETUP IN CLOUDFRONT:
 * 1. Go to CloudFront > Functions
 * 2. Create a new function
 * 3. Paste this code
 * 4. Publish the function
 * 5. Associate it with your distribution as a "Viewer Request" function
 *
 * ADDING NEW DYNAMIC ROUTES:
 * When you add a new page with [param] syntax, add a pattern to the list below:
 *
 * Pattern format: [regex, replacement]
 * - regex: Matches the incoming URL pattern
 * - replacement: The static template path to serve
 *
 * Example:
 *   [/^\/series\/[^\/]+\/collections\/?$/, '/series/[id]/collections/']
 *
 * This matches:   /series/abc123/collections/
 * And rewrites to: /series/[id]/collections/index.html (after adding index.html)
 *
 * PATTERN MATCHING TIPS:
 * - Use ^ and $ to match the entire path
 * - Use [^\/]+ to match any segment (non-slash characters)
 * - Use \/? for optional trailing slash
 * - Order patterns from most specific to least specific
 * - Test your patterns at regex101.com
 */

function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Define your dynamic route patterns here.
    // Each entry is: [regex pattern, replacement path]
    // Patterns are checked in order - put more specific patterns first.
    var patterns = [
        // Example: /series/{anything}/collections/ -> /series/[id]/collections/
        [/^\/series\/[^\/]+\/collections\/?$/, '/series/[id]/collections/'],

        // Example: /series/{anything}/ -> /series/[id]/
        [/^\/series\/[^\/]+\/?$/, '/series/[id]/'],

        // Example: /examples/{anything}/ -> /examples/[id]/
        [/^\/examples\/[^\/]+\/?$/, '/examples/[id]/'],

        // Game binder dynamic routes
        [/^\/game\/binder\/series\/[^\/]+\/?$/, '/game/binder/series/[id]/'],
        [/^\/game\/binder\/collections\/[^\/]+\/?$/, '/game/binder/collections/[id]/'],

        // Admin design dynamic routes
        [/^\/admin\/design\/series\/[^\/]+\/?$/, '/admin/design/series/[id]/'],
        [/^\/admin\/design\/collections\/[^\/]+\/?$/, '/admin/design/collections/[id]/'],
        [/^\/admin\/design\/card-designs\/[^\/]+\/?$/, '/admin/design/card-designs/[id]/'],
        [/^\/admin\/design\/effects\/[^\/]+\/?$/, '/admin/design/effects/[id]/'],
        [/^\/admin\/design\/pack-templates\/[^\/]+\/?$/, '/admin/design/pack-templates/[id]/'],

        // Admin story dynamic routes
        [/^\/admin\/story\/locations\/[^\/]+\/map\/?$/, '/admin/story/locations/[id]/map/'],
        [/^\/admin\/story\/locations\/[^\/]+\/condition\/?$/, '/admin/story/locations/[id]/condition/'],
        [/^\/admin\/story\/locations\/[^\/]+\/?$/, '/admin/story/locations/[id]/'],
        [/^\/admin\/story\/characters\/[^\/]+\/?$/, '/admin/story/characters/[id]/'],
        [/^\/admin\/story\/encounters\/[^\/]+\/author\/?$/, '/admin/story/encounters/[id]/author/'],
        [/^\/admin\/story\/encounters\/[^\/]+\/condition\/?$/, '/admin/story/encounters/[id]/condition/'],
        [/^\/admin\/story\/encounters\/[^\/]+\/?$/, '/admin/story/encounters/[id]/'],
    ];

    // Try each pattern until we find a match
    for (var i = 0; i < patterns.length; i++) {
        var pattern = patterns[i][0];
        var replacement = patterns[i][1];

        if (pattern.test(uri)) {
            uri = replacement;
            break;
        }
    }

    // CloudFront/S3 expects file paths, not directory paths.
    // If the URI ends with /, append index.html
    if (uri.endsWith('/')) {
        uri += 'index.html';
    }

    request.uri = uri;
    return request;
}

/**
 * TESTING LOCALLY:
 *
 * You can test this function by running it in Node.js:
 *
 * const testUrls = [
 *   '/series/abc123/',
 *   '/series/abc123/collections/',
 *   '/examples/test-example/',
 *   '/about/',  // Should not be rewritten
 * ];
 *
 * testUrls.forEach(url => {
 *   const result = handler({
 *     request: { uri: url }
 *   });
 *   c/onsole.log(`${url} -> ${result.uri}`);
 * });
 *
 * Expected output:
 * /series/abc123/ -> /series/[id]/index.html
 * /series/abc123/collections/ -> /series/[id]/collections/index.html
 * /examples/test-example/ -> /examples/[id]/index.html
 * /about/ -> /about/index.html
 */
