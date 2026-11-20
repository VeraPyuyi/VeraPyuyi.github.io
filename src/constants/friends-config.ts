// Import YAML config directly - processed by @rollup/plugin-yaml

import type { FriendLink, FriendsIntro } from '@lib/config/types';
import type { FriendSources } from '@lib/friends/load';
import yamlConfig from '../../config/site.yaml';
import { commentConfig } from './site-config';

// Re-export type for backwards compatibility
export type { FriendLink };

export const friendsData: FriendLink[] = yamlConfig.friends?.data ?? [];

/** Comment path of the friends page, where visitors leave applications. */
export const FRIENDS_COMMENT_PATH = 'page:friends';

/** Configured friends plus where approved applications come from (see src/lib/friends/load.ts). */
export const friendSources: FriendSources<FriendLink> = {
  configured: friendsData,
  serverURL: commentConfig.provider === 'waline' ? commentConfig.waline?.serverURL : undefined,
  path: FRIENDS_COMMENT_PATH,
  approvers: yamlConfig.friends?.approvers ?? [],
};

export const friendsIntro: FriendsIntro = yamlConfig.friends?.intro ?? {
  title: 'Friends',
  subtitle: '',
  applyTitle: 'Apply for friend link',
  applyDesc: 'Leave a comment with the following format',
};
