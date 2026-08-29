/**
 * Single declaration site for every localized dynamic route's parameter space.
 *
 * Each route is declared once here and consumed twice: the root page exports
 * `<route>.root` and its `[lang]/` mirror exports `<route>.mirror`.
 */

import { getPapers } from '@/lib/papers';
import { localePaths } from './utils';

export const paperRoute = localePaths(() =>
  getPapers().map((paper) => ({ params: { slug: paper.id }, props: { paperId: paper.id } })),
);
