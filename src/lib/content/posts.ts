/**
 * Post-related utility functions
 */

import { type CollectionEntry, getCollection } from 'astro:content';
import summaries from '@assets/summaries.json';
import readingTime from 'reading-time';
import type { BlogPost } from 'types/blog';
import { t } from '@/i18n';
import { defaultLocale } from '@/i18n/config';
import { extractTextFromMarkdown } from '../sanitize';
import { memoize } from './cache';
import { filterPostsByLocale, getPostSlug } from './locale';

/** WeakMap-based cache for reading-time results — auto-GC when post objects are collected */
const readingTimeCache = new WeakMap<CollectionEntry<'blog'>, { words: number; text: string; minutes: number }>();

/**
 * Get reading-time stats for a post, cached per object identity.
 * Ensures each post's body is parsed at most once across transforms, Cover, and stats.
 */
export function getPostReadingTime(post: CollectionEntry<'blog'>): { words: number; text: string; minutes: number } {
  let cached = readingTimeCache.get(post);
  if (!cached) {
    const result = readingTime(post.body ?? '');
    cached = { words: result.words, text: result.text, minutes: result.minutes };
    readingTimeCache.set(post, cached);
  }
  return cached;
}

/** AI 摘要数据类型 */
type SummariesData = Record<string, { title: string; summary: string }>;

/** Pre-built lowercase slug → original key map for O(1) case-insensitive fallback */
const summaryLowerMap = new Map<string, string>();
for (const key of Object.keys(summaries as SummariesData)) {
  summaryLowerMap.set(key.toLowerCase(), key);
}

/**
 * 获取文章描述
 * 优先使用 frontmatter 中的 description，如果不存在则从 Markdown 内容中智能提取
 * @param post 文章对象
 * @param maxLength 最大长度，默认 150 字符
 * @returns 文章描述文本
 */
export function getPostDescription(post: BlogPost, locale: string = defaultLocale, maxLength: number = 150): string {
  if (post.data.description) return post.data.description;
  if (post.data.password) return t(locale, 'encrypted.post.description');
  return extractTextFromMarkdown(post.body ?? '', maxLength);
}

/**
 * Get the AI-generated summary for a post.
 * @param slug Public post slug, usually derived from post.data.link or post.id.
 * @returns The generated summary, or null when none exists.
 */
export function getPostSummary(slug: string): string | null {
  const data = summaries as SummariesData;

  // Fast path: exact match (O(1))
  const exactMatch = data[slug]?.summary ?? null;
  if (exactMatch) return exactMatch;

  // Fallback: case-insensitive lookup via pre-built map
  const originalKey = summaryLowerMap.get(slug.toLowerCase());
  return originalKey ? data[originalKey].summary : null;
}

/**
 * 获取文章描述，带 AI 摘要 fallback
 * 优先级：frontmatter description > 加密文章通用描述 > AI 摘要 > markdown 提取
 * @param post 文章对象
 * @param locale 语言环境
 * @param maxLength 最大长度，默认 150 字符
 * @returns 文章描述文本
 */
export function getPostDescriptionWithSummary(post: BlogPost, locale: string = defaultLocale, maxLength: number = 150): string {
  // 最高优先级：frontmatter 中的描述
  if (post.data.description) {
    return post.data.description;
  }
  if (post.data.password) {
    return t(locale, 'encrypted.post.description');
  }
  return getPostSummary(getPostSlug(post)) || extractTextFromMarkdown(post.body ?? '', maxLength);
}

/**
 * Get all posts sorted by date (newest first)
 * In production, draft posts are filtered out
 * @param locale Optional locale filter — undefined returns all, 'zh' returns default only, 'en' returns en + fallback
 */
export async function getSortedPosts(locale?: string): Promise<CollectionEntry<'blog'>[]> {
  return memoize('sortedPosts', locale ?? '__all__', async () => {
    const posts = await getCollection('blog', ({ data }) => {
      // 在生产环境中，过滤掉草稿
      return import.meta.env.PROD ? data.draft !== true : true;
    });

    // 使用浅拷贝避免原地修改 Astro 内部缓存的数组
    const sortedPosts = posts.toSorted((a: BlogPost, b: BlogPost) => {
      return b.data.date.getTime() - a.data.date.getTime();
    });

    return filterPostsByLocale(sortedPosts, locale);
  });
}

/**
 * Get a single post by its collection ID.
 * Builds an id→post Map once (per locale), then lookups are O(1).
 */
export async function getPostById(id: string, locale?: string): Promise<CollectionEntry<'blog'> | undefined> {
  const map = await memoize('postByIdMap', locale ?? '__all__', async () => {
    const posts = await getSortedPosts(locale);
    return new Map(posts.map((p) => [p.id, p]));
  });
  return map.get(id);
}

/**
 * Get posts separated by sticky status
 * @returns Object containing sticky and non-sticky posts, both sorted by date (newest first)
 */
export async function getPostsBySticky(locale?: string): Promise<{
  stickyPosts: CollectionEntry<'blog'>[];
  nonStickyPosts: CollectionEntry<'blog'>[];
}> {
  const posts = await getSortedPosts(locale);

  const stickyPosts: CollectionEntry<'blog'>[] = [];
  const nonStickyPosts: CollectionEntry<'blog'>[] = [];

  for (const post of posts) {
    if (post.data?.sticky) {
      stickyPosts.push(post);
    } else {
      nonStickyPosts.push(post);
    }
  }

  return { stickyPosts, nonStickyPosts };
}

/**
 * Get post count (excluding drafts in production)
 * Leverages getSortedPosts cache instead of a separate getCollection call.
 */
export async function getPostCount(locale?: string) {
  const posts = await getSortedPosts(locale);
  return posts.length;
}

/**
 * Fisher-Yates 洗牌算法
 * 相比 sort(() => Math.random() - 0.5)，能产生均匀分布的随机排列
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * 获取随机文章
 * @param count 文章数量
 * @returns 随机文章列表
 */
export async function getRandomPosts(count: number = 10, locale?: string): Promise<BlogPost[]> {
  const posts = await getSortedPosts(locale);
  const shuffled = shuffleArray(posts);
  return shuffled.slice(0, Math.min(count, posts.length));
}

/**
 * 首页数据：文章不再按分类或系列拆分，只区分置顶和普通文章。
 */
export async function getHomePagePosts(locale?: string): Promise<{
  highlightedPosts: BlogPost[];
  stickyPosts: BlogPost[];
  regularPosts: BlogPost[];
}> {
  const allPosts = await getSortedPosts(locale);
  const stickyPosts: BlogPost[] = [];
  const regularPosts: BlogPost[] = [];
  for (const post of allPosts) {
    if (post.data?.sticky) {
      stickyPosts.push(post);
    } else {
      regularPosts.push(post);
    }
  }

  return { highlightedPosts: [], stickyPosts, regularPosts };
}
