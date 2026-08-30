import type { RSSFeedItem } from '@astrojs/rss';
import { localizedPath } from '@/i18n';
import { getBlogArticles } from '@/lib/blogs';
import { getPapers } from '@/lib/papers';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
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

  const blogs = await getBlogArticles(locale);
  const blogItems: RSSFeedItem[] = blogs.map((entry) => {
    const link = localizedPath(`/blogs/${entry.data.routeSlug}`, locale);
    return {
      title: entry.data.title,
      pubDate: entry.data.publishedAt,
      description: entry.data.summary,
      link,
      content: `<p>${escapeHtml(entry.data.summary)}</p><p><a href="${escapeHtml(link)}">${en ? 'Read the essay' : '阅读全文'}</a></p>`,
      customData: `<guid isPermaLink="false">blog:${escapeHtml(entry.data.translationKey)}</guid>`,
    };
  });

  return [...paperItems, ...blogItems];
}
