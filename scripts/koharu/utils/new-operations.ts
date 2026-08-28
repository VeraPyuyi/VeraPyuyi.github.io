import fs from 'node:fs';
import path from 'node:path';
import { slugify } from 'transliteration';
import YAML from 'yaml';
import { BLOG_CONTENT_PATH, SITE_CONFIG_PATH } from '../constants/paths';
import type { FriendData, PostData } from '../creators/types';

/**
 * Generate a URL-friendly slug from a title.
 * Converts Chinese/Japanese characters to pinyin/romaji via transliteration.
 *
 * Always transliterates regardless of `enableSlugTransliteration` config —
 * CLI-generated filenames should be ASCII-safe for filesystem compatibility.
 */
export function generateSlug(title: string): string {
  return slugify(title, { separator: '-' });
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.promises.mkdir(dirPath, { recursive: true });
}

/**
 * Format a date for frontmatter
 */
export function formatDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/** Wrap value in single quotes if it contains YAML-special characters */
function yamlQuote(value: string): string {
  if (
    value === '' ||
    /[[\]{}:#&*?|>!%@`'",\n\\]/.test(value) ||
    /^[\s-]/.test(value) ||
    /\s$/.test(value) ||
    /^(true|false|yes|no|null|~|on|off)$/i.test(value)
  ) {
    return `'${value.replace(/'/g, "''")}'`;
  }
  return value;
}

/**
 * Generate frontmatter YAML string for a post
 */
export function generatePostFrontmatter(data: PostData): string {
  const lines: string[] = ['---'];

  lines.push(`title: ${yamlQuote(data.title)}`);
  if (data.link) {
    lines.push(`link: ${yamlQuote(data.link)}`);
  }
  lines.push(`date: ${formatDate()}`);

  if (data.description) {
    lines.push(`description: ${yamlQuote(data.description)}`);
  }

  if (data.keywords.length > 0) {
    lines.push('keywords:');
    for (const keyword of data.keywords) {
      lines.push(`  - ${yamlQuote(keyword)}`);
    }
  }

  if (data.draft) {
    lines.push('draft: true');
  }

  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

/**
 * Create a new blog post file
 */
export async function createPost(data: PostData): Promise<string> {
  await ensureDirectory(BLOG_CONTENT_PATH);

  // Use link if provided, otherwise generate slug from title
  const filename = data.link || generateSlug(data.title);
  const filePath = path.join(BLOG_CONTENT_PATH, `${filename}.md`);
  const content = generatePostFrontmatter(data);

  await fs.promises.writeFile(filePath, content, 'utf-8');

  return filePath;
}

/**
 * Append a friend link to site.yaml while preserving comments and formatting
 */
export async function appendFriend(data: FriendData): Promise<void> {
  const content = await fs.promises.readFile(SITE_CONFIG_PATH, 'utf-8');
  const doc = YAML.parseDocument(content);

  // Navigate to friends.data array
  const friends = doc.get('friends') as YAML.YAMLMap | undefined;
  if (!friends) {
    throw new Error('friends section not found in site.yaml');
  }

  const dataArray = friends.get('data') as YAML.YAMLSeq | undefined;
  if (!dataArray) {
    throw new Error('friends.data array not found in site.yaml');
  }

  // Create new friend entry
  const newFriend = doc.createNode({
    site: data.site,
    url: data.url,
    owner: data.owner,
    desc: data.desc,
    image: data.image,
    ...(data.color ? { color: data.color } : {}),
  });

  // Add to array
  dataArray.add(newFriend);

  // Write back with preserved formatting
  const output = doc.toString({
    lineWidth: 0, // Don't wrap lines
  });

  await fs.promises.writeFile(SITE_CONFIG_PATH, output, 'utf-8');
}

/**
 * Validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a post with the given link/filename already exists
 */
export async function postExists(link: string | undefined, title: string): Promise<boolean> {
  const filename = link || generateSlug(title);
  const filePath = path.join(BLOG_CONTENT_PATH, `${filename}.md`);

  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}
