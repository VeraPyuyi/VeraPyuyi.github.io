import assert from 'node:assert/strict';
import test from 'node:test';
import { NOVA_FLOOR, NOVA_SLOTS, novaGlow, TELEGRAMS_SHOWN, toTelegrams } from '../../src/lib/news';

const day = 24 * 60 * 60 * 1000;
const at = (text: string) => new Date(`${text}T12:00:00+08:00`);

test('telegrams are numbered from the oldest news and listed newest first', () => {
  const telegrams = toTelegrams(
    [
      { id: 'b', date: at('2026-11-20'), text: '第二条' },
      { id: 'a', date: at('2026-10-01'), text: '第一条' },
      { id: 'd', date: at('2026-11-25'), text: '草稿', draft: true },
      { id: 'c', date: at('2026-11-27'), text: '第三条', textEn: 'Third', href: 'https://example.org/x' },
    ],
    'zh',
  );
  assert.deepEqual(
    telegrams.map((telegram) => [telegram.number, telegram.text, telegram.starId]),
    [
      [3, '第三条', 'news-3'],
      [2, '第二条', 'news-2'],
      [1, '第一条', 'news-1'],
    ],
  );
  assert.equal(telegrams[0].external, true);
  assert.equal(telegrams[1].href, undefined);
});

test('English telegrams fall back to the Chinese text', () => {
  const [withEnglish, without] = toTelegrams(
    [
      { id: 'a', date: at('2026-10-01'), text: '只有中文', textEn: '  ' },
      { id: 'b', date: at('2026-10-02'), text: '中文', textEn: 'English' },
    ],
    'en',
  );
  assert.equal(withEnglish.text, 'English');
  assert.equal(without.text, '只有中文');
});

test('a site link is not external', () => {
  const [telegram] = toTelegrams([{ id: 'a', date: at('2026-10-01'), text: 'x', href: '/papers/x' }], 'zh');
  assert.equal(telegram.external, false);
});

test('a nova is brightest when the news is fresh and fades back to an ordinary star', () => {
  const posted = at('2026-11-01').getTime();
  assert.equal(novaGlow(posted, posted), 1);
  assert.equal(novaGlow(posted, posted - day), 1);
  assert.ok(Math.abs(novaGlow(posted, posted + 10 * day) - 0.5) < 1e-9);
  assert.equal(novaGlow(posted, posted + 60 * day), NOVA_FLOOR);
  let previous = 1;
  for (let days = 1; days < 90; days += 1) {
    const glow = novaGlow(posted, posted + days * day);
    assert.ok(glow <= previous);
    previous = glow;
  }
});

test('there is a place in the sky for every nova shown, inside the opening view', () => {
  assert.ok(NOVA_SLOTS.length >= TELEGRAMS_SHOWN);
  for (const [x, y] of NOVA_SLOTS) {
    assert.ok(Math.abs(x) < 0.95 && Math.abs(y) < 0.95);
  }
});
