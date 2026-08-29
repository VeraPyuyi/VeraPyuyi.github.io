import { getCollection } from 'astro:content';
import type { RSSFeedItem } from '@astrojs/rss';
import { localizedPath } from '@/i18n';
import { getPapers } from '@/lib/papers';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function blogAnchor(id: string): string {
  return `blog-${id.replace(/[^a-z0-9_-]+/gi, '-')}`;
}

export async function getAggregateRssItems(locale: string): Promise<RSSFeedItem[]> {
  const en = locale === 'en';
  const paperItems: RSSFeedItem[] = getPapers().map((paper) => {
    const title = en && paper.titleEn ? paper.titleEn : paper.title;
    const description = en && paper.abstractEn ? paper.abstractEn : paper.abstract;
    const link = localizedPath(`/papers/${paper.id}`, locale);
    return {
      title,
      pubDate: new Date(`${paper.date}T00:00:00Z`),
      description,
      link,
      content: `<p>${escapeHtml(description)}</p><p><a href="${escapeHtml(link)}">${en ? 'Read HTML and download PDF' : '阅读 HTML 并下载 PDF'}</a></p>`,
      customData: `<guid isPermaLink="false">paper:${escapeHtml(paper.id)}</guid>`,
    };
  });

  const blogs = (await getCollection('blogs'))
    .filter((entry) => entry.data.language === 'zh' || entry.data.language === locale)
    .sort((left, right) => right.data.order - left.data.order);
  const blogItems: RSSFeedItem[] = blogs.map((entry) => {
    const link = `${localizedPath('/blogs', locale)}#${blogAnchor(entry.id)}`;
    const links = [
      entry.data.source ? `<a href="${escapeHtml(entry.data.source)}">${en ? 'Source' : '源码'}</a>` : undefined,
      entry.data.url ? `<a href="${escapeHtml(entry.data.url)}">${en ? 'Visit' : '访问'}</a>` : undefined,
    ].filter(Boolean);
    return {
      title: entry.data.name,
      description: entry.data.description,
      link,
      content: `<p>${escapeHtml(entry.data.description)}</p>${links.length > 0 ? `<p>${links.join(' · ')}</p>` : ''}`,
      customData: `<guid isPermaLink="false">blog:${escapeHtml(entry.id)}</guid>`,
    };
  });

  return [...paperItems, ...blogItems];
}
