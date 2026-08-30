/**
 * Single declaration site for every localized dynamic route's parameter space.
 *
 * Each route is declared once here and consumed twice: the root page exports
 * `<route>.root` and its `[lang]/` mirror exports `<route>.mirror`.
 */

import { getBlogArticles } from '@/lib/blogs';
import { getPapers } from '@/lib/papers';
import { localePaths } from './utils';

export const paperRoute = localePaths(() =>
  getPapers().map((paper) => ({ params: { slug: paper.id }, props: { paperId: paper.id } })),
);

export const blogRoute = localePaths(async ({ locale }) =>
  (await getBlogArticles(locale)).map((entry) => ({
    params: { slug: entry.data.routeSlug },
    props: { blogSlug: entry.data.routeSlug },
  })),
);
