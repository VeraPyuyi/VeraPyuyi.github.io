/**
 * Content utilities - Index file
 *
 * Re-exports all content-related utilities from modular files.
 * This maintains backward compatibility while organizing code better.
 */

// =============================================================================
// Locale Utilities
// =============================================================================
export { getPostLocale, getPostSlug } from './content/locale';
// =============================================================================
// Post Utilities
// =============================================================================
export {
  // Core post functions
  getHomePagePosts,
  getPostById,
  getPostCount,
  getPostDescription,
  getPostDescriptionWithSummary,
  // Reading time utility
  getPostReadingTime,
  getPostSummary,
  getPostsBySticky,
  getRandomPosts,
  getSortedPosts,
} from './content/posts';
