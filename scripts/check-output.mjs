import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import matter from 'gray-matter';

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
  'blogs/index.html',
  'projects/index.html',
  'gallery/index.html',
  'moments/index.html',
  'guestbook/index.html',
  'en/index.html',
  'en/posts/index.html',
  'en/papers/index.html',
  'en/blogs/index.html',
  'en/projects/index.html',
  'rss.xml',
  'en/rss.xml',
  '404.html',
];

const paperSlugs = readdirSync(join(root, 'src/content/papers'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const blogArticles = readdirSync(join(root, 'src/content/blogs'), { withFileTypes: true })
  .filter((entry) => entry.isFile() && ['.md', '.mdx'].includes(extname(entry.name)))
  .map((entry) => {
    const source = readFileSync(join(root, 'src/content/blogs', entry.name), 'utf8');
    const { data } = matter(source);
    return {
      language: data.language,
      routeSlug: data.routeSlug,
      translationKey: data.translationKey,
    };
  });
for (const article of blogArticles) {
  const localePrefix = article.language === 'en' ? 'en/' : '';
  required.push(`${localePrefix}blogs/${article.routeSlug}/index.html`);
}
let equationTotal = 0;
for (const slug of paperSlugs) {
  required.push(`papers/${slug}/index.html`, `en/papers/${slug}/index.html`);
  if (process.env.CI) {
    required.push(
      `papers/${slug}/paper.pdf`,
      `papers/${slug}/equations-desktop.svg`,
      `papers/${slug}/equations-tablet.svg`,
      `papers/${slug}/equations-mobile.svg`,
      `papers/${slug}/equations-manifest.json`,
    );
    const manifestPath = join(dist, `papers/${slug}/equations-manifest.json`);
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (!Number.isInteger(manifest.count) || manifest.count <= 0) {
        failures.push(`${slug}: invalid equation manifest count`);
      }
      if (!Array.isArray(manifest.equations) || manifest.equations.length !== manifest.count) {
        failures.push(`${slug}: equation manifest entries do not match count`);
      } else {
        equationTotal += manifest.count;
        for (const [index, equation] of manifest.equations.entries()) {
          const expectedId = `eq-${String(index + 1).padStart(6, '0')}`;
          if (equation.id !== expectedId) failures.push(`${slug}: equation ${index + 1} has unstable id ${equation.id}`);
          if (!/^(?:label:[^\s]+|sha256:[a-f0-9]{64})$/.test(equation.sourceKey ?? '')) {
            failures.push(`${slug}: ${expectedId} has invalid source identity`);
          }
          if (!['standalone', 'contained'].includes(equation.context)) {
            failures.push(`${slug}: ${expectedId} has invalid context`);
          }
          for (const variant of ['desktop', 'tablet', 'mobile']) {
            const asset = equation.variants?.[variant];
            if (!asset) {
              failures.push(`${slug}: ${expectedId} is missing ${variant} metadata`);
              continue;
            }
            if (asset.context !== equation.context) failures.push(`${slug}: ${expectedId} changed context in ${variant}`);
            if (!['original', 'single-line', 'compact'].includes(asset.layout)) {
              failures.push(`${slug}: ${expectedId} has invalid ${variant} layout`);
            }
            if (!['auto-original', 'auto-single-line', 'override-original', 'override-compact'].includes(asset.layoutReason)) {
              failures.push(`${slug}: ${expectedId} has invalid ${variant} layout reason`);
            }
            if (typeof asset.overflow !== 'boolean' || !(asset.targetWidthEm > 0)) {
              failures.push(`${slug}: ${expectedId} has invalid ${variant} measurements`);
            }
            const expectedHref = `/papers/${slug}/equations-${variant}.svg#${expectedId}`;
            if (asset.href !== expectedHref) failures.push(`${slug}: ${expectedId} has invalid ${variant} href`);
          }
        }
      }
      for (const variant of ['desktop', 'tablet', 'mobile']) {
        const spritePath = join(dist, `papers/${slug}/equations-${variant}.svg`);
        if (!existsSync(spritePath)) continue;
        const sprite = readFileSync(spritePath, 'utf8');
        const symbols = (sprite.match(/<symbol\b/g) ?? []).length;
        if (symbols !== manifest.count) failures.push(`${slug}: ${variant} sprite has ${symbols}/${manifest.count} equations`);
        if (/<(?:text|script|foreignObject|image)\b/i.test(sprite) || /(?:href|src)=["'](?:https?:|\/\/)/i.test(sprite)) {
          failures.push(`${slug}: ${variant} sprite contains unsafe or browser-font content`);
        }
      }
    }
  }
}
if (process.env.CI && equationTotal !== 494) failures.push(`paper equation total changed: ${equationTotal}/494`);
for (const path of required) if (!existsSync(join(dist, path))) failures.push(`missing required output: ${path}`);

const forbidden = [
  'categories/index.html',
  'tags/index.html',
  'archives/index.html',
  'en/categories/index.html',
  'en/tags/index.html',
  'en/archives/index.html',
  'papers/berstein-transfers-greedy-records/index.html',
  'posts/2/index.html',
  'en/posts/2/index.html',
  'post/life/welcome/index.html',
  'post/tech/site-capabilities/index.html',
  'post/research/latex-publishing/index.html',
  'post/acg/watchlist-notes/index.html',
  'en/post/life/welcome/index.html',
  'en/post/tech/site-capabilities/index.html',
  'en/post/research/latex-publishing/index.html',
  'en/post/acg/watchlist-notes/index.html',
];
for (const path of forbidden) if (existsSync(join(dist, path))) failures.push(`removed route was generated: ${path}`);

if (!existsSync(join(dist, 'papers/bernstein-transfers-greedy-records/index.html'))) {
  failures.push('missing correct Bernstein paper route');
}

for (const localePrefix of ['', 'en/']) {
  const postsPath = join(dist, `${localePrefix}posts/index.html`);
  if (!existsSync(postsPath)) continue;
  const postsHtml = readFileSync(postsPath, 'utf8');
  for (const slug of paperSlugs) {
    const href = `/${localePrefix}papers/${slug}`;
    if (!postsHtml.includes(href)) failures.push(`${localePrefix}posts: missing paper ${slug}`);
  }
  const language = localePrefix === 'en/' ? 'en' : 'zh';
  for (const article of blogArticles.filter((entry) => entry.language === language)) {
    const href = `/${localePrefix}blogs/${article.routeSlug}`;
    if (!postsHtml.includes(href)) failures.push(`${localePrefix}posts: missing blog ${article.routeSlug}`);
  }
  if (postsHtml.includes('id="blog-personal-site"')) failures.push(`${localePrefix}posts: contains independent site entry`);
  if (!postsHtml.includes('data-pagefind-ignore="all"'))
    failures.push(`${localePrefix}posts: aggregate content is indexed twice`);
  if (/href=["']\/(?:en\/)?post\//.test(postsHtml)) failures.push(`${localePrefix}posts: contains removed post route`);
}

for (const localePrefix of ['', 'en/']) {
  const rssPath = join(dist, `${localePrefix}rss.xml`);
  if (!existsSync(rssPath)) continue;
  const rss = readFileSync(rssPath, 'utf8');
  const itemBlocks = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1]);
  const language = localePrefix === 'en/' ? 'en' : 'zh';
  const localeBlogs = blogArticles.filter((entry) => entry.language === language);
  const expectedGuids = [
    ...paperSlugs.map((slug) => `paper:${slug}`),
    ...localeBlogs.map((entry) => `blog:${entry.translationKey}`),
  ];
  for (const guid of expectedGuids) {
    if (!rss.includes(`<guid isPermaLink="false">${guid}</guid>`)) failures.push(`${localePrefix}rss.xml: missing ${guid}`);
  }
  if (itemBlocks.length !== expectedGuids.length)
    failures.push(`${localePrefix}rss.xml: expected ${expectedGuids.length} items`);
  for (const article of localeBlogs) {
    const guid = `blog:${article.translationKey}`;
    const blogItem = itemBlocks.find((item) => item.includes(guid));
    if (!blogItem || !/<pubDate>/.test(blogItem)) failures.push(`${localePrefix}rss.xml: ${guid} has no publication date`);
    const href = `/${localePrefix}blogs/${article.routeSlug}`;
    if (!blogItem?.includes(href)) failures.push(`${localePrefix}rss.xml: ${guid} has the wrong detail link`);
  }
}

if (failures.length) throw new Error(`Broken output links:\n${[...new Set(failures)].join('\n')}`);
console.log(`[output] checked ${htmlFiles.length} HTML file(s)`);
