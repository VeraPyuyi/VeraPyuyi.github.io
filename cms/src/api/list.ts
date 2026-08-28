/** Lists flat articles and dashboard statistics without taxonomy filters. */

import fs from 'node:fs/promises';
import path from 'node:path';
import { isValid, parse, parseISO } from 'date-fns';
import matter from 'gray-matter';
import type { Context } from 'hono';
import yaml from 'js-yaml';
import { CONTENT_DIR, RECENT_POSTS_COUNT } from '@/lib/paths';
import type { DashboardStats, ListPostsResponse, PostListItem } from '@/types';

async function getAllMarkdownFiles(dir: string, baseDir: string = dir): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return getAllMarkdownFiles(fullPath, baseDir);
        if (entry.isFile() && /\.mdx?$/.test(entry.name)) return [path.relative(baseDir, fullPath)];
        return [];
      }),
    )
  ).flat();
}

function parseLocalDate(value: string | Date | undefined): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  const local = parse(value, 'yyyy-MM-dd HH:mm:ss', new Date());
  if (isValid(local)) return local.toISOString();
  if (value.includes('T')) {
    const iso = parseISO(value);
    if (isValid(iso)) return iso.toISOString();
  }
  const fallback = new Date(value);
  return isValid(fallback) ? fallback.toISOString() : new Date().toISOString();
}

async function parsePostFile(filePath: string, contentDir: string): Promise<PostListItem | null> {
  try {
    const source = await fs.readFile(path.join(contentDir, filePath), 'utf-8');
    const { data } = matter(source, {
      engines: {
        yaml: {
          parse: (value) => yaml.load(value, { schema: yaml.JSON_SCHEMA }) as object,
          stringify: (value) => yaml.dump(value),
        },
      },
    });
    const slug = filePath.replace(/\.mdx?$/, '');
    return {
      id: filePath,
      slug,
      title: data.title || slug,
      date: parseLocalDate(data.date),
      updated: data.updated ? parseLocalDate(data.updated) : undefined,
      keywords: Array.isArray(data.keywords)
        ? data.keywords.filter((keyword): keyword is string => typeof keyword === 'string')
        : [],
      draft: data.draft === true,
      sticky: data.sticky === true,
    };
  } catch (error) {
    console.error(`[CMS List API] Error parsing ${filePath}:`, error);
    return null;
  }
}

function filterPosts(posts: PostListItem[], params: { status?: string; search?: string }): PostListItem[] {
  let filtered = posts;
  if (params.status === 'draft') filtered = filtered.filter((post) => post.draft);
  if (params.status === 'published') filtered = filtered.filter((post) => !post.draft);
  if (params.search) {
    const query = params.search.toLocaleLowerCase();
    filtered = filtered.filter(
      (post) =>
        post.title.toLocaleLowerCase().includes(query) ||
        post.keywords.some((keyword) => keyword.toLocaleLowerCase().includes(query)),
    );
  }
  return filtered;
}

function sortPosts(posts: PostListItem[], sort: string, order: string): PostListItem[] {
  const ascending = order === 'asc';
  return [...posts].sort((left, right) => {
    const comparison =
      sort === 'title'
        ? left.title.localeCompare(right.title)
        : new Date(sort === 'updated' ? left.updated || left.date : left.date).getTime() -
          new Date(sort === 'updated' ? right.updated || right.date : right.date).getTime();
    return ascending ? comparison : -comparison;
  });
}

function calculateStats(posts: PostListItem[]): DashboardStats {
  const recentPosts = posts
    .toSorted((left, right) => new Date(right.updated || right.date).getTime() - new Date(left.updated || left.date).getTime())
    .slice(0, RECENT_POSTS_COUNT);
  return {
    total: posts.length,
    published: posts.filter((post) => !post.draft).length,
    draft: posts.filter((post) => post.draft).length,
    recentPosts,
  };
}

export async function listHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;
  try {
    const contentDir = path.join(projectRoot, CONTENT_DIR);
    const parsed = await Promise.all((await getAllMarkdownFiles(contentDir)).map((file) => parsePostFile(file, contentDir)));
    const allPosts = parsed.filter((post): post is PostListItem => post !== null);
    const stats = calculateStats(allPosts);
    const posts = sortPosts(
      filterPosts(allPosts, { status: c.req.query('status'), search: c.req.query('search') }),
      c.req.query('sort') || 'date',
      c.req.query('order') || 'desc',
    );
    const response: ListPostsResponse = { posts, total: posts.length, stats };
    return c.json(response);
  } catch (error) {
    console.error('[CMS List API] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
