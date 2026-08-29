import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

test('the all-posts index is composed only from reusable paper and blog lists', () => {
  const rootPage = read('src/pages/posts.astro');
  const localePage = read('src/pages/[lang]/posts.astro');
  const pageChrome = read('src/components/personal/PageChrome.astro');

  assert.match(rootPage, /<PaperList\b/);
  assert.match(rootPage, /<BlogList\b/);
  assert.match(rootPage, /data-pagefind-ignore="all"/);
  assert.match(rootPage, /showDescription=\{false\}/);
  assert.match(pageChrome, /showDescription\?: boolean/);
  assert.match(pageChrome, /showDescription = true/);
  assert.match(pageChrome, /\{showDescription && <p/);
  assert.doesNotMatch(rootPage, /PostList|getCollection\(['"]blog['"]\)/);
  assert.match(localePage, /<PostsPage locale=\{locale\}/);
});

test('the homepage uses original bilingual feature copy and only overrides the browser title', () => {
  const home = read('src/pages/index.astro');
  const featureHub = read('src/components/personal/FeatureHub.astro');
  const quotes = [
    '证明抵达纸页尽头，求解的人仍独自站在未知之前。',
    '字句一行行亮起，回应它们的始终只有深夜。',
    '照片替世界保存了光，镜头之外却只剩漫长的寂静。',
    '日子从身旁缓慢经过，无人知晓那些未说出口的心事。',
    'The proof reaches the end of the page; the one seeking answers still stands alone before the unknown.',
    'Lines of words light up one by one; only the night ever answers.',
    'Photographs keep the world’s light; beyond the frame, only a long silence remains.',
    'Days pass slowly by; no one knows the thoughts that were never spoken.',
  ];

  for (const quote of quotes) assert.ok(featureHub.includes(quote), quote);
  assert.ok(home.includes("const browserTitle = 'Pyuyi’s Home';"));
  assert.match(home, /title=\{browserTitle\}/);
  assert.match(home, /openGraph=\{\{ title: seoConfig\.title \}\}/);
  assert.match(home, /<Cover slot="cover" \/>/);
});

test('only three papers and one independent blog remain in aggregate content', () => {
  const paperDirectories = readdirSync(join(root, 'src/content/papers'), { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );
  const blogs = readdirSync(join(root, 'src/content/blogs')).filter((name) => /\.mdx?$/.test(name));

  assert.deepEqual(paperDirectories.map((entry) => entry.name).sort(), [
    'bernstein-transfers-greedy-records',
    'cycle-decorated-ribbon-complexes',
    'horizon-uniform-sensitivity',
  ]);
  assert.deepEqual(blogs, ['personal-site.md']);
});

test('legacy sample posts and their CMS collection are removed', () => {
  for (const file of ['welcome.md', 'site-capabilities.md', 'latex-publishing.md', 'watchlist-notes.md']) {
    assert.equal(existsSync(join(root, 'src/content/blog', file)), false);
  }

  const contentConfig = read('src/content.config.ts');
  const pagesCms = read('.pages.yml');
  assert.doesNotMatch(contentConfig, /\bblog\s*:/);
  assert.doesNotMatch(pagesCms, /- name: posts\b/);
  assert.match(pagesCms, /- name: blogs\b/);
});

test('aggregate RSS uses stable paper and blog GUID namespaces without blog dates', () => {
  const rssItems = read('src/lib/rss-items.ts');
  assert.match(rssItems, /paper:\$\{escapeHtml\(paper\.id\)\}/);
  assert.match(rssItems, /blog:\$\{escapeHtml\(entry\.id\)\}/);

  const blogObject = rssItems.slice(rssItems.indexOf('const blogItems'));
  assert.doesNotMatch(blogObject, /pubDate:/);
});
