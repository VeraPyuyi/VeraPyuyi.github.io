import type { FC } from 'react';

/**
 * Props passed to content creator components
 */
export interface CreatorProps {
  /** Callback when creation is complete */
  onComplete: (success: boolean) => void;
  /** Whether to show return hint (for menu navigation) */
  showReturnHint?: boolean;
}

/**
 * Content creator definition
 */
export interface ContentCreator {
  /** Unique identifier for the creator */
  id: string;
  /** Display label shown in menu */
  label: string;
  /** Short description of what this creator does */
  description: string;
  /** The React component that renders the creator UI */
  Component: FC<CreatorProps>;
}

/**
 * Post frontmatter data
 */
export interface PostData {
  title: string;
  link?: string;
  description?: string;
  keywords: string[];
  draft: boolean;
}

/**
 * Friend link data
 */
export interface FriendData {
  site: string;
  url: string;
  owner: string;
  desc: string;
  image: string;
  color?: string;
}
