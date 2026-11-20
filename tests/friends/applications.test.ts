import assert from 'node:assert/strict';
import test from 'node:test';
import { approvedApplications, friendKey, mergeFriends, parseApplication } from '../../src/lib/friends/applications';

// Two real applications from the friends page, as Waline stores them.
const MILES = `site: “Miles’s Digital Garden”
url: “https://imiles.me”
owner: “Miles Ming”
desc: “全栈开发者Miles的数字花园，记录前端工程、系统思考与设计。”
image: “https://imiles.me/images/weblogo.jpeg”
color: “#190609”`;

const VIRGILING = `\`\`\`yml
site: "盗作"
url: "https://virgiling.wiki/"
owner: "virgiling"
desc: "Not all those who wander are lost."
image: "https://cv.virgiling.wiki/bio.png"
color: "#ffc0cb"
\`\`\`

冒昧申请一下友链`;

test('parses applications pasted with curly quotes or inside a code block', () => {
  assert.deepEqual(parseApplication(MILES), {
    site: 'Miles’s Digital Garden',
    url: 'https://imiles.me/',
    owner: 'Miles Ming',
    desc: '全栈开发者Miles的数字花园，记录前端工程、系统思考与设计。',
    image: 'https://imiles.me/images/weblogo.jpeg',
    color: '#190609',
  });
  assert.equal(parseApplication(VIRGILING)?.site, '盗作');
  assert.equal(parseApplication(VIRGILING)?.url, 'https://virgiling.wiki/');
});

test('accepts the page’s own list form, full-width colons and markdown links', () => {
  const entry = parseApplication('- site: 小站 # 站点名称\n  url：[link](https://example.com/blog)\n  owner: 某人');
  assert.equal(entry?.site, '小站');
  assert.equal(entry?.url, 'https://example.com/blog');
  assert.equal(entry?.owner, '某人');
});

test('rejects applications without a site or an http(s) URL', () => {
  assert.equal(parseApplication('hello, nice blog!'), null);
  assert.equal(parseApplication('site: x'), null);
  assert.equal(parseApplication('site: x\nurl: javascript:alert(1)'), null);
  assert.equal(parseApplication('site: x\nurl: not a url'), null);
});

test('drops a bad image and a bad colour instead of using them', () => {
  const entry = parseApplication('site: x\nurl: https://x.dev\nimage: data:image/png;base64,AAAA\ncolor: red');
  assert.equal(entry?.image, '');
  assert.equal(entry?.color, '#ffc0cb');
  assert.equal(entry?.owner, 'x');
});

test('only applications the owner replied to are approved, oldest first, once per site', () => {
  const comments = [
    { orig: MILES, time: 2, children: [{ user_id: 4, orig: '通过' }] },
    { orig: VIRGILING, time: 1, children: [{ user_id: 4, orig: '欢迎！' }] },
    { orig: 'site: spam\nurl: https://spam.example', time: 3, children: [{ user_id: 9, orig: 'me too' }] },
    { orig: 'site: waiting\nurl: https://waiting.example', time: 4, children: [] },
    { orig: 'site: again\nurl: https://www.imiles.me/', time: 5, children: [{ user_id: '4' }] },
  ];
  assert.deepEqual(
    approvedApplications(comments, [4]).map((entry) => entry.site),
    ['盗作', 'Miles’s Digital Garden'],
  );
  assert.deepEqual(approvedApplications(comments, []), []);
});

test('reads rendered HTML when the original text is missing', () => {
  const html = '<p>site: “HTML”<br>\nurl: “<a href="https://html.example">https://html.example</a>”</p>';
  assert.equal(approvedApplications([{ comment: html, children: [{ user_id: 4 }] }], [4])[0]?.url, 'https://html.example/');
});

test('approved applications never duplicate a configured friend', () => {
  const configured = [{ url: 'https://virgiling.wiki/' }];
  const merged = mergeFriends(configured, [{ url: 'https://www.virgiling.wiki' }, { url: 'https://imiles.me' }]);
  assert.deepEqual(
    merged.map((friend) => friend.url),
    ['https://virgiling.wiki/', 'https://imiles.me'],
  );
  assert.equal(friendKey('https://WWW.Example.com/blog/'), 'example.com/blog');
});
