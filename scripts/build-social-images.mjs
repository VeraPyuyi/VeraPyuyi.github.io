import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';

export const SOCIAL_WIDTH = 1200;
export const SOCIAL_HEIGHT = 630;
export const SOCIAL_MAX_BYTES = 1_000_000;

/** Generate independent, cache-versioned JPEGs; never overwrite a source cover. */
export async function buildSocialImages({ publicRoot, site, sources, pages = [] }) {
  const root = resolve(publicRoot);
  const origin = new URL(site);
  const directory = join(root, 'social');
  mkdirSync(directory, { recursive: true });
  const manifest = { version: 1, revision: process.env.GITHUB_SHA ?? null, site: origin.href, images: {}, pages };
  for (const source of [...new Set(sources)].sort()) {
    const url = new URL(source, origin);
    if (!['https:', 'http:'].includes(url.protocol)) throw new Error(`Invalid social image URL: ${source}`);
    // External images remain external; do not introduce a network dependency into the build.
    if (url.origin !== origin.origin) continue;
    const file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    const rel = relative(root, file);
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
      throw new Error(`Social image escapes public/: ${source}`);
    }
    const input = readFileSync(file);
    const { data, info } = await sharp(input)
      .rotate()
      .resize(SOCIAL_WIDTH, SOCIAL_HEIGHT, { fit: 'contain', background: '#ffffff' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer({ resolveWithObject: true });
    if (data.length >= SOCIAL_MAX_BYTES) throw new Error(`Social image exceeds 1 MB: ${source}`);
    const hash = createHash('sha256').update(data).digest('hex').slice(0, 20);
    const filename = `cover-${hash}.jpg`;
    writeFileSync(join(directory, filename), data);
    manifest.images[url.pathname] = {
      src: `/social/${filename}`,
      width: info.width,
      height: info.height,
      type: 'image/jpeg',
      bytes: data.length,
      sourceBytes: input.length,
    };
  }
  writeFileSync(join(root, 'social-images.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[social] generated ${Object.keys(manifest.images).length} JPEG(s) for ${pages.length} blog page(s)`);
  return manifest;
}

/** Read the same frontmatter and locale settings used by the blog routes. */
export async function buildSiteSocialImages(root = process.cwd()) {
  const [{ default: matter }, { default: YAML }] = await Promise.all([import('gray-matter'), import('yaml')]);
  const config = YAML.parse(readFileSync(join(root, 'config/site.yaml'), 'utf8'));
  const site = config.site.url;
  const defaultLocale = config.i18n?.defaultLocale ?? 'zh';
  const locales = (config.i18n?.locales ?? [{ code: defaultLocale }])
    .filter((locale) => locale.enabled !== false).map((locale) => locale.code);
  const fallback = config.site.defaultOgImage || config.site.avatar;
  const sources = fallback ? [fallback] : [];
  const pages = [];
  const blogRoot = join(root, 'src/content/blogs');
  for (const entry of readdirSync(blogRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isFile() || !/\.mdx?$/.test(entry.name)) continue;
    const { data } = matter(readFileSync(join(blogRoot, entry.name), 'utf8'));
    const locale = data.language ?? defaultLocale;
    if (data.draft || !locales.includes(locale)) continue;
    if (!data.routeSlug || !data.title) throw new Error(`Missing blog route/title: ${entry.name}`);
    const image = data.cover || fallback;
    if (!image) throw new Error(`Missing blog cover and site fallback: ${entry.name}`);
    sources.push(image);
    const prefix = locale === defaultLocale ? '' : `/${locale}`;
    pages.push({
      path: `${prefix}/blogs/${data.routeSlug}/`,
      title: data.title,
      description: data.summary,
      image,
      alt: data.coverAlt || data.title,
    });
  }
  return buildSocialImages({ publicRoot: join(root, 'public'), site, sources, pages });
}
