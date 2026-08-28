/**
 * CMS Form Validation Schemas
 *
 * Zod schemas for form validation in CMS components.
 * Used with react-hook-form for type-safe form handling.
 */

import { z } from 'zod';

/**
 * Schema for creating a new post
 */
export const createPostSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  keywords: z.string().optional(),
  draft: z.boolean(),
});

/**
 * Schema for frontmatter editor
 * Keywords are stored as a comma-separated display string and normalized on save.
 */
export const frontmatterSchema = z.object({
  title: z.string().min(1, '标题不能为空'),
  date: z.string().optional(),
  updated: z.string().optional(),
  description: z.string().optional(),
  keywords: z.string().optional(),
  cover: z.string().optional(),
  link: z.string().optional(),
  subtitle: z.string().optional(),
  draft: z.boolean().optional(),
  sticky: z.boolean().optional(),
  tocNumbering: z.boolean().optional(),
  excludeFromSummary: z.boolean().optional(),
  math: z.boolean().optional(),
  quiz: z.boolean().optional(),
});

// Type exports
export type CreatePostFormData = z.infer<typeof createPostSchema>;
export type FrontmatterFormData = z.infer<typeof frontmatterSchema>;
