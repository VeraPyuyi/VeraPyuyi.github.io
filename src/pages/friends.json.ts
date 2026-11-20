/**
 * The friends this build shipped, for the scheduled check (.github/scripts/friend-applications.ts):
 * it compares `applications` with the applications currently approved in the friends page's
 * comments and redeploys the site when they differ.
 */
import { friendSources } from '@constants/friends-config';
import { friendKey } from '@lib/friends/applications';
import { loadFriends } from '@lib/friends/load';

export async function GET() {
  const { applications, commentsRead } = await loadFriends(friendSources);
  const body = {
    server: friendSources.serverURL ?? null,
    path: friendSources.path,
    approvers: friendSources.approvers,
    commentsRead,
    configured: friendSources.configured.map((friend) => friendKey(friend.url)),
    applications: applications.map((friend) => friendKey(friend.url)),
  };
  return new Response(`${JSON.stringify(body, null, 2)}\n`, { headers: { 'Content-Type': 'application/json' } });
}
