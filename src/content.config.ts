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

/**
 * Optional date. Editors such as Pages CMS write an empty value when the field is left blank, so an
 * empty string or null counts as "not set" rather than an invalid date.
 */
const optionalDateInSiteTimezone = z.preprocess(
  (val) => (val === '' || val === null ? undefined : val),
  dateInSiteTimezone.optional(),
);

const blogArticleCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blogs' }),
  schema: z
    .object({
      title: z.string(),
      summary: z.string(),
      publishedAt: dateInSiteTimezone,
      updatedAt: optionalDateInSiteTimezone,
      language: z.enum(['zh', 'en']),
      translationKey: z.string().min(1),
      routeSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      category: z.enum(['inspirations', 'learning']),
      keywords: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      featured: z.boolean().default(false),
      comments: z.boolean().default(true),
      cover: z.string().optional(),
      coverAlt: z.string().optional(),
      order: z.number().default(0),
    })
    .superRefine((entry, context) => {
      if (entry.draft) return;
      if (!entry.cover) {
        context.addIssue({ code: 'custom', path: ['cover'], message: 'Published blogs require a cover image.' });
      }
      if (!entry.coverAlt?.trim()) {
        context.addIssue({ code: 'custom', path: ['coverAlt'], message: 'Published blogs require cover alt text.' });
      }
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
    date: optionalDateInSiteTimezone,
    language: z.enum(['zh', 'en']).default('zh'),
    photos: z.array(
      z.object({
        src: z.string(),
        alt: z.string().min(1),
        date: optionalDateInSiteTimezone,
      }),
    ),
  }),
});

/** One-line news for the homepage: a numbered telegram and a nova in the opening sky (see `@/lib/news`). */
const newsCollection = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/news' }),
  schema: z.object({
    date: dateInSiteTimezone,
    text: z.string().trim().min(1),
    textEn: z.string().optional(),
    href: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  blogs: blogArticleCollection,
  moments: momentCollection,
  albums: albumCollection,
  news: newsCollection,
};
