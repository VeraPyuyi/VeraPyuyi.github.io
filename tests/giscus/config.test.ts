import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { resolveGiscusTarget } from '../../src/components/comment/providers/giscusTarget';
import type { GiscusConfig } from '../../src/lib/config/types';

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

const baseConfig: GiscusConfig = {
  repo: 'VeraPyuyi/VeraPyuyi.github.io',
  repoId: 'R_kgDOUE5Tuw',
  category: 'Announcements',
  categoryId: 'DIC_kwDOUE5Tu84DEdNf',
  mapping: 'specific',
};

test('Giscus remains a valid fallback while Waline is active', () => {
  const config = parse(read('config/site.yaml')).comment;

  assert.equal(config.provider, 'waline');
  assert.equal(config.giscus.repo, baseConfig.repo);
  assert.equal(config.giscus.repoId, baseConfig.repoId);
  assert.equal(config.giscus.category, baseConfig.category);
  assert.equal(config.giscus.categoryId, baseConfig.categoryId);
  assert.equal(config.giscus.mapping, 'specific');
  assert.equal(config.giscus.strict, '1');
});

test('Giscus only accepts the production site and local preview origins', () => {
  const access = JSON.parse(read('giscus.json'));
  const localOrigin = new RegExp(access.originsRegex[0]);

  assert.deepEqual(access.origins, ['https://verapyuyi.github.io']);
  assert.equal(localOrigin.test('http://localhost:4321'), true);
  assert.equal(localOrigin.test('http://127.0.0.1:4321'), true);
  assert.equal(localOrigin.test('https://example.com'), false);
});

test('stable content IDs use specific mapping and an empty ID safely falls back', () => {
  assert.deepEqual(resolveGiscusTarget(baseConfig, 'paper:example'), {
    mapping: 'specific',
    term: 'paper:example',
  });
  assert.deepEqual(resolveGiscusTarget(baseConfig), { mapping: 'pathname' });
  assert.deepEqual(resolveGiscusTarget({ ...baseConfig, term: 'site-wide' }), {
    mapping: 'specific',
    term: 'site-wide',
  });
});

test('every enabled comment surface declares a stable content ID', () => {
  assert.match(read('src/pages/guestbook.astro'), /<Comment contentId="guestbook"/);
  assert.match(read('src/pages/papers/[slug].astro'), /contentId=\{`paper:\$\{paper\.id\}`\}/);
  assert.match(read('src/pages/friends.astro'), /<Comment contentId="page:friends"/);
  assert.match(read('src/pages/bangumi.astro'), /<Comment contentId="page:bangumi"/);
  assert.match(read('src/pages/music.md'), /commentId: "page:music"/);
  assert.match(read('src/layouts/PageLayout.astro'), /<Comment contentId=\{frontmatter\.commentId\}/);
});
