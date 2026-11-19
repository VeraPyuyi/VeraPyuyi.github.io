import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { hashUnit, MEGA_CATALOG } from '../../src/lib/megastructures';
import { SKY_CATALOG } from '../../src/lib/sky-catalog';

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('every megastructure is named and captioned in both languages and stands in a real part of the sky', () => {
  const kinds = Object.keys(MEGA_CATALOG);
  assert.deepEqual(kinds.sort(), ['assembly', 'decompressor', 'dyson', 'gateway', 'habitat', 'nexus', 'ringworld', 'sentry']);
  for (const [kind, entry] of Object.entries(MEGA_CATALOG)) {
    for (const text of [entry.name.zh, entry.name.en, entry.line.zh, entry.line.en]) assert.ok(text.trim(), kind);
    assert.ok(entry.sky in SKY_CATALOG, kind);
  }
});

test('hashUnit is stable and stays inside [0, 1)', () => {
  assert.equal(hashUnit('Pyuyi'), hashUnit('Pyuyi'));
  assert.notEqual(hashUnit('a'), hashUnit('b'));
  for (const value of ['', 'x', '戴森球', 'https://example.com/', 'a'.repeat(500)]) {
    const unit = hashUnit(value);
    assert.ok(unit >= 0 && unit < 1, value);
  }
});

test('each section page raises its own megastructure', () => {
  const expected: Record<string, string> = {
    'src/pages/posts.astro': 'mega="sentry"',
    'src/pages/papers/index.astro': 'mega="nexus"',
    'src/pages/blogs.astro': 'mega="dyson"',
    'src/pages/gallery.astro': 'mega="ringworld"',
    'src/pages/moments.astro': 'mega="habitat"',
    'src/pages/guestbook.astro': 'mega="assembly"',
    'src/pages/friends.astro': 'kind="gateway"',
    'src/pages/about.md': 'mega: decompressor',
    'src/pages/_shared/about.en.md': 'mega: decompressor',
  };
  for (const [path, marker] of Object.entries(expected)) assert.ok(read(path).includes(marker), path);
  const scenes = read('src/components/mega/scenes.ts');
  for (const kind of Object.keys(MEGA_CATALOG)) assert.match(scenes, new RegExp(`^  ${kind},$`, 'm'), kind);
});
