import assert from 'node:assert/strict';
import test from 'node:test';
import { dayPart, formatUptime, galaxyPoint, moonPhase, placeGalaxyItems } from '../../src/lib/galaxy';

test('galaxy points stay inside the drawing square', () => {
  for (const kind of ['blogs', 'papers', 'photos', 'moments'] as const) {
    for (let arm = 0; arm < 5; arm++) {
      for (let step = 0; step <= 20; step++) {
        const [x, y] = galaxyPoint(kind, arm, step / 20);
        assert.ok(Math.hypot(x, y) <= 1, `${kind} arm ${arm} t ${step / 20}`);
      }
    }
  }
});

test('blog stars ride one arm per category, oldest nearest the core', () => {
  const placed = placeGalaxyItems('blogs', [
    { id: 'c', href: '/c', title: 'C', date: '2026-10-01', group: 'inspirations' },
    { id: 'a', href: '/a', title: 'A', date: '2026-08-01', group: 'inspirations' },
    { id: 'l', href: '/l', title: 'L', date: '2026-11-01', group: 'learning' },
  ]);
  assert.deepEqual(
    placed.map((item) => item.id),
    ['a', 'c', 'l'],
  );
  const distance = (id: string) => {
    const item = placed.find((entry) => entry.id === id);
    assert.ok(item);
    return Math.hypot(item.x - 50, item.y - 50);
  };
  assert.ok(distance('a') < distance('c'));
  assert.equal(
    placed
      .filter((item) => item.newest)
      .map((item) => item.id)
      .join(),
    'l',
  );
  for (const item of placed) {
    assert.ok(item.x >= 0 && item.x <= 100 && item.y >= 0 && item.y <= 100);
  }
});

test('an empty galaxy places nothing', () => {
  assert.deepEqual(placeGalaxyItems('papers', []), []);
});

test('moon phase matches known new and full moons', () => {
  const newMoon = moonPhase(Date.UTC(2026, 0, 18, 19, 52));
  assert.equal(newMoon.index, 0);
  assert.ok(newMoon.illumination < 0.02);
  const fullMoon = moonPhase(Date.UTC(2026, 0, 3, 10, 3));
  assert.equal(fullMoon.index, 4);
  assert.ok(fullMoon.illumination > 0.98);
});

test('day parts and uptime formatting', () => {
  assert.equal(dayPart(6), 'morning');
  assert.equal(dayPart(13), 'afternoon');
  assert.equal(dayPart(20), 'evening');
  assert.equal(dayPart(2), 'night');
  assert.equal(formatUptime(90_061_000, 'zh'), '1 天 01 时 01 分 01 秒');
  assert.equal(formatUptime(90_061_000, 'en'), '1d 01h 01m 01s');
  assert.equal(formatUptime(-5, 'zh'), '0 天 00 时 00 分 00 秒');
});
