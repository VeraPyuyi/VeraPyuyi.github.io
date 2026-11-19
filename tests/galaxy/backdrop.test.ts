import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBackdrop } from '../../src/lib/galaxy-flight';

test('the backdrop sky is deterministic and finite', () => {
  const a = buildBackdrop(20_000);
  const b = buildBackdrop(20_000);
  assert.deepEqual(a.color, b.color);
  for (const array of [a.polar, a.color, a.size]) {
    for (const value of array) assert.ok(Number.isFinite(value));
  }
});

test('star brightness follows a power law: many faint stars, few bright ones', () => {
  const sky = buildBackdrop(20_000);
  const brightness = Array.from({ length: sky.count }, (_, index) =>
    Math.max(sky.color[index * 3], sky.color[index * 3 + 1], sky.color[index * 3 + 2]),
  );
  const faint = brightness.filter((value) => value < 0.4).length;
  const bright = brightness.filter((value) => value > 1.5).length;
  assert.ok(faint > sky.count * 0.6, `faint ${faint} of ${sky.count}`);
  assert.ok(bright > 0 && bright < sky.count * 0.03, `bright ${bright} of ${sky.count}`);
});
