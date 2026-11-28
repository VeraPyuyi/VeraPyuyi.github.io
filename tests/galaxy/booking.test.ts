import assert from 'node:assert/strict';
import test from 'node:test';
import { skyAt, twoSkies, twoSkiesLine } from '../../src/lib/booking';

test('the sky follows the local hour', () => {
  assert.equal(skyAt(3, 'zh'), '已经入夜');
  assert.equal(skyAt(6, 'zh'), '天快亮了');
  assert.equal(skyAt(12, 'zh'), '天还亮着');
  assert.equal(skyAt(18, 'zh'), '正是黄昏');
  assert.equal(skyAt(22, 'zh'), '已经入夜');
  assert.equal(skyAt(12, 'en'), 'the sky is still light');
});

test("the visitor's and the owner's clocks are read in their own timezones", () => {
  const now = new Date('2026-11-28T06:20:00Z');
  const skies = twoSkies(now, 'Europe/London', 'Asia/Taipei', 'zh');
  assert.deepEqual(skies, {
    visitor: { time: '06:20', sky: '天快亮了' },
    owner: { time: '14:20', sky: '天还亮着' },
    same: false,
  });
  assert.equal(twoSkiesLine(skies, 'zh'), '你那里 06:20，天快亮了；我这里 14:20，天还亮着。');
});

test('one sky is said once when the clocks agree', () => {
  const skies = twoSkies(new Date('2026-11-28T14:05:00Z'), 'Asia/Shanghai', 'Asia/Taipei', 'en');
  assert.equal(skies.same, true);
  assert.equal(twoSkiesLine(skies, 'en'), '22:05 here and there — we share one sky; night has fallen.');
});

test('midnight reads 00, not 24', () => {
  const skies = twoSkies(new Date('2026-11-28T16:00:00Z'), 'UTC', 'Asia/Taipei', 'zh');
  assert.equal(skies.owner.time, '00:00');
});
