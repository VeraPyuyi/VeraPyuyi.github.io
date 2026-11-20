/**
 * Friend-link applications left in the friends page's comments.
 *
 * A visitor pastes the YAML block the page generates (site, url, owner, desc, image, color) as a
 * comment. The site owner approves it by replying to that comment; approved applications join the
 * friends configured in `config/site.yaml`, without anyone editing the config.
 *
 * Everything here is pure, so the build (src/lib/friends/load.ts) and the scheduled check that
 * decides when to rebuild (.github/scripts/friend-applications.ts) share it. It imports nothing.
 */

export interface FriendEntry {
  site: string;
  url: string;
  owner: string;
  desc: string;
  image: string;
  color?: string;
}

/** The parts of a Waline comment this module reads. */
export interface ApplicationComment {
  /** Markdown as typed by the commenter. */
  orig?: string;
  /** Rendered HTML, used when `orig` is missing. */
  comment?: string;
  user_id?: number | string | null;
  time?: number;
  insertedAt?: string;
  children?: ApplicationComment[];
}

const FIELDS = ['site', 'url', 'owner', 'desc', 'image', 'color'] as const;
type Field = (typeof FIELDS)[number];

const LIMITS: Record<Field, number> = { site: 60, url: 300, owner: 40, desc: 140, image: 500, color: 9 };
const DEFAULT_COLOR = '#ffc0cb';

/** Opening/closing quote pairs people paste: straight, curly, and CJK corner brackets. */
const QUOTES: [string, string][] = [
  ['"', '"'],
  ["'", "'"],
  ['“', '”'],
  ['‘', '’'],
  ['「', '」'],
];

function unquote(raw: string): string {
  let value = raw.trim();
  for (const [open, close] of QUOTES) {
    if (value.length >= 2 && value.startsWith(open) && value.endsWith(close)) return value.slice(1, -1).trim();
  }
  // An unquoted YAML value may carry a trailing comment.
  value = value.replace(/\s+#.*$/, '');
  return value.trim();
}

/** Turns rendered comment HTML back into text, for comments without `orig`. */
function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** A markdown link `[text](url)` or autolink `<url>` reduced to the bare URL. */
function bareUrl(value: string): string {
  const markdown = /^\[[^\]]*\]\(([^)\s]+)\)$/.exec(value);
  if (markdown) return markdown[1];
  const auto = /^<([^>\s]+)>$/.exec(value);
  return auto ? auto[1] : value;
}

function httpUrl(value: string): string | null {
  try {
    const url = new URL(bareUrl(value));
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Reads one application out of a comment's text. Returns null unless it names a site and an
 * http(s) URL; other fields are optional, trimmed to sensible lengths, and sanitised.
 */
export function parseApplication(text: string): FriendEntry | null {
  const found: Partial<Record<Field, string>> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(?:-\s*)?(site|url|owner|desc|image|color)\s*[:：]\s*(.*)$/i.exec(line);
    if (!match) continue;
    const field = match[1].toLowerCase() as Field;
    if (found[field] !== undefined) continue;
    found[field] = unquote(match[2]).slice(0, LIMITS[field]);
  }

  const site = found.site?.trim();
  const url = found.url ? httpUrl(found.url) : null;
  if (!site || !url) return null;

  const image = found.image ? (httpUrl(found.image) ?? '') : '';
  const color = found.color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(found.color) ? found.color : DEFAULT_COLOR;
  return { site, url, owner: found.owner?.trim() || site, desc: found.desc?.trim() ?? '', image, color };
}

/** Identity of a friend's site: host without `www.`, plus path without a trailing slash. */
export function friendKey(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host.replace(/^www\./, '').toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return url.trim().toLowerCase();
  }
}

const commentText = (comment: ApplicationComment) => comment.orig ?? htmlToText(comment.comment ?? '');
const commentTime = (comment: ApplicationComment) => comment.time ?? (comment.insertedAt ? Date.parse(comment.insertedAt) : 0);

/**
 * Applications the owner has approved, oldest first: top-level comments that parse as an
 * application and have a reply from one of `approvers` (Waline user ids).
 */
export function approvedApplications(
  comments: readonly ApplicationComment[],
  approvers: readonly (number | string)[],
): FriendEntry[] {
  const owners = new Set(approvers.map(String));
  const approvedBy = (comment: ApplicationComment) =>
    (comment.children ?? []).some((reply) => reply.user_id != null && owners.has(String(reply.user_id)));

  const seen = new Set<string>();
  const entries: FriendEntry[] = [];
  for (const comment of [...comments].sort((a, b) => commentTime(a) - commentTime(b))) {
    if (!approvedBy(comment)) continue;
    const entry = parseApplication(commentText(comment));
    if (!entry) continue;
    const key = friendKey(entry.url);
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }
  return entries;
}

/** Configured friends first, then approved applications for sites not already listed. */
export function mergeFriends<T extends { url: string }>(configured: readonly T[], applications: readonly T[]): T[] {
  const keys = new Set(configured.map((friend) => friendKey(friend.url)));
  return [...configured, ...applications.filter((friend) => !keys.has(friendKey(friend.url)))];
}
