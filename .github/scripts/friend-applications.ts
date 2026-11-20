/**
 * Scheduled check for friend-link applications (run by .github/workflows/friend-applications.yml).
 *
 * The live site publishes the applications its last build included (/friends.json). This reads
 * the friends page's comments now, works out which applications are approved, and reports whether
 * the site is out of date. The workflow redeploys when it is; nothing is committed.
 *
 * Runs on Node's built-in TypeScript support, so it imports the shared module by its file name.
 */
import { appendFileSync } from 'node:fs';
import { type ApplicationComment, approvedApplications, friendKey, mergeFriends } from '../../src/lib/friends/applications.ts';

interface PublishedFriends {
  server: string | null;
  path: string;
  approvers: (number | string)[];
  commentsRead: boolean;
  configured: string[];
  applications: string[];
}

const SITE = process.env.SITE_URL ?? 'https://verapyuyi.github.io';

async function getJson<T>(url: URL | string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return (await response.json()) as T;
}

async function readComments(server: string, path: string): Promise<ApplicationComment[]> {
  const comments: ApplicationComment[] = [];
  for (let page = 1; page <= 10; page++) {
    const url = new URL('/api/comment', server);
    url.search = new URLSearchParams({
      path,
      page: String(page),
      pageSize: '100',
      sortBy: 'insertedAt_asc',
      lang: 'zh-CN',
    }).toString();
    const body = await getJson<{
      errno?: number;
      errmsg?: string;
      data?: { totalPages?: number; data?: ApplicationComment[] };
    }>(url);
    if (body.errno) throw new Error(`Waline error ${body.errno}: ${body.errmsg ?? ''}`);
    comments.push(...(body.data?.data ?? []));
    if (page >= (body.data?.totalPages ?? 1)) break;
  }
  return comments;
}

function report(stale: boolean, reason: string) {
  console.log(`${stale ? 'Out of date' : 'Up to date'}: ${reason}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `stale=${stale}\n`);
}

const published = await getJson<PublishedFriends>(new URL('/friends.json', SITE));
if (!published.server || published.approvers.length === 0) {
  report(false, 'the site does not take applications from comments');
} else {
  const comments = await readComments(published.server, published.path);
  const configured = published.configured.map((key) => ({ url: `https://${key}` }));
  const approved = approvedApplications(comments, published.approvers);
  const expected = mergeFriends(configured, approved)
    .slice(configured.length)
    .map((friend) => friendKey(friend.url))
    .sort();
  const live = [...published.applications].sort();
  const same = published.commentsRead && expected.length === live.length && expected.every((key, i) => key === live[i]);
  report(
    !same,
    same
      ? `${live.length} approved application(s) already live`
      : `approved now: [${expected.join(', ')}]; live: [${live.join(', ')}]${published.commentsRead ? '' : ' (last build could not read the comments)'}`,
  );
}
