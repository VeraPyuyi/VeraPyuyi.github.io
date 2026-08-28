/**
 * Single declaration site for every localized dynamic route's parameter space.
 *
 * Each route is declared once here and consumed twice: the root page exports
 * `<route>.root` and its `[lang]/` mirror exports `<route>.mirror`.
 */

import { PAGINATION } from '@constants/layout';
import { getPostSlug, getSortedPosts } from '@lib/content';
import { getPapers } from '@/lib/papers';
import { localePaths } from './utils';

export const postRoute = localePaths(async ({ locale }) => {
  const posts = await getSortedPosts(locale);
  return posts.map((post) => ({ params: { slug: getPostSlug(post) }, props: { postId: post.id } }));
});

export const postListRoute = localePaths(async ({ locale, localeParams, paginate }) => {
  const posts = await getSortedPosts(locale);
  return paginate(posts, { pageSize: PAGINATION.pageSize, params: localeParams });
});

export const paperRoute = localePaths(() =>
  getPapers().map((paper) => ({ params: { slug: paper.id }, props: { paperId: paper.id } })),
);
