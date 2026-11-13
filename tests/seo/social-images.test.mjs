import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import sharp from 'sharp';
import { buildSocialImages } from '../../scripts/build-social-images.mjs';
import { getSocialImage } from '../../src/lib/seo/social-image.ts';

const site = new URL('https://example.com');
const checker = fileURLToPath(new URL('../../scripts/check-social-cards.py', import.meta.url));
const escape = (value) => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');

function htmlFor(page, manifest) {
  const image = getSocialImage(page.image, site, manifest);
  const url = new URL(page.path, site).href;
  const fields = {
    'og:title': page.title,
    'og:type': 'article',
    'og:url': url,
    'og:description': page.description,
    'og:image': image.url,
    'og:image:secure_url': image.url,
    'og:image:alt': page.alt,
    'og:image:width': image.width,
    'og:image:height': image.height,
    'og:image:type': image.type,
    'twitter:card': 'summary_large_image',
    'twitter:title': page.title,
    'twitter:description': page.description,
    'twitter:image': image.url,
    'twitter:image:alt': page.alt,
  };
  return `<html><head><link rel="canonical" href="${url}">${Object.entries(fields)
    .map(([key, value]) => `<meta ${key.startsWith('og:') ? 'property' : 'name'}="${key}" content="${escape(value)}">`)
    .join('')}</head><body>Article</body></html>`;
}

function validate(directory) {
  return spawnSync('python3', [checker, '--dist', directory], { encoding: 'utf8' });
}

test('social image pipeline and static-card regression checks', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'social-card-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const source = '/uploads/blogs/example/cover.png';
  const file = join(directory, source);
  mkdirSync(dirname(file), { recursive: true });
  const original = await sharp({ create: { width: 400, height: 800, channels: 4, background: '#4466aa80' } })
    .png().toBuffer();
  writeFileSync(file, original);
  const pages = ['', '/en'].map((prefix) => ({
    path: `${prefix}/blogs/example/`, title: `${prefix ? 'Example' : '示例'} "A & B"`,
    description: 'A < B & a "quote"', image: source, alt: 'Full original cover',
  }));
  const manifest = await buildSocialImages({ publicRoot: directory, site: site.href, sources: [source, source], pages });
  const image = manifest.images[source];

  await t.test('unique source is optimized once; original bytes remain unchanged', () => {
    assert.equal(Object.keys(manifest.images).length, 1);
    assert.deepEqual(readFileSync(file), original);
  });
  await t.test('JPEG has exact landscape dimensions, no alpha/EXIF, and a small payload', async () => {
    const data = readFileSync(join(directory, image.src));
    const metadata = await sharp(data).metadata();
    assert.equal(metadata.format, 'jpeg');
    assert.deepEqual([metadata.width, metadata.height], [1200, 630]);
    assert.equal(metadata.hasAlpha, false);
    assert.equal(metadata.exif, undefined);
    assert.ok(data.length < 1_000_000);
    assert.equal(image.bytes, data.length);
  });
  await t.test('relative and same-origin absolute covers resolve to the same versioned JPEG', () => {
    const a = getSocialImage(source, site, manifest);
    const b = getSocialImage(new URL(source, site).href, site, manifest);
    assert.deepEqual(a, b);
    assert.match(a.url, /^https:\/\/example\.com\/social\/cover-[a-f0-9]{20}\.jpg$/);
  });
  await t.test('external images and query strings are not replaced', () => {
    const url = `https://cdn.example.net${source}?version=2`;
    assert.deepEqual(getSocialImage(url, site, manifest), { url });
  });
  await t.test('development fallback and invalid schemes are handled safely', () => {
    assert.deepEqual(getSocialImage(source, site, { images: {} }), { url: new URL(source, site).href });
    assert.equal(getSocialImage(undefined, site, manifest), undefined);
    assert.equal(getSocialImage('data:image/png;base64,x', site, manifest), undefined);
    assert.equal(getSocialImage('/image.png', undefined, manifest), undefined);
  });
  await t.test('unchanged content has a stable filename; changed cover gets a new filename', async () => {
    const repeat = await buildSocialImages({ publicRoot: directory, site: site.href, sources: [source], pages });
    assert.equal(repeat.images[source].src, image.src);
    writeFileSync(file, await sharp({ create: { width: 400, height: 800, channels: 3, background: '#bb3322' } })
      .png().toBuffer());
    const changed = await buildSocialImages({ publicRoot: directory, site: site.href, sources: [source], pages });
    assert.notEqual(changed.images[source].src, image.src);
    writeFileSync(file, original);
    writeFileSync(join(directory, 'social-images.json'), JSON.stringify(manifest));
  });
  await t.test('missing local covers fail instead of publishing a broken image URL', async () => {
    await assert.rejects(buildSocialImages({ publicRoot: directory, site: site.href, sources: ['/missing.png'] }));
  });
  await t.test('encoded traversal outside public is rejected', async () => {
    await assert.rejects(buildSocialImages({ publicRoot: directory, site: site.href, sources: ['/%2F..%2Fsecret.png'] }),
      /escapes public/);
  });

  for (const page of pages) {
    const htmlFile = join(directory, page.path, 'index.html');
    mkdirSync(dirname(htmlFile), { recursive: true });
    writeFileSync(htmlFile, htmlFor(page, manifest));
  }
  writeFileSync(join(directory, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  await t.test('both locales, escaped metadata, real JPEGs and robots pass the output checker', () => {
    const result = validate(directory);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /2 pages, 1 unique JPEGs passed/);
  });
  const htmlFile = join(directory, pages[0].path, 'index.html');
  const validHtml = readFileSync(htmlFile, 'utf8');
  await t.test('duplicate twitter:image is rejected', () => {
    writeFileSync(htmlFile, validHtml.replace('</head>', '<meta name="twitter:image" content="https://wrong.test/a.jpg"></head>'));
    assert.notEqual(validate(directory).status, 0);
    writeFileSync(htmlFile, validHtml);
  });
  await t.test('metadata injected into body instead of initial head is rejected', () => {
    writeFileSync(htmlFile, validHtml.replace('name="twitter:card"', 'name="missing-card"'));
    assert.notEqual(validate(directory).status, 0);
    writeFileSync(htmlFile, validHtml);
  });
  await t.test('a robots rule blocking Twitterbot images is rejected', () => {
    writeFileSync(join(directory, 'robots.txt'), 'User-agent: Twitterbot\nDisallow: /social/\n');
    assert.notEqual(validate(directory).status, 0);
  });
});
