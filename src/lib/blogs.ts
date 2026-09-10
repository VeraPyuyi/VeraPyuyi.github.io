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
      ? 'Ideas, conjectures, and research questions that are still taking shape.'
      : '记录灵感、猜想，以及还没有完全想明白的研究念头。';
  }
  return locale === 'en'
    ? 'Reading notes, methods, and knowledge gathered along the way.'
    : '整理学习过程中的读书笔记、方法理解与知识脉络。';
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
