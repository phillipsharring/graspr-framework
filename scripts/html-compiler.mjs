import fs from 'node:fs/promises';
import path from 'node:path';

function htmlEscape(s) {
    return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function findTagEnd(src, startIdx) {
    // Finds the closing '>' for a tag starting at startIdx, respecting quoted attribute values.
    let i = startIdx;
    let quote = null;
    for (; i < src.length; i++) {
        const ch = src[i];
        if (quote) {
            if (ch === quote) quote = null;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (ch === '>') return i;
    }
    return -1;
}

function parseAttributes(attrSrc) {
    // Minimal HTML attribute parser:
    // - foo="bar" or foo='bar' -> string
    // - bare boolean attrs like `disabled` -> true
    const attrs = {};
    let i = 0;
    const s = attrSrc.trim();

    while (i < s.length) {
        while (i < s.length && /\s/.test(s[i])) i++;
        if (i >= s.length) break;

        // name
        let nameStart = i;
        while (i < s.length && /[^\s=]/.test(s[i])) i++;
        const name = s.slice(nameStart, i);
        if (!name) break;

        while (i < s.length && /\s/.test(s[i])) i++;

        if (s[i] !== '=') {
            attrs[name] = true;
            continue;
        }

        i++; // =
        while (i < s.length && /\s/.test(s[i])) i++;

        const q = s[i];
        if (q === '"' || q === "'") {
            i++;
            const valStart = i;
            while (i < s.length && s[i] !== q) i++;
            attrs[name] = s.slice(valStart, i);
            if (s[i] === q) i++;
        } else {
            // unquoted value
            const valStart = i;
            while (i < s.length && !/\s/.test(s[i])) i++;
            attrs[name] = s.slice(valStart, i);
        }
    }

    return attrs;
}

function renderIfBlocks(src, props) {
    // Stack-based parser; supports nesting + optional else:
    // [[#if flag]] ... [[else]] ... [[/if]]
    const tokenRe = /\[\[#if\s+([a-zA-Z0-9_-]+)\s*\]\]|\[\[else\]\]|\[\[\/if\]\]/g;

    /** @type {Array<{flag:string, thenParts:string[], elseParts:string[], inElse:boolean}>} */
    const stack = [];
    let out = '';
    let last = 0;
    let m;

    function appendText(t) {
        if (!t) return;
        if (stack.length === 0) {
            out += t;
            return;
        }
        const top = stack[stack.length - 1];
        (top.inElse ? top.elseParts : top.thenParts).push(t);
    }

    while ((m = tokenRe.exec(src))) {
        const idx = m.index;
        const tok = m[0];

        appendText(src.slice(last, idx));

        if (tok.startsWith('[[#if')) {
            const flag = m[1];
            stack.push({ flag, thenParts: [], elseParts: [], inElse: false });
            last = idx + tok.length;
            continue;
        }

        if (tok === '[[else]]') {
            if (stack.length === 0) {
                // stray else, keep literal
                appendText(tok);
            } else {
                stack[stack.length - 1].inElse = true;
            }
            last = idx + tok.length;
            continue;
        }

        if (tok === '[[/if]]') {
            if (stack.length === 0) {
                // stray close, keep literal
                appendText(tok);
            } else {
                const frame = stack.pop();
                const enabled = !!props[frame.flag];
                const chosen = enabled ? frame.thenParts.join('') : frame.elseParts.join('');
                appendText(chosen);
            }
            last = idx + tok.length;
            continue;
        }
    }

    appendText(src.slice(last));

    // If we ended with unclosed ifs, treat them as literal (best-effort).
    while (stack.length) {
        const frame = stack.shift();
        const literal =
            `[[#if ${frame.flag}]]` +
            frame.thenParts.join('') +
            (frame.inElse ? '[[else]]' + frame.elseParts.join('') : '');
        out = literal + out;
    }

    return out;
}

function mergeRootClass(renderedHtml, extraClass) {
    if (!extraClass) return renderedHtml;
    const extra = String(extraClass).trim();
    if (!extra) return renderedHtml;

    // If the template explicitly uses [[class]] somewhere, don't auto-merge.
    if (renderedHtml.includes('[[class]]') || renderedHtml.includes('[[{class}]]')) {
        return renderedHtml;
    }

    const lt = renderedHtml.indexOf('<');
    if (lt === -1) return renderedHtml;

    // Skip comments / doctype
    const isComment = renderedHtml.startsWith('<!--', lt);
    const isDoc = renderedHtml.toLowerCase().startsWith('<!doctype', lt);
    if (isComment || isDoc) return renderedHtml;

    const gt = findTagEnd(renderedHtml, lt);
    if (gt === -1) return renderedHtml;

    const openTag = renderedHtml.slice(lt, gt + 1);
    if (openTag.startsWith('</')) return renderedHtml;

    // Parse tag name
    const tagMatch = openTag.match(/^<\s*([a-zA-Z][a-zA-Z0-9:-]*)\b/);
    if (!tagMatch) return renderedHtml;
    const tagName = tagMatch[1];
    const selfClosing = openTag.endsWith('/>');

    // Extract attribute segment (everything after tag name and before >)
    const attrSegment = openTag.slice(tagMatch[0].length).replace(/\/?>$/, '');

    const attrs = parseAttributes(attrSegment);

    const existing = typeof attrs.class === 'string' ? attrs.class.trim() : '';
    const merged = existing ? `${existing} ${extra}` : extra;

    // Rebuild open tag with merged class.
    // Note: We don't preserve original attribute ordering perfectly; good enough for bake-time.
    attrs.class = merged;
    const rebuiltAttrs = Object.entries(attrs)
        .filter(([k]) => k !== 'name' && k !== 'file') // component-only attrs shouldn't leak into HTML
        .map(([k, v]) => {
            if (v === true) return k;
            return `${k}="${String(v).replaceAll('"', '&quot;')}"`;
        })
        .join(' ');

    const rebuilt = `<${tagName}${rebuiltAttrs ? ' ' + rebuiltAttrs : ''}${selfClosing ? ' />' : '>'}`;
    return renderedHtml.slice(0, lt) + rebuilt + renderedHtml.slice(gt + 1);
}

function renderComponentTemplate(tplSrc, props, slotHtml) {
    let out = tplSrc;

    // conditionals first
    out = renderIfBlocks(out, props);

    // slot injection
    out = out.replaceAll('[[slot]]', slotHtml ?? '');

    // prop injection:
    // - [[prop]] escapes by default (safe HTML text)
    // - [[{prop}]] is raw (for attributes or HTML snippets)
    out = out.replace(/\[\[\{([a-zA-Z0-9_-]+)\}\]\]/g, (_, k) => String(props[k] ?? ''));
    out = out.replace(/\[\[([a-zA-Z0-9_-]+)\]\]/g, (_, k) => htmlEscape(props[k] ?? ''));

    // If caller provides class="" prop, merge it into the component root element's class attribute.
    if (typeof props.class === 'string') {
        out = mergeRootClass(out, props.class);
    }

    return out;
}

function findMatchingCloseForTag(src, tagName, fromIdx) {
    // fromIdx points just after the opening tag.
    // Returns index of matching closing tag start.
    const open = `<${tagName}`;
    const close = `</${tagName}>`;
    let depth = 1;
    let i = fromIdx;

    while (i < src.length) {
        const nextOpen = src.indexOf(open, i);
        const nextClose = src.indexOf(close, i);

        if (nextClose === -1) return -1;
        if (nextOpen !== -1 && nextOpen < nextClose) {
            // Ensure it's actually a tag, not text; good enough for our controlled input.
            depth++;
            i = nextOpen + open.length;
            continue;
        }

        depth--;
        if (depth === 0) return nextClose;
        i = nextClose + close.length;
    }

    return -1;
}

function isCustomComponentTagName(tagName) {
    // HTML custom elements must include a hyphen; we use that convention.
    return /^[a-z][a-z0-9-]*-[a-z0-9-]+$/i.test(tagName);
}

function pascalFromKebab(s) {
    return s
        .split('-')
        .filter(Boolean)
        .map((p) => p[0].toUpperCase() + p.slice(1))
        .join('');
}

async function resolveComponentTemplatePath({ componentsDir, componentNames, attrs, tagName }) {
    const file = typeof attrs.file === 'string' ? attrs.file : null;
    const name = typeof attrs.name === 'string' ? attrs.name : null;

    if (file) return path.resolve(componentsDir, file);

    if (tagName === 'component') {
        if (!name) {
            throw new Error('Component tag missing `name` or `file`: <component ...>');
        }
        return path.resolve(componentsDir, `${name}.html`);
    }

    const lower = String(tagName).toLowerCase();
    const isKnown = componentNames?.has(lower);

    // Default rule:
    // - HTML custom elements (<my-component>) are treated as components
    // - Additionally, if a file exists in src/components matching the tag name (e.g. callout.html),
    //   treat <callout> as a component too (even though HTML custom elements normally require a hyphen).
    if (!isCustomComponentTagName(tagName) && !isKnown) {
        throw new Error(
            `Unknown component tag: <${tagName}> (expected <component name="...">, a custom element tag like <my-component>, or a tag with a matching template in src/components/)`
        );
    }

    const kebabPath = path.resolve(componentsDir, `${tagName}.html`);
    try {
        await fs.access(kebabPath);
        return kebabPath;
    } catch {
        // fallthrough
    }

    const pascalPath = path.resolve(componentsDir, `${pascalFromKebab(tagName)}.html`);
    return pascalPath;
}

async function expandComponents(html, { componentsDir, componentNames, maxPasses = 50 }) {
    let src = html;

    // Multi-pass expansion so nested components work.
    // Guard against infinite recursion by capping passes.
    for (let pass = 0; pass < maxPasses; pass++) {
        let changed = false;
        let idx = 0;

        while (idx < src.length) {
            const lt = src.indexOf('<', idx);
            if (lt === -1) break;

            // Quick skip for closing tags, comments, doctype
            if (
                src.startsWith('</', lt) ||
                src.startsWith('<!--', lt) ||
                src.toLowerCase().startsWith('<!doctype', lt)
            ) {
                idx = lt + 2;
                continue;
            }

            const tagEnd = findTagEnd(src, lt);
            if (tagEnd === -1) break;

            const openTag = src.slice(lt, tagEnd + 1);
            const tagMatch = openTag.match(/^<\s*([a-zA-Z][a-zA-Z0-9:-]*)\b/);
            if (!tagMatch) {
                idx = tagEnd + 1;
                continue;
            }

            const tagName = tagMatch[1];
            const tagLower = tagName.toLowerCase();
            const isComponentTag =
                tagLower === 'component' ||
                isCustomComponentTagName(tagName) ||
                (componentNames?.has(tagLower) ?? false);
            if (!isComponentTag) {
                idx = tagEnd + 1;
                continue;
            }

            const selfClosing = openTag.endsWith('/>');
            const attrText = openTag.slice(tagMatch[0].length).replace(/\/?>$/, '');
            const attrs = parseAttributes(attrText);

            const componentPath = await resolveComponentTemplatePath({
                componentsDir,
                componentNames,
                attrs,
                tagName: tagName.toLowerCase(),
            });
            const tplSrc = await fs.readFile(componentPath, 'utf-8');

            let slotHtml = '';
            let closeEnd = tagEnd + 1;

            if (!selfClosing) {
                const closeIdx = findMatchingCloseForTag(src, tagName, tagEnd + 1);
                if (closeIdx === -1) {
                    throw new Error(`Unclosed <${tagName}> tag near: ${openTag}`);
                }
                slotHtml = src.slice(tagEnd + 1, closeIdx);
                closeEnd = closeIdx + `</${tagName}>`.length;
            }

            const props = { ...attrs };
            // Normalize boolean attrs: present -> true
            for (const [k, v] of Object.entries(props)) {
                if (v === true) props[k] = true;
            }

            // For custom element tags (<my-component>), treat tag name as the component identity,
            // but don't leak HTML-only attrs like name/file to the rendered HTML.
            const rendered = renderComponentTemplate(tplSrc, props, slotHtml);

            src = src.slice(0, lt) + rendered + src.slice(closeEnd);
            changed = true;
            idx = lt + rendered.length;
        }

        if (!changed) return src;
    }

    throw new Error(`Component expansion exceeded max passes (${maxPasses}). Possible recursive component loop?`);
}

async function expandTemplateSrc(html, pageDir) {
    let src = html;
    let idx = 0;

    while (idx < src.length) {
        const lt = src.indexOf('<template', idx);
        if (lt === -1) break;

        const ch = src[lt + '<template'.length];
        if (ch && ch !== '>' && !/\s/.test(ch)) {
            idx = lt + 1;
            continue;
        }

        const tagEnd = findTagEnd(src, lt);
        if (tagEnd === -1) break;

        const openTag = src.slice(lt, tagEnd + 1);
        const attrText = openTag.slice('<template'.length).replace(/\/?>$/, '');
        const attrs = parseAttributes(attrText);

        if (!attrs.src || typeof attrs.src !== 'string') {
            idx = tagEnd + 1;
            continue;
        }

        const closeIdx = findMatchingCloseForTag(src, 'template', tagEnd + 1);
        if (closeIdx === -1) {
            throw new Error(`Unclosed <template src="${attrs.src}"> near: ${openTag}`);
        }
        const closeEnd = closeIdx + '</template>'.length;

        const filePath = path.resolve(pageDir, `${attrs.src}.html`);
        const tplSrc = await fs.readFile(filePath, 'utf-8');

        const props = { ...attrs };
        delete props.src;
        const rendered = renderComponentTemplate(tplSrc, props, '');

        const outputAttrs = Object.entries(attrs)
            .filter(([k]) => k !== 'src')
            .map(([k, v]) => {
                if (v === true) return k;
                return `${k}="${String(v).replaceAll('"', '&quot;')}"`;
            })
            .join(' ');

        const output = `<template${outputAttrs ? ' ' + outputAttrs : ''}>${rendered}</template>`;
        src = src.slice(0, lt) + output + src.slice(closeEnd);
        idx = lt + output.length;
    }

    return src;
}

/**
 * Extract layout declaration from page source.
 * Looks for <layout name="layoutName" title="..." /> at the start of the file.
 * Returns { layoutName, title, pageContent } where pageContent has the tag stripped.
 */
function extractLayoutDeclaration(pageSrc) {
    // Match <layout ... /> tag at the start (self-closing, with attributes)
    const layoutTagRe = /^\s*<layout\s+([^>]*?)\/>\s*/i;
    const match = pageSrc.match(layoutTagRe);

    if (match) {
        const attrString = match[1];
        const attrs = parseAttributes(attrString);

        return {
            layoutName: attrs.name || 'base',
            title: attrs.title || null,
            pageContent: pageSrc.slice(match[0].length),
        };
    }

    return {
        layoutName: 'base',
        title: null,
        pageContent: pageSrc,
    };
}

/**
 * Extract <page-head> content from page source.
 * Returns { pageHead, pageContent } where pageContent has the tag stripped.
 */
function extractPageHead(pageSrc) {
    // Match <page-head>...</page-head> (can span multiple lines)
    const pageHeadRe = /^\s*<page-head>([\s\S]*?)<\/page-head>\s*/i;
    const match = pageSrc.match(pageHeadRe);

    if (match) {
        return {
            pageHead: match[1].trim(),
            pageContent: pageSrc.slice(match[0].length),
        };
    }

    return {
        pageHead: '',
        pageContent: pageSrc,
    };
}

export async function renderPage({ layoutsDir, pagePath, title, jsSrc, cssHref, componentsDir, siteConfig = {} }) {
    // Read page first to detect layout declaration
    const pageSrcRaw = await fs.readFile(pagePath, 'utf-8');
    const { layoutName, title: layoutTitle, pageContent: afterLayoutTag } = extractLayoutDeclaration(pageSrcRaw);

    // Extract <page-head> content if present
    const { pageHead, pageContent: pageSrcStripped } = extractPageHead(afterLayoutTag);

    // Resolve layout path from layoutsDir and detected layout name
    const layoutPath = path.join(layoutsDir, `${layoutName}.html`);
    const layoutSrcRaw = await fs.readFile(layoutPath, 'utf-8');

    // Discover all available components
    const componentNames = new Set(
        (await fs.readdir(componentsDir))
            .filter((f) => f.toLowerCase().endsWith('.html'))
            .map((f) => f.slice(0, -'.html'.length).toLowerCase())
    );

    // Expand components in both page and layout
    let pageSrc = await expandComponents(pageSrcStripped, { componentsDir, componentNames });
    pageSrc = await expandTemplateSrc(pageSrc, path.dirname(pagePath));
    const layoutSrc = await expandComponents(layoutSrcRaw, { componentsDir, componentNames });

    // Use layout-declared title if present, otherwise fall back to auto-generated title.
    // [[title]] resolves to "PageTitle | " (with separator) or "" (empty) — the layout
    // provides its own suffix in the <title> tag, e.g. <title>[[title]]Binder Quest!</title>
    const pageTitle = layoutTitle ?? title ?? '';
    const titlePrefix = pageTitle ? `${pageTitle} | ` : '';

    // Start with layout and inject standard props
    let result = layoutSrc
        .replaceAll('[[title]]', htmlEscape(titlePrefix))
        .replaceAll('[[cssHref]]', cssHref ? `<link rel="stylesheet" href="${htmlEscape(cssHref)}" />` : '')
        .replaceAll('[[jsSrc]]', jsSrc ? `<script src="${htmlEscape(jsSrc)}" type="module" defer></script>` : '')
        .replaceAll('[[pageHead]]', pageHead)
        .replace('[[app]]', pageSrc);

    // Inject site config values (e.g., [[siteName]], [[copyright]])
    for (const [key, value] of Object.entries(siteConfig)) {
        result = result.replaceAll(`[[${key}]]`, htmlEscape(String(value ?? '')));
    }

    return result;
}
