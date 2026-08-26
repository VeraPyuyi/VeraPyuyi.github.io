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

function getManifest(): MediaManifest {
  if (manifest) return manifest;
  const path = join(process.cwd(), 'public/media-manifest.json');
  manifest = existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as MediaManifest) : {};
  return manifest;
}

function widthFromPath(path: string): number {
  return Number(path.match(/-(\d+)\.(?:avif|webp)$/)?.[1] ?? 0);
}

function srcset(paths: string[]): string | undefined {
  const entries = paths
    .map((path) => ({ path, width: widthFromPath(path) }))
    .filter((entry) => entry.width > 0)
    .sort((a, b) => a.width - b.width);
  return entries.length ? entries.map(({ path, width }) => `${path} ${width}w`).join(', ') : undefined;
}

export function getResponsiveMedia(source: string): ResponsiveMedia {
  const variants = getManifest()[source] ?? [];
  const webp = variants.filter((path) => path.endsWith('.webp') && !path.endsWith('-lqip.webp'));
  const avif = variants.filter((path) => path.endsWith('.avif'));
  const fallback = webp.sort((a, b) => widthFromPath(a) - widthFromPath(b)).at(-1) ?? source;
  return {
    avifSrcset: srcset(avif),
    fallback,
    lqip: variants.find((path) => path.endsWith('-lqip.webp')),
    webpSrcset: srcset(webp),
  };
}
