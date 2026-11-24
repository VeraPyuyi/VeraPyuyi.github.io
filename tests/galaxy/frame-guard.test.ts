import assert from 'node:assert/strict';
import test from 'node:test';
import { createFrameGuard } from '../../src/components/home/galaxy-flight/frame-guard';

function guard(maxRatio = 2) {
  const log: string[] = [];
  const g = createFrameGuard({
    maxRatio,
    onRatioChange: () => log.push(`ratio ${g.maxRatio}`),
    onDetailChange: (detail) => log.push(`detail ${detail.toFixed(2)}`),
  });
  const run = (frames: number, dt: number) => {
    for (let i = 0; i < frames; i++) g.tick(dt, true);
  };
  return { g, log, run };
}

test('occasional hitches never lower the resolution', () => {
  const { g, log, run } = guard();
  for (let minute = 0; minute < 10; minute++) {
    run(3000, 1 / 60);
    run(3, 0.25); // a garbage collection or a page swap
  }
  assert.equal(g.maxRatio, 2);
  assert.deepEqual(log, []);
});

test('a slow machine loses particles first, then resolution a quarter step at a time', () => {
  const { g, log, run } = guard();
  run(2000, 1 / 24);
  assert.deepEqual(log.slice(0, 5), ['detail 0.80', 'detail 0.64', 'detail 0.60', 'ratio 1.75', 'ratio 1.5']);
  assert.ok(g.maxRatio >= 1);
});

test('resolution comes back before particles once frames are smooth again', () => {
  const { g, log, run } = guard();
  run(500, 1 / 24);
  const lowered = g.maxRatio;
  assert.ok(lowered < 2);
  log.length = 0;
  run(3000, 1 / 60);
  assert.equal(g.maxRatio, 2);
  assert.match(log[0], /^ratio/);
  assert.equal(g.detail, 1);
});

test('a resolution that proved too much right after returning becomes the ceiling', () => {
  const { g, run } = guard();
  run(380, 1 / 24); // particles down to 0.6, then resolution to 1.75
  run(400, 1 / 60); // smooth: back up to 2
  assert.equal(g.maxRatio, 2);
  run(200, 1 / 24); // too slow at 2 again: down, and 2 is ruled out
  run(5000, 1 / 60);
  assert.equal(g.maxRatio, 1.75);
});

test('nothing changes while inactive', () => {
  const { g, log } = guard();
  for (let i = 0; i < 2000; i++) g.tick(1, false);
  assert.equal(g.maxRatio, 2);
  assert.deepEqual(log, []);
});
