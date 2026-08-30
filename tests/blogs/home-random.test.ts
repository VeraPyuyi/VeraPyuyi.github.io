import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { sampleWithoutReplacement } from '../../src/lib/utils';

const root = process.cwd();

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8');
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test('homepage sampling is unique, bounded, and does not mutate its candidates', () => {
  const candidates = ['a', 'b', 'c', 'd', 'e'];
  const original = [...candidates];
  const selected = sampleWithoutReplacement(candidates, 2, seededRandom(42));

  assert.equal(selected.length, 2);
  assert.equal(new Set(selected).size, 2);
  assert.ok(selected.every((item) => candidates.includes(item)));
  assert.deepEqual(candidates, original);
  assert.deepEqual(sampleWithoutReplacement(candidates, 99, seededRandom(1)).sort(), [...candidates].sort());
  assert.deepEqual(sampleWithoutReplacement(candidates, -1, seededRandom(1)), []);
});

test('every candidate can be reached across deterministic homepage draws', () => {
  const candidates = ['a', 'b', 'c', 'd', 'e'];
  const seen = new Set<string>();
  for (const value of [0, 0.2, 0.25, 0.4, 0.6, 0.8, 0.999_999]) {
    for (const item of sampleWithoutReplacement(candidates, 2, () => value)) seen.add(item);
  }
  assert.deepEqual([...seen].sort(), candidates);
});

test('only the homepage enables two-item random paper and blog pools', () => {
  const home = read('src/pages/index.astro');
  const paperList = read('src/components/personal/PaperList.astro');
  const blogList = read('src/components/personal/BlogList.astro');
  const randomizer = read('src/components/personal/HomeRandomizer.astro');
  const papersPage = read('src/pages/papers/index.astro');
  const blogsPage = read('src/pages/blogs.astro');

  assert.match(home, /<PaperList locale=\{locale\} limit=\{2\} indexable=\{false\} randomized \/>/);
  assert.match(home, /<BlogList locale=\{locale\} limit=\{2\} indexable=\{false\} randomized \/>/);
  assert.match(paperList, /data-home-random-pool=\{randomized \? 'papers'/);
  assert.match(blogList, /data-home-random-pool=\{randomized \? 'blogs'/);
  assert.match(randomizer, /sampleWithoutReplacement/);
  assert.match(randomizer, /astro:page-load/);
  assert.match(randomizer, /event\.persisted/);
  assert.match(randomizer, /item\.hidden = true/);
  assert.doesNotMatch(papersPage, /randomized/);
  assert.doesNotMatch(blogsPage, /randomized/);
});
