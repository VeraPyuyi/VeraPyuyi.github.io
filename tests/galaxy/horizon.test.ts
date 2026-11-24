import assert from 'node:assert/strict';
import test from 'node:test';
import { horizonAlpha, horizonBoost } from '../../src/components/home/galaxy-flight/horizon';

test('the distant hole is faint far away and solid on the last leg', () => {
  assert.ok(horizonAlpha(600) <= 0.25);
  assert.equal(horizonAlpha(150), 1);
  assert.equal(horizonAlpha(0), 1);
});

test('the hole only firms up as the camera closes in', () => {
  let previous = horizonAlpha(700);
  for (let distance = 680; distance >= 0; distance -= 20) {
    const alpha = horizonAlpha(distance);
    assert.ok(alpha >= previous, `alpha drops at ${distance}`);
    previous = alpha;
  }
});

test('the size boost fades to life size up close and is smaller on narrow screens', () => {
  assert.equal(horizonBoost(100, 1440), 1);
  assert.ok(horizonBoost(600, 1440) > horizonBoost(600, 390));
  assert.ok(horizonBoost(600, 390) > 1);
});
