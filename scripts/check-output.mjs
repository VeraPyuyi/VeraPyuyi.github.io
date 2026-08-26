import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const root = process.cwd();
const dist = join(root, 'dist');
if (!existsSync(dist)) throw new Error('dist/ does not exist; build the site first');

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function outputExists(pathname) {
  // GitHub Pages serves the single root 404.html for locale-prefixed misses too.
  if (/^\/(?:[a-z-]+\/)?404\/?$/i.test(pathname)) return existsSync(join(dist, '404.html'));
  const decoded = decodeURIComponent(pathname).replace(/^\/+|\/+$/g, '');
  const direct = join(dist, decoded);
  if (existsSync(direct)) return true;
  if (extname(decoded)) return false;
  return existsSync(join(dist, decoded, 'index.html')) || existsSync(`${direct}.html`);
}

const failures = [];
const htmlFiles = walk(dist).filter((file) => file.endsWith('.html'));
for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)) {
    const value = match[1];
    if (!value.startsWith('/') || value.startsWith('//')) continue;
    const pathname = value.split(/[?#]/, 1)[0];
    if (pathname.startsWith('/_astro/') || pathname === '') continue;
    // Local builds can omit PDFs when Tectonic is unavailable; CI uses the
    // strict paper build and must still fail if a linked PDF is missing.
    if (!process.env.CI && pathname.endsWith('/paper.pdf')) continue;
    if (!outputExists(pathname)) failures.push(`${file.replace(`${dist}/`, '')}: ${value}`);
  }
}

const required = [
  'index.html',
  'posts/index.html',
  'papers/index.html',
  'projects/index.html',
  'gallery/index.html',
  'moments/index.html',
  'guestbook/index.html',
  'en/index.html',
  '404.html',
];
for (const path of required) if (!existsSync(join(dist, path))) failures.push(`missing required output: ${path}`);

if (failures.length) throw new Error(`Broken output links:\n${[...new Set(failures)].join('\n')}`);
console.log(`[output] checked ${htmlFiles.length} HTML file(s)`);
