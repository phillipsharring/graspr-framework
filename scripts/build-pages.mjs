import fs from 'node:fs/promises';
import path from 'node:path';
import { renderPage } from './html-compiler.mjs';
import siteConfig from '../site.config.js';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const pagesDir = path.join(root, 'content', 'pages');
const layoutsDir = path.join(root, 'content', 'layouts');
const componentsDir = path.join(root, 'content', 'components');
const siteName = siteConfig.siteName || 'Site';

// Read Vite manifest (for hashed asset filenames)
async function readManifest() {
    const manifestPath = path.join(distDir, '.vite', 'manifest.json');
    try {
        const json = await fs.readFile(manifestPath, 'utf-8');
        return JSON.parse(json);
    } catch {
        return null;
    }
}

// Try to locate built CSS/JS from manifest.
// Assumes Vite input is src/app.js which imports CSS.
function resolveAssetsFromManifest(manifest) {
    if (!manifest) return { jsSrc: '/assets/app.js', cssHref: '/assets/app.css' };

    // Find the entry marked as isEntry
    const entry = Object.values(manifest).find((v) => v.isEntry);
    const jsFile = entry?.file ? `/${entry.file}` : null;

    // Vite puts imported CSS on entry.css array
    const cssFile = entry?.css?.[0] ? `/${entry.css[0]}` : null;

    return {
        jsSrc: jsFile,
        cssHref: cssFile,
    };
}

async function ensureDir(dir) {
    await fs.mkdir(dir, { recursive: true });
}

async function writeFile(filePath, contents) {
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, contents, 'utf-8');
}

function normalizeUrlPath(urlPath) {
    if (!urlPath) return '/';
    if (urlPath === '/') return '/';
    return urlPath.endsWith('/') ? urlPath : `${urlPath}/`;
}

function titleFromUrlPath(urlPath) {
    const p = normalizeUrlPath(urlPath);
    if (p === '/') return '';
    const segs = p
        .replace(/^\/|\/$/g, '')
        .split('/')
        .filter(Boolean);
    const last = segs[segs.length - 1] || 'Page';
    return last
        .split(/[-_]+/g)
        .filter(Boolean)
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ');
}

async function listHtmlFilesRecursive(dir) {
    /** @type {string[]} */
    const out = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            out.push(...(await listHtmlFilesRecursive(full)));
        } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.html') && !ent.name.startsWith('_')) {
            out.push(full);
        }
    }
    return out;
}

function routeAndOutDirFromPageRel(relPath) {
    // relPath is posix-ish relative path under src/pages, using OS separators.
    const rel = relPath.replaceAll(path.sep, '/');
    if (rel === 'index.html') {
        return { route: '/', outDir: distDir };
    }

    const dir = path.posix.dirname(rel);
    const base = path.posix.basename(rel);

    if (base === 'index.html') {
        const route = `/${dir}/`.replaceAll('//', '/');
        return { route, outDir: path.join(distDir, dir) };
    }

    const name = base.slice(0, -'.html'.length);
    const route = `/${dir === '.' ? '' : `${dir}/`}${name}/`.replaceAll('//', '/');
    const outDir = path.join(distDir, dir === '.' ? '' : dir, name);
    return { route, outDir };
}

async function main() {
    const manifest = await readManifest();
    const { jsSrc, cssHref } = resolveAssetsFromManifest(manifest);

    const pageFiles = await listHtmlFilesRecursive(pagesDir);

    // Prefer directory index pages (foo/index.html) over same-route flat pages (foo.html).
    pageFiles.sort((a, b) => {
        const aBase = path.basename(a).toLowerCase();
        const bBase = path.basename(b).toLowerCase();
        if (aBase === 'index.html' && bBase !== 'index.html') return -1;
        if (bBase === 'index.html' && aBase !== 'index.html') return 1;
        return a.localeCompare(b);
    });

    /** @type {Array<{route:string, outDir:string, pagePath:string, title:string}>} */
    const pages = [];
    const seen = new Map(); // route -> pagePath

    for (const filePath of pageFiles) {
        const rel = path.relative(pagesDir, filePath);
        const { route, outDir } = routeAndOutDirFromPageRel(rel);
        if (seen.has(route)) {
            // First one wins (due to sort pref); warn so it's obvious during builds.
            console.warn(
                `Duplicate route ${route} from ${path.relative(root, filePath)}; keeping ${path.relative(
                    root,
                    seen.get(route)
                )}`
            );
            continue;
        }

        seen.set(route, filePath);
        pages.push({
            route,
            outDir,
            pagePath: filePath,
            title: titleFromUrlPath(route),
        });
    }

    for (const p of pages) {
        const html = await renderPage({
            layoutsDir,
            pagePath: p.pagePath,
            title: p.title,
            componentsDir,
            siteConfig,
            jsSrc,
            cssHref,
        });

        await writeFile(path.join(p.outDir, 'index.html'), html);
    }

    console.log(
        'Built pages:',
        pages.map((p) => `${p.route} -> ${path.relative(root, path.join(p.outDir, 'index.html'))}`).join(', ')
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
