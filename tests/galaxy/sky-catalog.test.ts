import assert from 'node:assert/strict';
import test from 'node:test';
import { ROUTE } from '../../src/lib/galaxy-flight';
import { AU_PER_LIGHT_DAY, lightDays, parseSkyHash, plateLine, SKY_CATALOG, skyHash } from '../../src/lib/sky-catalog';

test('every catalogued object points at a real stop on the homepage route, in order', () => {
  const stops = Object.values(SKY_CATALOG).map((entry) => entry.stop);
  assert.deepEqual(stops, [0, 1, 2, 3, 4]);
  assert.equal(stops.length, ROUTE.length);
});

test('plate lines read like an atlas caption and skip a name that repeats the designation', () => {
  assert.equal(plateLine('blogs', 'zh'), 'M51 · 涡状星系 · 宏象旋涡星系 · 猎犬座 · 约 3100 万光年');
  assert.equal(plateLine('papers', 'zh'), 'NGC 1300 · 棒旋星系 · 波江座 · 约 6100 万光年');
  assert.equal(
    plateLine('hole', 'en'),
    'Sgr A* · Sagittarius A* · supermassive black hole · Sagittarius · ~26,000 light-years',
  );
});

test('homepage deep links round-trip and ignore anything unknown', () => {
  assert.deepEqual(parseSkyHash(skyHash('photos')), { sky: 'photos' });
  assert.deepEqual(parseSkyHash(skyHash('blogs', 'blog-free energy')), { star: 'blog-free energy' });
  assert.deepEqual(parseSkyHash('#sky=andromeda'), {});
  assert.deepEqual(parseSkyHash('#comments'), {});
  assert.deepEqual(parseSkyHash(''), {});
});

test('light-days count whole days since publication and never go negative', () => {
  const published = Date.UTC(2026, 0, 1);
  assert.equal(lightDays(published, published), 0);
  assert.equal(lightDays(published, published + 86_400_000 * 37.9), 37);
  assert.equal(lightDays(new Date(published), published - 1000), 0);
  // One light-day is about 173 times the Earth–Sun distance.
  assert.ok(Math.abs(AU_PER_LIGHT_DAY - (299_792.458 * 86_400) / 149_597_870.7) < 0.01);
});
