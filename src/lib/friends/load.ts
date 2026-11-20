/**
 * Build-time friends list: the configured friends plus applications the owner approved in the
 * friends page's Waline comments (see ./applications.ts).
 *
 * Reading the comments must never break a build: if Waline cannot be reached, the configured
 * friends are used alone and the scheduled check (.github/scripts/friend-applications.ts) notices
 * the difference and rebuilds later.
 */

import { type ApplicationComment, approvedApplications, type FriendEntry, mergeFriends } from './applications';

export interface FriendSources<T extends FriendEntry> {
  /** Friends listed in config/site.yaml. */
  configured: readonly T[];
  /** Waline server URL; without one, only configured friends are used. */
  serverURL?: string;
  /** Waline comment path of the friends page. */
  path: string;
  /** Waline user ids whose reply approves an application. */
  approvers: readonly (number | string)[];
}

export interface LoadedFriends<T extends FriendEntry> {
  friends: (T | FriendEntry)[];
  /** Approved applications that were added on top of the configured friends. */
  applications: FriendEntry[];
  /** Whether the comments were read; false means the configured friends were used alone. */
  commentsRead: boolean;
}

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const TIMEOUT_MS = 8000;

interface WalinePage {
  totalPages?: number;
  data?: ApplicationComment[];
}

/** Every top-level comment (with its replies) on one Waline path. */
export async function fetchWalineComments(serverURL: string, path: string): Promise<ApplicationComment[]> {
  const comments: ApplicationComment[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = new URL('/api/comment', serverURL);
    url.search = new URLSearchParams({
      path,
      page: String(page),
      pageSize: String(PAGE_SIZE),
      sortBy: 'insertedAt_asc',
      lang: 'zh-CN',
    }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) throw new Error(`Waline answered ${response.status}`);
    const body = (await response.json()) as { errno?: number; errmsg?: string; data?: WalinePage } & WalinePage;
    if (body.errno) throw new Error(`Waline error ${body.errno}: ${body.errmsg ?? ''}`);
    const result: WalinePage = body.data && !Array.isArray(body.data) ? body.data : body;
    comments.push(...(result.data ?? []));
    if (page >= (result.totalPages ?? 1)) break;
  }
  return comments;
}

const loads = new Map<string, Promise<ApplicationComment[] | null>>();

/** One read of the comments per build, shared by every locale's friends page. */
function commentsOnce(serverURL: string, path: string): Promise<ApplicationComment[] | null> {
  const key = `${serverURL}\n${path}`;
  let load = loads.get(key);
  if (!load) {
    load = fetchWalineComments(serverURL, path).catch((error: unknown) => {
      console.warn(`[friends] Could not read friend applications from Waline; using configured friends only. ${error}`);
      return null;
    });
    loads.set(key, load);
  }
  return load;
}

export async function loadFriends<T extends FriendEntry>(sources: FriendSources<T>): Promise<LoadedFriends<T>> {
  const { configured, serverURL, path, approvers } = sources;
  if (!serverURL || approvers.length === 0) {
    return { friends: [...configured], applications: [], commentsRead: false };
  }
  const comments = await commentsOnce(serverURL, path);
  if (!comments) return { friends: [...configured], applications: [], commentsRead: false };
  const applications = mergeFriends<FriendEntry>(configured, approvedApplications(comments, approvers)).slice(
    configured.length,
  );
  return { friends: [...configured, ...applications], applications, commentsRead: true };
}
