import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import matter from 'gray-matter';

const root = process.cwd();
const blogRoot = join(root, 'src/content/blogs');

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

test('the Inspirations essays form five complete bilingual pairs', () => {
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
  assert.match(pagesCms, /- name: blogs\b/);
  assert.match(pagesCms, /path: src\/content\/blogs/);
  assert.doesNotMatch(pagesCms, /blogSites|blog-sites|独立博客站点/);
});
