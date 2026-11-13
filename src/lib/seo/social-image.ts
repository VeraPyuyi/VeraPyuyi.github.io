import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface SocialImage {
  src: string;
  width: number;
  height: number;
  type: string;
}

export interface SocialImageManifest {
  images: Record<string, SocialImage>;
}

function loadManifest(): SocialImageManifest {
  const file = join(process.cwd(), 'public/social-images.json');
  // A fresh dev checkout can still use its original covers before images:build.
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { images: {} };
}

/** Only replace same-origin images; preserve remote image URLs (including queries). */
export function getSocialImage(
  source: string | undefined,
  site: URL | undefined,
  manifest: SocialImageManifest = loadManifest(),
): { url: string; width?: number; height?: number; type?: string } | undefined {
  if (!source) return undefined;
  let url: URL;
  try {
    url = new URL(source, site);
  } catch {
    return undefined;
  }
  if (!['https:', 'http:'].includes(url.protocol)) return undefined;
  const image = site && url.origin === site.origin ? manifest.images[url.pathname] : undefined;
  if (!image) return { url: url.href };
  return {
    url: new URL(image.src, site).href,
    width: image.width,
    height: image.height,
    type: image.type,
  };
}
