import type { GiscusConfig } from '@/lib/config/types';

type GiscusMapping = NonNullable<GiscusConfig['mapping']>;

export interface GiscusTarget {
  mapping: GiscusMapping;
  term?: string;
}

/**
 * Prefer a stable content ID whenever one is supplied. If a future page omits
 * its ID while the site-wide mapping is `specific`, fall back to the pathname
 * instead of sending Giscus an invalid empty search term.
 */
export function resolveGiscusTarget(config: GiscusConfig, contentId?: string): GiscusTarget {
  const stableId = contentId?.trim();
  if (stableId) return { mapping: 'specific', term: stableId };

  const configuredTerm = config.term?.trim();
  const mapping = config.mapping ?? 'pathname';
  if (mapping === 'specific' && !configuredTerm) return { mapping: 'pathname' };

  return { mapping, term: configuredTerm || undefined };
}
