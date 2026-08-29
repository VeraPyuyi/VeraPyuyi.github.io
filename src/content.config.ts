import { defineCollection } from 'astro:content';
import { parseDateInSiteTimezone, reinterpretUtcAsTimezone } from '@lib/date';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Custom date schema that parses date strings in the site's configured timezone.
 * This ensures consistent date handling regardless of build environment.
 *
 * Accepts:
 * - Date objects (reinterpreted from UTC to site timezone, since gray-matter
 *   incorrectly parses "2025-12-29 21:55:00" as UTC)
 * - Date strings like "2025-12-29 21:55:00" (parsed as site timezone)
 * - ISO strings like "2025-12-29T21:55:00+08:00" (parsed correctly with offset)
 */
const dateInSiteTimezone = z
  .string()
  .or(z.date())
  .transform((val) => {
    if (val instanceof Date) {
      // gray-matter has already parsed the date string as UTC, but user intended site timezone.
      // Reinterpret the UTC values as site timezone to get correct timestamp.
      return reinterpretUtcAsTimezone(val);
    }
    return parseDateInSiteTimezone(val);
  });

const blogDirectoryCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blogs' }),
  schema: z.object({
    name: z.string(),
    description: z.string(),
    status: z.enum(['idea', 'active', 'maintained', 'archived']).default('active'),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    source: z.url().optional(),
    url: z.url().optional(),
    order: z.number().default(0),
    language: z.enum(['zh', 'en']).default('zh'),
  }),
});

const momentCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/moments' }),
  schema: z.object({
    date: dateInSiteTimezone,
    photos: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string().min(1),
        }),
      )
      .default([]),
    location: z.string().optional(),
    language: z.enum(['zh', 'en']).default('zh'),
    draft: z.boolean().default(false),
  }),
});

const albumCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/albums' }),
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
    cover: z.string(),
    date: dateInSiteTimezone.optional(),
    language: z.enum(['zh', 'en']).default('zh'),
    photos: z.array(
      z.object({
        src: z.string(),
        alt: z.string().min(1),
        date: dateInSiteTimezone.optional(),
      }),
    ),
  }),
});

export const collections = {
  blogs: blogDirectoryCollection,
  moments: momentCollection,
  albums: albumCollection,
};
