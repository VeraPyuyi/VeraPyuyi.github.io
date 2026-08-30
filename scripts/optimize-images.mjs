import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join, parse, relative } from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const publicRoot = join(root, 'public');
const uploadsRoot = join(publicRoot, 'uploads');
const mediaRoot = join(publicRoot, 'media');
const extensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const defaultWidths = [480, 960, 1600];
const paperCoverWidths = [480, 960, 1600, 2400, 3200];
const manifest = {};

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

async function optimize(source, key, outputDirectory, basename) {
  const metadata = await sharp(source).metadata();
  const originalWidth = metadata.width ?? 1600;
  const isPaperCover = /^\/uploads\/papers\/[^/]+\/cover\.png$/.test(key);
  const widths = isPaperCover ? paperCoverWidths : defaultWidths;
  const formats = isPaperCover ? ['webp'] : ['webp', 'avif'];
  const variants = [];
  const expectedOutputs = new Set();
  mkdirSync(outputDirectory, { recursive: true });
  for (const width of widths.filter((value) => value <= originalWidth || value === widths[0])) {
    for (const format of formats) {
      const output = join(outputDirectory, `${basename}-${width}.${format}`);
      const pipeline = sharp(source).rotate().resize({ width, withoutEnlargement: true });
      await (format === 'webp'
        ? pipeline.webp(isPaperCover ? { lossless: true, effort: 6 } : { quality: 82 })
        : pipeline.avif({ quality: 58, effort: 5 })
      ).toFile(output);
      expectedOutputs.add(output);
      variants.push(`/${relative(publicRoot, output).replaceAll('\\', '/')}`);
    }
  }
  if (!isPaperCover) {
    const lqip = join(outputDirectory, `${basename}-lqip.webp`);
    await sharp(source).rotate().resize({ width: 32, withoutEnlargement: true }).blur(1).webp({ quality: 38 }).toFile(lqip);
    expectedOutputs.add(lqip);
    variants.push(`/${relative(publicRoot, lqip).replaceAll('\\', '/')}`);
  }
  for (const entry of readdirSync(outputDirectory)) {
    if (!entry.startsWith(`${basename}-`) || !/\.(?:avif|webp)$/.test(entry)) continue;
    const output = join(outputDirectory, entry);
    if (!expectedOutputs.has(output)) unlinkSync(output);
  }
  manifest[key] = variants;
}

const og = join(publicRoot, 'og.png');
if (existsSync(og)) await optimize(og, '/og.png', publicRoot, 'og');

for (const source of walk(uploadsRoot).filter((path) => extensions.has(extname(path).toLowerCase()))) {
  const rel = relative(uploadsRoot, source);
  const info = parse(rel);
  const outputDirectory = join(mediaRoot, info.dir);
  await optimize(source, `/uploads/${rel.replaceAll('\\', '/')}`, outputDirectory, info.name);
}

writeFileSync(join(publicRoot, 'media-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`[images] optimized ${Object.keys(manifest).length} source image(s); metadata is stripped from generated variants`);
