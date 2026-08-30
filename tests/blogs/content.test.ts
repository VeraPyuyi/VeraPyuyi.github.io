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

test('the research essays form five complete bilingual pairs', () => {
  const files = readdirSync(blogRoot)
    .filter((name) => /\.(md|mdx)$/.test(name))
    .sort();
  assert.equal(files.length, 10);

  const pairs = new Map<string, Set<string>>();
  for (const filename of files) {
    const source = readFileSync(join(blogRoot, filename), 'utf8');
    const { data, content } = matter(source);

    assert.match(data.routeSlug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(data.translationKey, data.routeSlug);
    assert.ok(['zh', 'en'].includes(data.language));
    assert.equal(data.draft, false);
    assert.equal(data.comments, true);
    assert.equal(data.cover, `/uploads/blogs/${data.routeSlug}/cover.png`);
    assert.ok(typeof data.coverAlt === 'string' && data.coverAlt.trim().length > 0);
    assert.ok(Array.isArray(data.keywords) && data.keywords.length > 0);
    assert.doesNotMatch(content, /cite|chatgpt-content-reference|turn\d+(?:search|view|academia)|\uFFFD/);
    assert.equal(
      [...content].some((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return (codePoint < 32 && codePoint !== 9 && codePoint !== 10) || codePoint === 127;
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
    assert.match(content, data.language === 'zh' ? /^## 参考资料$/m : /^## References$/m);
    assert.ok((content.match(/https:\/\//g) ?? []).length >= 2, `${filename} should cite primary sources`);

    const languages = pairs.get(data.translationKey) ?? new Set<string>();
    languages.add(data.language);
    pairs.set(data.translationKey, languages);
  }

  assert.equal(pairs.size, 5);
  for (const languages of pairs.values()) assert.deepEqual([...languages].sort(), ['en', 'zh']);
});

test('blog publication timestamps match the original conversation creation times', () => {
  const expected = new Map([
    ['monte-carlo-control-natural-starts', '2026-08-30 15:48:15'],
    ['workflow-to-agent-harness', '2026-08-21 01:35:36'],
    ['sgd-zigzag-posets', '2026-08-24 02:37:52'],
    ['llm-sampling-energy-view', '2026-08-26 01:58:33'],
    ['attention-as-spiking-dynamics', '2026-08-28 13:07:34'],
  ]);

  for (const filename of readdirSync(blogRoot).filter((name) => /\.md$/.test(name))) {
    const { data } = matter(readFileSync(join(blogRoot, filename), 'utf8'));
    assert.equal(data.publishedAt, expected.get(data.routeSlug), filename);
  }
});

test('bilingual blog covers are normalized, responsive, and locally documented', async () => {
  const files = readdirSync(blogRoot).filter((name) => /\.(md|mdx)$/.test(name));
  const covers = new Map<string, Set<string>>();
  const manifest = JSON.parse(read('public/media-manifest.json')) as Record<string, string[]>;

  for (const filename of files) {
    const { data } = matter(readFileSync(join(blogRoot, filename), 'utf8'));
    const pairCovers = covers.get(data.translationKey) ?? new Set<string>();
    pairCovers.add(data.cover);
    covers.set(data.translationKey, pairCovers);
  }

  assert.equal(covers.size, 5);
  for (const [slug, pairCovers] of covers) {
    assert.equal(pairCovers.size, 1, `${slug} translations must share one cover`);
    const [cover] = pairCovers;
    assert.ok(cover);
    const source = join(root, 'public', cover.slice(1));
    assert.ok(existsSync(source), cover);
    const metadata = await sharp(source).metadata();
    assert.equal(metadata.width, 1600);
    assert.equal(metadata.height, 900);

    const variants = manifest[cover];
    assert.equal(variants.length, 7);
    for (const variant of variants) assert.ok(existsSync(join(root, 'public', variant.slice(1))), variant);
  }

  const provenance = read('docs/design/blog-cover-art.md');
  assert.match(provenance, /built-in GPT Image/);
  assert.match(provenance, /style reference only/);
  for (const slug of covers.keys()) assert.match(provenance, new RegExp(slug));
});

test('responsive media URLs include a source-content revision to bypass stale cover caches', () => {
  const source = '/uploads/papers/bernstein-transfers-greedy-records/cover.png';
  const sourceBytes = readFileSync(join(root, 'public', source.slice(1)));
  const revision = createHash('sha256').update(sourceBytes).digest('hex').slice(0, 12);
  const media = getResponsiveMedia(source);

  assert.match(media.fallback, new RegExp(`\\?v=${revision}$`));
  assert.match(media.lqip ?? '', new RegExp(`\\?v=${revision}$`));
  for (const srcset of [media.avifSrcset, media.webpSrcset]) {
    assert.ok(srcset);
    assert.equal(srcset.split(', ').length, 3);
    for (const candidate of srcset.split(', ')) assert.match(candidate, new RegExp(`\\?v=${revision} \\d+w$`));
  }
});

test('essay titles use the agreed reflective form in both languages', () => {
  for (const filename of readdirSync(blogRoot).filter((name) => /\.md$/.test(name))) {
    const { data } = matter(readFileSync(join(blogRoot, filename), 'utf8'));
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
  assert.doesNotMatch(listPage, /BlogSiteList|Independent sites|独立站点/);
  assert.match(listPage, /字句一行行亮起，回应它们的始终只有深夜。/);
  assert.match(listPage, /Lines of words light up one by one; only the night ever answers\./);
  assert.match(blogList, /<ResponsiveImage/);
  assert.match(blogList, /aspect-video/);
  assert.match(pagesCms, /- name: blogs\b/);
  assert.match(pagesCms, /path: src\/content\/blogs/);
  assert.doesNotMatch(pagesCms, /blogSites|blog-sites|独立博客站点/);
});
