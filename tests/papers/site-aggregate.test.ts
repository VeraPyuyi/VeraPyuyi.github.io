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

  assert.match(rootPage, /<PaperList\b/);
  assert.match(rootPage, /<BlogList\b/);
  assert.match(rootPage, /data-pagefind-ignore="all"/);
  assert.doesNotMatch(rootPage, /PostList|getCollection\(['"]blog['"]\)/);
  assert.match(localePage, /<PostsPage locale=\{locale\}/);
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
