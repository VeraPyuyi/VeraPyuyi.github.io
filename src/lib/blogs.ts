import { type CollectionEntry, getCollection } from 'astro:content';
import { defaultLocale } from '@/i18n';

export type BlogArticleEntry = CollectionEntry<'blogs'>;

function compareArticles(left: BlogArticleEntry, right: BlogArticleEntry): number {
  const dateDifference = right.data.publishedAt.getTime() - left.data.publishedAt.getTime();
  if (dateDifference !== 0) return dateDifference;
  const orderDifference = right.data.order - left.data.order;
  return orderDifference !== 0 ? orderDifference : left.data.title.localeCompare(right.data.title);
}

export async function getBlogArticles(locale = defaultLocale): Promise<BlogArticleEntry[]> {
  return (await getCollection('blogs', ({ data }) => !data.draft && data.language === locale)).sort(compareArticles);
}

export async function getBlogArticle(slug: string, locale = defaultLocale): Promise<BlogArticleEntry | undefined> {
  return (await getBlogArticles(locale)).find((entry) => entry.data.routeSlug === slug);
}
