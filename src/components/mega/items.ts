/** Build-time: what each page's megastructure holds. Runs in page frontmatter, never in the browser. */

import { getCollection } from 'astro:content';
import { friendsData } from '@constants/friends-config';
import { localizedPath } from '@/i18n';
import { getBlogArticles } from '@/lib/blogs';
import { displayDate } from '@/lib/date';
import type { MegaItem } from '@/lib/megastructures';
import { getPapers } from '@/lib/papers';

const BLOG_COLORS = { inspirations: '#f7a8c8', learning: '#b8e6fe' } as const;

export function paperItems(locale: string): MegaItem[] {
  return getPapers().map((paper) => ({
    title: locale === 'en' && paper.titleEn ? paper.titleEn : paper.title,
    href: localizedPath(`/papers/${paper.id}`, locale),
    meta: displayDate.date(paper.date),
    color: '#ffd27a',
  }));
}

export async function blogItems(locale: string): Promise<MegaItem[]> {
  return (await getBlogArticles(locale)).map((entry) => ({
    title: entry.data.title,
    href: localizedPath(`/blogs/${entry.data.routeSlug}`, locale),
    meta: displayDate.date(entry.data.publishedAt),
    color: BLOG_COLORS[entry.data.category],
  }));
}

export async function albumItems(locale: string): Promise<MegaItem[]> {
  return (await getCollection('albums'))
    .filter((entry) => entry.data.language === 'zh' || entry.data.language === locale)
    .sort((a, b) => (b.data.date?.getTime() ?? 0) - (a.data.date?.getTime() ?? 0))
    .map((entry) => ({
      title: entry.data.name,
      href: `#album-${entry.id}`,
      meta: `${entry.data.photos.length} ${locale === 'en' ? 'photos' : '张'}`,
    }));
}

/** First words of a note, without markdown marks, to stand in for a title. */
export function excerpt(body: string, length = 18): string {
  const text = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export async function momentItems(locale: string): Promise<MegaItem[]> {
  return (await getCollection('moments'))
    .filter((entry) => !entry.data.draft && (entry.data.language === 'zh' || entry.data.language === locale))
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .map((entry) => ({ title: excerpt(entry.body ?? '') || '…', meta: displayDate.date(entry.data.date) }));
}

export function friendItems(): MegaItem[] {
  return friendsData.map((friend) => ({ title: friend.site, href: friend.url, meta: friend.owner, color: friend.color }));
}
