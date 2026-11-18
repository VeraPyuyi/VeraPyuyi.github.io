import { type CollectionEntry, getCollection } from 'astro:content';
import { defaultLocale } from '@/i18n';

export type BlogArticleEntry = CollectionEntry<'blogs'>;
export type BlogCategory = BlogArticleEntry['data']['category'];

export const BLOG_CATEGORIES: BlogCategory[] = ['inspirations', 'learning'];

export function getBlogCategoryLabel(category: BlogCategory): string {
  return category === 'inspirations' ? 'Inspirations' : 'Learning';
}

export function getBlogCategoryDescription(category: BlogCategory, locale = defaultLocale): string {
  if (category === 'inspirations') {
    return locale === 'en'
      ? 'Thoughts that have not taken shape yet get their coordinates written down here first.'
      : '还没长出形状的念头，先在这里记下坐标。';
  }
  return locale === 'en'
    ? 'Copying down the lamps that others have lit, one by one, until I can find the way myself.'
    : '把别人点亮的灯一盏盏抄下来，直到自己也认得路。';
}

function compareArticles(left: BlogArticleEntry, right: BlogArticleEntry): number {
  const dateDifference = right.data.publishedAt.getTime() - left.data.publishedAt.getTime();
  if (dateDifference !== 0) return dateDifference;
  const orderDifference = right.data.order - left.data.order;
  return orderDifference !== 0 ? orderDifference : left.data.title.localeCompare(right.data.title);
}

export async function getBlogArticles(locale = defaultLocale, category?: BlogCategory): Promise<BlogArticleEntry[]> {
  return (
    await getCollection(
      'blogs',
      ({ data }) => !data.draft && data.language === locale && (!category || data.category === category),
    )
  ).sort(compareArticles);
}

export async function getBlogArticle(slug: string, locale = defaultLocale): Promise<BlogArticleEntry | undefined> {
  return (await getBlogArticles(locale)).find((entry) => entry.data.routeSlug === slug);
}
