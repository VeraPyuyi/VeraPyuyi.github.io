/** Creates a flat article file with taxonomy-free frontmatter. */

import fs from 'node:fs/promises';
import path from 'node:path';
import { format } from 'date-fns';
import type { Context } from 'hono';
import { z } from 'zod';
import { CONTENT_DIR } from '@/lib/paths';
import { generateSlug } from '@/lib/slug';
import { isPathSafe } from '@/lib/validation';
import type { CreatePostResponse } from '@/types';

const createPostRequestSchema = z.object({
  title: z.string().min(1, 'Title is required').trim(),
  keywords: z.array(z.string().trim().min(1)).optional(),
  draft: z.boolean().optional().default(true),
});

type CreatePostParams = z.infer<typeof createPostRequestSchema>;

function generateFrontmatter(params: CreatePostParams): string {
  const date = format(new Date(), 'yyyy-MM-dd HH:mm:ss');
  const lines = ['---', `title: ${params.title}`, `date: ${date}`, `updated: ${date}`];
  if (params.keywords?.length) lines.push(`keywords: [${params.keywords.join(', ')}]`);
  if (params.draft !== false) lines.push('draft: true');
  lines.push('catalog: true', '---', '', '');
  return lines.join('\n');
}

export async function createHandler(c: Context) {
  const projectRoot = c.get('projectRoot') as string;
  try {
    const result = createPostRequestSchema.safeParse(await c.req.json());
    if (!result.success) return c.json({ error: result.error.errors.map((error) => error.message).join(', ') }, 400);

    const postId = `${generateSlug(result.data.title)}.md`;
    if (!isPathSafe(postId)) return c.json({ error: 'Invalid file path' }, 400);
    const filePath = path.join(projectRoot, CONTENT_DIR, postId);
    try {
      await fs.access(filePath);
      return c.json({ error: `File already exists: ${postId}` }, 409);
    } catch {
      // The article is new.
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, generateFrontmatter(result.data), 'utf-8');
    const response: CreatePostResponse = { success: true, postId };
    return c.json(response, 201);
  } catch (error) {
    console.error('[CMS Create API] Error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
}
