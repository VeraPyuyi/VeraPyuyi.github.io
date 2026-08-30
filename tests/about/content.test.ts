import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const chinese = readFileSync(join(root, 'src/pages/about.md'), 'utf8');
const english = readFileSync(join(root, 'src/pages/_shared/about.en.md'), 'utf8');
const mirror = readFileSync(join(root, 'src/pages/[lang]/about.astro'), 'utf8');

const scholarUrl = 'https://scholar.google.com/citations?user=ld3xCE8AAAAJ&hl=zh-CN&oi=ao';

test('about pages use independent localized introductions', () => {
  assert.match(chinese, /title: "关于 Pyuyi"/);
  assert.match(chinese, /coverTitle: "关于 Pyuyi"/);
  assert.match(chinese, /欢迎来到这里。我是 Pyuyi/);
  assert.match(chinese, /星光并不能替人回答什么，只是让漫长的夜晚不至于完全黑下去。/);
  assert.doesNotMatch(chinese, /### 站点原则|### English/);

  assert.match(english, /title: "About Pyuyi"/);
  assert.match(english, /coverTitle: "About Pyuyi"/);
  assert.match(english, /Welcome\. I’m Pyuyi\./);
  assert.match(english, /Starlight cannot answer our questions/);
  assert.match(mirror, /import AboutEnglishPage from '\.\.\/_shared\/about\.en\.md'/);
  assert.doesNotMatch(mirror, /import AboutPage from '\.\.\/about\.md'/);
});

test('localized contact links remain accurate', () => {
  assert.ok(chinese.includes(scholarUrl));
  assert.ok(english.includes(scholarUrl));
  assert.match(chinese, /\[留言板\]\(\/guestbook\/\)/);
  assert.match(english, /\[guestbook\]\(\/en\/guestbook\/\)/);
});
