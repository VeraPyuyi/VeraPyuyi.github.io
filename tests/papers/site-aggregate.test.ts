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
  const skyPage = read('src/components/sky/SkyPage.astro');

  assert.match(rootPage, /<PaperList\b/);
  assert.match(rootPage, /<BlogList\b/);
  assert.match(rootPage, /data-pagefind-ignore="all"/);
  assert.match(rootPage, /showDescription=\{false\}/);
  assert.match(pageChrome, /showDescription\?: boolean/);
  assert.match(pageChrome, /showDescription = true/);
  assert.match(skyPage, /description=\{showDescription \? description : undefined\}/);
  assert.doesNotMatch(rootPage, /PostList|getCollection\(['"]blog['"]\)/);
  assert.match(localePage, /<PostsPage locale=\{locale\}/);
});

test('the homepage uses original bilingual feature copy and only overrides the browser title', () => {
  const home = read('src/pages/index.astro');
  const galaxyFlight = read('src/components/home/GalaxyFlight.astro');
  const quotes = [
    '那根笔直的棒并不是实心的，而是无数恒星一遍遍走过同一条路。证明也是这样走出来的。',
    'M51 的旋臂，是被身旁的伴星系一路牵出来的。我写下的每篇文字旁边，也有一个伴星——那个让我动笔的问题。',
    '照片记下的从来不是那一刻，而是那一刻刚好抵达镜头的光。',
    '小麦哲伦云绕着银河走，身后拖着一条长长的气流。日子也会掉下些细碎的东西，我把它们捡起来。',
    'The straight bar is not solid: it is countless stars taking the same path, again and again. A proof is walked into being the same way.',
    'M51’s arms were drawn out by the companion galaxy beside it. Everything I write has a companion too: the question that made me start.',
    'A photograph never records the moment itself, only the light that happened to arrive at that moment.',
    'Circling the Milky Way, the Small Magellanic Cloud trails a long stream of gas behind it. Days shed small things too; I pick them up.',
  ];

  for (const quote of quotes) assert.ok(galaxyFlight.includes(quote), quote);
  assert.match(home, /<GalaxyFlight locale=\{locale\} \/>/);
  assert.ok(home.includes("const browserTitle = 'Pyuyi’s Home';"));
  assert.match(home, /title=\{browserTitle\}/);
  assert.match(home, /openGraph=\{\{\s*title: seoConfig\.title,\s*image: siteConfig\.homeOgImage,/);
});

test('aggregate content contains three papers and twelve bilingual blog articles', () => {
  const paperDirectories = readdirSync(join(root, 'src/content/papers'), { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  );
  const blogs = readdirSync(join(root, 'src/content/blogs'))
    .filter((name) => /\.mdx?$/.test(name))
    .sort();
  assert.deepEqual(paperDirectories.map((entry) => entry.name).sort(), [
    'bernstein-transfers-greedy-records',
    'cycle-decorated-ribbon-complexes',
    'horizon-uniform-sensitivity',
  ]);
  assert.deepEqual(blogs, [
    'agent-layered-memory-en.md',
    'agent-layered-memory-zh.md',
    'agent-memory-security-en.md',
    'agent-memory-security-zh.md',
    'attention-as-spiking-dynamics-en.md',
    'attention-as-spiking-dynamics-zh.md',
    'irrational-encoding-agent-memory-en.md',
    'irrational-encoding-agent-memory-zh.md',
    'llm-sampling-energy-view-en.md',
    'llm-sampling-energy-view-zh.md',
    'monte-carlo-control-natural-starts-en.md',
    'monte-carlo-control-natural-starts-zh.md',
    'multi-agent-cooperation-en.md',
    'multi-agent-cooperation-zh.md',
    'physics-of-deep-learning-free-energy-en.md',
    'physics-of-deep-learning-free-energy-zh.md',
    'potential-functions-latent-topology-en.md',
    'potential-functions-latent-topology-zh.md',
    'raptor-graphrag-hierarchy-en.md',
    'raptor-graphrag-hierarchy-zh.md',
    'sgd-zigzag-posets-en.md',
    'sgd-zigzag-posets-zh.md',
    'workflow-to-agent-harness-en.md',
    'workflow-to-agent-harness-zh.md',
  ]);
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
  assert.doesNotMatch(pagesCms, /- name: blogSites\b/);
});

test('aggregate RSS uses stable paper and translated-blog GUID namespaces with publication dates', () => {
  const rssItems = read('src/lib/rss-items.ts');
  assert.match(rssItems, /paper:\$\{escapeHtml\(paper\.id\)\}/);
  assert.match(rssItems, /blog:\$\{escapeHtml\(entry\.data\.translationKey\)\}/);

  const blogObject = rssItems.slice(rssItems.indexOf('const blogItems'));
  assert.match(blogObject, /pubDate: entry\.data\.publishedAt/);
  assert.match(blogObject, /`\/blogs\/\$\{entry\.data\.routeSlug\}`/);
});
