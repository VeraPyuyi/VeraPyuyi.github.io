import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import matter from 'gray-matter';
import sharp from 'sharp';
import { getResponsiveMedia } from '../../src/lib/media';

const root = process.cwd();
const blogRoot = join(root, 'src/content/blogs');

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

/**
 * The essays published before online editing (Pages CMS) was set up, with the times they were first
 * published. They are held to the full editorial checks below; posts added later through the CMS
 * only need to be well formed, so writing a new post online cannot fail the build over house style.
 */
const ESTABLISHED = new Map([
  ['monte-carlo-control-natural-starts', '2026-08-30 15:48:15'],
  ['workflow-to-agent-harness', '2026-08-21 01:35:36'],
  ['sgd-zigzag-posets', '2026-08-24 02:37:52'],
  ['llm-sampling-energy-view', '2026-08-26 01:58:33'],
  ['attention-as-spiking-dynamics', '2026-08-28 13:07:34'],
  ['irrational-encoding-agent-memory', '2026-10-29T18:18:30Z'],
  ['agent-layered-memory', '2026-10-22T10:36:51Z'],
  ['agent-memory-security', '2026-10-22T10:36:51Z'],
  ['raptor-graphrag-hierarchy', '2026-10-10T12:54:35Z'],
  ['potential-functions-latent-topology', '2026-08-31T14:04:43Z'],
  ['multi-agent-cooperation', '2026-11-13T09:26:28Z'],
  ['physics-of-deep-learning-free-energy', '2026-11-18'],
]);
const LEARNING = new Set(['multi-agent-cooperation', 'physics-of-deep-learning-free-energy']);

/** Offset of the site timezone (config/site.yaml: Asia/Shanghai, which has no daylight saving). */
const SITE_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * The instant a frontmatter date stands for, read the way the content schema reads it: text without
 * an offset is site time, and a YAML date (which the parser takes as UTC) is site wall-clock time too.
 * So the same moment compares equal however an editor happened to write it.
 */
function siteInstant(value: unknown): number {
  if (value instanceof Date) return value.getTime() - SITE_OFFSET_MS;
  assert.equal(typeof value, 'string', `not a date: ${String(value)}`);
  const text = String(value).trim();
  if (/(?:Z|[+-]\d\d:?\d\d)$/.test(text)) return Date.parse(text);
  const match = text.match(/^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d)(?::(\d\d))?)?$/);
  assert.ok(match, `unreadable date: ${text}`);
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
  return Date.UTC(+year, +month - 1, +day, +hour, +minute, +second) - SITE_OFFSET_MS;
}

function blogs() {
  return readdirSync(blogRoot)
    .filter((name) => /\.(md|mdx)$/.test(name))
    .sort()
    .map((filename) => ({ filename, ...matter(readFileSync(join(blogRoot, filename), 'utf8')) }));
}

test('the site timezone the date checks assume is still the configured one', () => {
  assert.match(read('config/site.yaml'), /timezone: Asia\/Shanghai\b/);
});

test('every blog post is well formed, whether written locally or online', () => {
  for (const { filename, data, content } of blogs()) {
    assert.match(data.routeSlug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, filename);
    assert.equal(data.translationKey, data.routeSlug, filename);
    assert.ok(['zh', 'en'].includes(data.language), filename);
    assert.ok(Number.isFinite(siteInstant(data.publishedAt)), filename);
    if (!data.draft) {
      assert.ok(typeof data.cover === 'string' && existsSync(join(root, 'public', data.cover.slice(1))), `${filename} cover`);
      assert.ok(typeof data.coverAlt === 'string' && data.coverAlt.trim().length > 0, `${filename} coverAlt`);
    }
    assert.equal(
      [...content].some((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return (codePoint < 32 && codePoint !== 9 && codePoint !== 10 && codePoint !== 13) || codePoint === 127;
      }),
      false,
      `${filename} contains an unexpected control character`,
    );
    const mathSegments = [...content.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g)].map((match) => match[1] ?? match[2]);
    for (const segment of mathSegments) {
      assert.doesNotMatch(
        segment,
        /(?<!\\)\b(?:epsilon|rho|mu|ldots|qquad|quad)\b/,
        `${filename} contains a likely LaTeX command whose backslash was lost`,
      );
    }
    assert.doesNotMatch(content, /^#\s/m, `${filename} must not repeat the page title as an H1`);
  }
});

test('translations of one post share its publication time and cover', () => {
  const byKey = new Map<string, Array<Record<string, unknown>>>();
  for (const { data } of blogs()) byKey.set(data.translationKey, [...(byKey.get(data.translationKey) ?? []), data]);
  for (const [key, versions] of byKey) {
    assert.ok(versions.length <= 2, `${key} has more than two versions`);
    assert.equal(new Set(versions.map((version) => version.language)).size, versions.length, `${key} repeats a language`);
    if (versions.length < 2) continue;
    const [first, second] = versions;
    assert.equal(siteInstant(first.publishedAt), siteInstant(second.publishedAt), `${key} publishedAt`);
    assert.equal(first.cover, second.cover, `${key} cover`);
  }
});

test('the established essays keep their bilingual pairs, house style and sources', () => {
  const pairs = new Map<string, Set<string>>();
  for (const { filename, data, content } of blogs()) {
    if (!ESTABLISHED.has(data.routeSlug)) continue;
    assert.equal(data.category, LEARNING.has(data.routeSlug) ? 'learning' : 'inspirations', filename);
    assert.equal(data.draft, false, filename);
    assert.equal(data.comments, true, filename);
    assert.equal(data.cover, `/uploads/blogs/${data.routeSlug}/cover.png`, filename);
    assert.ok(Array.isArray(data.keywords) && data.keywords.length > 0, filename);
    assert.doesNotMatch(
      content,
      /(?:cite|filecite)|chatgpt-content-reference|turn\d+(?:search|view|academia)|sandbox:\/|chatgpt\.com\/(?:c|g)\/|\uFFFD/,
    );
    assert.match(content, data.language === 'zh' ? /^## 参考资料$/m : /^## References$/m);
    assert.ok((content.match(/https:\/\//g) ?? []).length >= 2, `${filename} should cite primary sources`);
    pairs.set(data.routeSlug, (pairs.get(data.routeSlug) ?? new Set<string>()).add(data.language));
  }

  assert.deepEqual([...pairs.keys()].sort(), [...ESTABLISHED.keys()].sort());
  for (const languages of pairs.values()) assert.deepEqual([...languages].sort(), ['en', 'zh']);
});

test('the established essays keep their original publication times', () => {
  for (const { filename, data } of blogs()) {
    const expected = ESTABLISHED.get(data.routeSlug);
    if (expected) assert.equal(siteInstant(data.publishedAt), siteInstant(expected), filename);
  }
});

test("the established essays' covers retain full-size widescreen sources and documented responsive resources", async () => {
  const covers = new Map<string, Set<string>>();
  const manifest = JSON.parse(read('public/media-manifest.json')) as Record<string, string[]>;

  for (const { data } of blogs()) {
    if (!ESTABLISHED.has(data.routeSlug)) continue;
    const pairCovers = covers.get(data.translationKey) ?? new Set<string>();
    pairCovers.add(data.cover);
    covers.set(data.translationKey, pairCovers);
  }

  assert.equal(covers.size, ESTABLISHED.size);
  for (const [slug, pairCovers] of covers) {
    assert.equal(pairCovers.size, 1, `${slug} translations must share one cover`);
    const [cover] = pairCovers;
    assert.ok(cover);
    const source = join(root, 'public', cover.slice(1));
    assert.ok(existsSync(source), cover);
    const metadata = await sharp(source).metadata();
    assert.ok(metadata.width && metadata.width >= 1600, `${slug} must retain a full-size source`);
    assert.ok(metadata.height && Math.abs(metadata.width / metadata.height - 16 / 9) < 0.005, `${slug} must be 16:9`);

    const variants = manifest[cover];
    assert.equal(variants.length, 7);
    for (const variant of variants) assert.ok(existsSync(join(root, 'public', variant.slice(1))), variant);
  }

  const provenance = read('docs/design/blog-cover-art.md');
  assert.match(provenance, /built-in GPT Image/);
  assert.match(provenance, /style reference only/);
  for (const slug of covers.keys()) assert.match(provenance, new RegExp(slug));
});

test('the selected articles preserve equivalent mathematics across their translations', () => {
  const selected = [
    'irrational-encoding-agent-memory',
    'agent-layered-memory',
    'agent-memory-security',
    'raptor-graphrag-hierarchy',
    'potential-functions-latent-topology',
    'multi-agent-cooperation',
    'physics-of-deep-learning-free-energy',
  ];
  const formulas = (source: string) =>
    [...source.matchAll(/\$\$([\s\S]*?)\$\$|\$([^$\n]+)\$/g)].map((match) =>
      (match[1] ?? match[2])
        .replaceAll('\\text{猎鹿}', '\\text{hunt stag}')
        .replaceAll('\\text{猎兔}', '\\text{hunt hare}')
        .replace(/\s+/g, ''),
    );

  for (const slug of selected) {
    const zh = matter(read(`src/content/blogs/${slug}-zh.md`));
    const en = matter(read(`src/content/blogs/${slug}-en.md`));
    assert.deepEqual(formulas(en.content), formulas(zh.content), `${slug} translations changed the mathematics`);
    assert.equal(siteInstant(en.data.publishedAt), siteInstant(zh.data.publishedAt));
    assert.equal(
      en.data.updatedAt === undefined ? undefined : siteInstant(en.data.updatedAt),
      zh.data.updatedAt === undefined ? undefined : siteInstant(zh.data.updatedAt),
    );
    assert.equal(en.data.cover, zh.data.cover);
    assert.ok(zh.content.length > 1000 && en.content.length > 1000, `${slug} must contain complete essays`);
  }
});

test('responsive media URLs include generated bytes in their cache revision', () => {
  const source = '/uploads/papers/bernstein-transfers-greedy-records/cover.png';
  const sourceBytes = readFileSync(join(root, 'public', source.slice(1)));
  const manifest = JSON.parse(read('public/media-manifest.json')) as Record<string, string[]>;
  const revisionHash = createHash('sha256').update(sourceBytes);
  for (const variant of manifest[source]) {
    revisionHash.update(variant).update(readFileSync(join(root, 'public', variant.slice(1))));
  }
  const revision = revisionHash.digest('hex').slice(0, 12);
  const media = getResponsiveMedia(source);

  assert.match(media.fallback, new RegExp(`\\?v=${revision}$`));
  assert.equal(media.avifSrcset, undefined);
  assert.equal(media.lqip, undefined);
  assert.ok(media.webpSrcset);
  assert.equal(media.webpSrcset.split(', ').length, 5);
  for (const candidate of media.webpSrcset.split(', ')) {
    assert.match(candidate, new RegExp(`\\?v=${revision} \\d+w$`));
  }
});

test('the established Inspirations titles use the agreed reflective form in both languages', () => {
  for (const { data } of blogs()) {
    if (!ESTABLISHED.has(data.routeSlug) || data.category !== 'inspirations') continue;
    if (data.language === 'zh') assert.match(data.title, /^关于.+的一些想法$/);
    else assert.match(data.title, /^Some Thoughts on /);
  }
});

test('blog routes, shared comments, indexing, and CMS collections are wired explicitly', () => {
  const routeRegistry = read('src/pages/_shared/routes.ts');
  const rootPage = read('src/pages/blogs/[slug].astro');
  const localePage = read('src/pages/[lang]/blogs/[slug].astro');
  const listPage = read('src/pages/blogs.astro');
  const pagesCms = read('.pages.yml');
  const blogList = read('src/components/personal/BlogList.astro');

  assert.match(routeRegistry, /export const blogRoute/);
  assert.match(rootPage, /getStaticPaths = blogRoute\.root/);
  assert.match(localePage, /getStaticPaths = blogRoute\.mirror/);
  assert.match(rootPage, /contentId=\{`blog:\$\{entry\.data\.translationKey\}`\}/);
  assert.match(rootPage, /data-pagefind-body/);
  assert.match(rootPage, /mathStyles/);
  assert.match(listPage, /<BlogList locale=\{locale\} indexable=\{false\}/);
  assert.match(listPage, /BLOG_CATEGORIES/);
  assert.match(listPage, /id=\{category\}/);
  assert.match(listPage, /category=\{category\}/);
  assert.doesNotMatch(listPage, /BlogSiteList|Independent sites|独立站点/);
  assert.match(listPage, /字句一行行亮起，回应它们的始终只有深夜。/);
  assert.match(listPage, /Lines of words light up one by one; only the night ever answers\./);
  assert.match(blogList, /<ResponsiveImage/);
  assert.match(blogList, /aspect-video/);
  assert.match(blogList, /getBlogCategoryLabel/);
  assert.match(rootPage, /data-pagefind-meta="category"/);
  assert.match(pagesCms, /- name: blogs\b/);
  assert.match(pagesCms, /path: src\/content\/blogs/);
  assert.match(pagesCms, /name: category, label: 博客分类/);
  assert.match(pagesCms, /values: \[inspirations, learning\]/);
  assert.doesNotMatch(pagesCms, /blogSites|blog-sites|独立博客站点/);
});

test('blog categories are explicit across content, lists, details, and RSS', () => {
  const contentConfig = read('src/content.config.ts');
  const blogLibrary = read('src/lib/blogs.ts');
  const listPage = read('src/pages/blogs.astro');
  const rootPage = read('src/pages/blogs/[slug].astro');
  const rssItems = read('src/lib/rss-items.ts');

  assert.match(contentConfig, /category: z\.enum\(\['inspirations', 'learning'\]\)/);
  assert.match(blogLibrary, /BLOG_CATEGORIES[^=]*= \['inspirations', 'learning'\]/);
  assert.match(blogLibrary, /data\.category === category/);
  assert.match(listPage, /getBlogCategoryDescription/);
  assert.match(rootPage, /#\$\{entry\.data\.category\}/);
  assert.match(rssItems, /<category>\$\{getBlogCategoryLabel\(entry\.data\.category\)\}<\/category>/);
});
