import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const source = readFileSync(join(process.cwd(), 'src/components/personal/PageViews.astro'), 'utf8');

test('the public counter starts at the analytics launch date and documents its cache delay', () => {
  assert.match(source, /const statsStart = '2026-08-31'/);
  assert.match(source, /\?start=\$\{encodeURIComponent\(start\)\}/);
  assert.match(source, /最多可能延迟四小时/);
  assert.match(source, /may be delayed by up to four hours/);
});

test('an unseen GoatCounter path renders the returned zero instead of a broken placeholder', () => {
  assert.match(source, /response\.status !== 404/);
  assert.match(source, /data\.count \?\? data\.count_unique/);
});
