/**
 * News on the homepage, told the way astronomers announce a new star: each item is a numbered
 * telegram (like The Astronomer's Telegram, ATel) and a nova in the opening sky that is brightest
 * when the news is fresh and fades back to an ordinary star over the following weeks.
 */

export interface NewsInput {
  id: string;
  date: Date;
  text: string;
  textEn?: string;
  href?: string;
  draft?: boolean;
}

export interface Telegram {
  /** Telegram number: 1 for the first piece of news ever posted; later news gets higher numbers. */
  number: number;
  /** Star id shared by the telegram row and its nova (the catalogue pairs them by it). */
  starId: string;
  date: Date;
  text: string;
  href?: string;
  external: boolean;
}

/** Telegrams (and novae) shown on the homepage: the newest few. */
export const TELEGRAMS_SHOWN = 3;

/**
 * Published news as telegrams, newest first. Numbers count every published item from the oldest,
 * so a telegram keeps its number when more news arrives. English falls back to the Chinese text.
 */
export function toTelegrams(entries: readonly NewsInput[], locale: string): Telegram[] {
  return entries
    .filter((entry) => !entry.draft)
    .sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id))
    .map((entry, index) => {
      const href = entry.href?.trim() || undefined;
      return {
        number: index + 1,
        starId: `news-${index + 1}`,
        date: entry.date,
        text: (locale === 'en' && entry.textEn?.trim()) || entry.text.trim(),
        href,
        external: Boolean(href && /^https?:\/\//.test(href)),
      };
    })
    .reverse();
}

/** Days for a nova's light to halve. */
export const NOVA_HALF_LIFE_DAYS = 10;
/** A faded nova stays a faint star, so it can still be found and pointed at. */
export const NOVA_FLOOR = 0.18;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How bright a nova is (1 = just flared, NOVA_FLOOR = an ordinary star again), from how long ago
 * its news was posted. Worked out in the browser, so it keeps fading between deploys.
 */
export function novaGlow(postedAt: number, now: number): number {
  const ageDays = Math.max(0, (now - postedAt) / DAY_MS);
  return Math.max(NOVA_FLOOR, 2 ** (-ageDays / NOVA_HALF_LIFE_DAYS));
}

/**
 * Where the novae sit in the opening view, newest first, in screen coordinates of the first camera
 * pose (x right, y up, -1…1): clear of the title, the star catalogue, the first galaxy and the
 * black hole on the horizon.
 */
export const NOVA_SLOTS: readonly (readonly [number, number])[] = [
  [0.52, 0.84],
  [0.86, 0.6],
  [0.1, 0.86],
];
