import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const chinese = readFileSync(join(root, 'src/pages/about.md'), 'utf8');
const english = readFileSync(join(root, 'src/pages/_shared/about.en.md'), 'utf8');
const mirror = readFileSync(join(root, 'src/pages/[lang]/about.astro'), 'utf8');
const siteConfig = readFileSync(join(root, 'config/site.yaml'), 'utf8');

const scholarUrl = 'https://scholar.google.com/citations?user=ld3xCE8AAAAJ&hl=zh-CN&oi=ao';
const xiaohongshuUrl = 'https://xhslink.cn/m/yYpTrDg2Ku';
const twitterUrls = ['https://x.com/Pyuyi2333', 'https://x.com/Pyuyi233'];

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
  assert.ok(chinese.includes(xiaohongshuUrl));
  assert.ok(english.includes(xiaohongshuUrl));
  assert.ok(siteConfig.includes(xiaohongshuUrl));
  for (const twitterUrl of twitterUrls) {
    assert.ok(chinese.includes(twitterUrl));
    assert.ok(english.includes(twitterUrl));
    assert.ok(siteConfig.includes(twitterUrl));
  }
  assert.match(chinese, /\[GitHub\][^\n]+\n- \[小红书\]/);
  assert.match(english, /\[GitHub\][^\n]+\n- \[Xiaohongshu\]/);
  assert.match(chinese, /\[Twitter @Pyuyi2333\][^\n]+\n- \[Twitter @Pyuyi233\]/);
  assert.match(english, /\[Twitter @Pyuyi2333\][^\n]+\n- \[Twitter @Pyuyi233\]/);
  assert.match(chinese, /\[留言板\]\(\/guestbook\/\)/);
  assert.match(english, /\[Guestbook\]\(\/en\/guestbook\/\)/);
});
