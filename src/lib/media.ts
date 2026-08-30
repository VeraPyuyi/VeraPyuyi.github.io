import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface MediaManifest {
  [source: string]: string[];
}

export interface ResponsiveMedia {
  avifSrcset?: string;
  fallback: string;
  lqip?: string;
  webpSrcset?: string;
}

let manifest: MediaManifest | undefined;
const revisionCache = new Map<string, string | undefined>();

function getManifest(): MediaManifest {
  if (manifest) return manifest;
  const path = join(process.cwd(), 'public/media-manifest.json');
  manifest = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as MediaManifest) : {};
  return manifest;
}

function widthFromPath(path: string): number {
  return Number(path.match(/-(\d+)\.(?:avif|webp)$/)?.[1] ?? 0);
}

function revisionFor(source: string, variants: string[]): string | undefined {
  if (revisionCache.has(source)) return revisionCache.get(source);
  if (!source.startsWith('/')) return undefined;

  const sourcePath = join(process.cwd(), 'public', source.slice(1));
  if (!existsSync(sourcePath)) return undefined;

  const hash = createHash('sha256').update(readFileSync(sourcePath));
  for (const variant of variants) {
    const variantPath = join(process.cwd(), 'public', variant.slice(1));
    if (existsSync(variantPath)) hash.update(variant).update(readFileSync(variantPath));
  }
  const revision = hash.digest('hex').slice(0, 12);
  revisionCache.set(source, revision);
  return revision;
}

function versioned(path: string, revision: string | undefined): string {
  if (!revision) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}v=${revision}`;
}

function srcset(paths: string[], revision: string | undefined): string | undefined {
  const entries = paths
    .map((path) => ({ path, width: widthFromPath(path) }))
    .filter((entry) => entry.width > 0)
    .sort((a, b) => a.width - b.width);
  return entries.length ? entries.map(({ path, width }) => `${versioned(path, revision)} ${width}w`).join(', ') : undefined;
}

export function getResponsiveMedia(source: string): ResponsiveMedia {
  const variants = getManifest()[source] ?? [];
  const webp = variants.filter((path) => path.endsWith('.webp') && !path.endsWith('-lqip.webp'));
  const avif = variants.filter((path) => path.endsWith('.avif'));
  const revision = revisionFor(source, variants);
  const fallback = webp.sort((a, b) => widthFromPath(a) - widthFromPath(b)).at(-1) ?? source;
  const lqip = variants.find((path) => path.endsWith('-lqip.webp'));
  return {
    avifSrcset: srcset(avif, revision),
    fallback: versioned(fallback, revision),
    lqip: lqip ? versioned(lqip, revision) : undefined,
    webpSrcset: srcset(webp, revision),
  };
}
