/**
 * Homepage deep links from the rest of the site: `#sky=papers` flies to a galaxy, and
 * `#star=blog-some-post` flies to the galaxy holding that post and marks its star.
 */

import { parseSkyHash, SKY_CATALOG } from '@/lib/sky-catalog';

export interface DeepLinkTarget {
  /** Stop on the route to fly to. */
  stop: number;
  /** The post's star, when the link named one. */
  star?: HTMLAnchorElement;
}

export function resolveDeepLink(hash: string, stars: readonly HTMLAnchorElement[]): DeepLinkTarget | null {
  const link = parseSkyHash(hash);
  if (link.star) {
    const star = stars.find((element) => element.dataset.starId === link.star);
    if (star) return { stop: Number(star.dataset.galaxy), star };
  }
  return link.sky ? { stop: SKY_CATALOG[link.sky].stop } : null;
}
