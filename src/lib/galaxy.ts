/**
 * Pure geometry and calendar helpers for the homepage "four galaxies" hub.
 *
 * Every galaxy is drawn face-on in a unit square; positions are returned in
 * units of the galaxy radius around its centre so the canvas painter and the
 * clickable star links share exactly one source of truth.
 */

export type GalaxyKind = 'blogs' | 'papers' | 'photos' | 'moments';

export interface GalaxyItem {
  id: string;
  href: string;
  title: string;
  /** ISO date (YYYY-MM-DD) used for ordering along an arm. */
  date: string;
  /** Sub-group inside a galaxy, e.g. a blog category. Decides the arm. */
  group?: string;
}

export interface PlacedGalaxyItem extends GalaxyItem {
  /** Position inside the galaxy square, 0–100 (%). */
  x: number;
  y: number;
  newest: boolean;
}

/** Centres of the irregular galaxy's clumps, in units of the radius. */
export const MOMENT_CLUMPS: ReadonlyArray<readonly [number, number]> = [
  [-0.28, -0.1],
  [0.16, 0.14],
  [0.34, -0.26],
  [-0.1, 0.34],
  [0.04, -0.06],
];

/**
 * A point on a galaxy's structure for parameter `t` in [0, 1].
 * `arm` selects the spiral arm (0 or 1) or, for the irregular galaxy, a clump index.
 */
export function galaxyPoint(kind: GalaxyKind, arm: number, t: number): [number, number] {
  if (kind === 'moments') {
    const clump = MOMENT_CLUMPS[((arm % MOMENT_CLUMPS.length) + MOMENT_CLUMPS.length) % MOMENT_CLUMPS.length];
    return [clump[0], clump[1]];
  }
  let radius: number;
  let angle: number;
  if (kind === 'blogs') {
    // Logarithmic spiral (pitch ≈ 20°): tightly wound by the core, opening outward, like M51.
    radius = 0.1 + 0.88 * t;
    angle = arm * Math.PI + 2.7 * Math.log(radius / 0.1);
  } else if (kind === 'papers') {
    // Arms leave the ends of the bar and sweep about half a turn, as in NGC 1300.
    radius = 0.42 + 0.56 * t;
    angle = arm * Math.PI + t * 1.1 * Math.PI;
  } else {
    radius = 0.74;
    angle = t * 2 * Math.PI;
  }
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

function toPercent([x, y]: [number, number]): { x: number; y: number } {
  return { x: Number((50 + x * 46).toFixed(2)), y: Number((50 + y * 46).toFixed(2)) };
}

/** Spreads `count` items evenly over [from, to]; a single item sits at the midpoint. */
function spread(index: number, count: number, from: number, to: number): number {
  if (count <= 1) return (from + to) / 2;
  return from + ((to - from) * index) / (count - 1);
}

/**
 * Places items on their galaxy. Items are sorted oldest → newest so a galaxy
 * grows outward over time; the newest item is flagged.
 * Blogs: the first group (e.g. "inspirations") rides arm 0, every other group arm 1.
 */
export function placeGalaxyItems(kind: GalaxyKind, items: readonly GalaxyItem[]): PlacedGalaxyItem[] {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const newestId = sorted.at(-1)?.id;
  const groups = [...new Set(sorted.map((item) => item.group ?? ''))];

  return sorted.map((item, index) => {
    let point: [number, number];
    if (kind === 'blogs') {
      const arm = groups.indexOf(item.group ?? '') === 0 ? 0 : 1;
      const onArm = sorted.filter((other) => (groups.indexOf(other.group ?? '') === 0 ? 0 : 1) === arm);
      point = galaxyPoint('blogs', arm, spread(onArm.indexOf(item), onArm.length, arm === 0 ? 0.16 : 0.45, 0.96));
    } else if (kind === 'papers') {
      point = galaxyPoint('papers', index % 2, spread(index, sorted.length, 0.08, 0.9));
    } else if (kind === 'photos') {
      point = galaxyPoint('photos', 0, (0.86 + index / Math.max(1, sorted.length)) % 1);
    } else {
      point = galaxyPoint('moments', 2 + index, 0);
    }
    return { ...item, ...toPercent(point), newest: item.id === newestId };
  });
}

export const MOON_PHASE_NAMES = ['新月', '蛾眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'] as const;
export const MOON_PHASE_NAMES_EN = [
  'New moon',
  'Waxing crescent',
  'First quarter',
  'Waxing gibbous',
  'Full moon',
  'Waning gibbous',
  'Last quarter',
  'Waning crescent',
] as const;

const SYNODIC_MONTH_DAYS = 29.530588853;
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

/** Moon phase for a timestamp: `phase` in [0, 1) (0 = new, 0.5 = full), an index into the name tables, and the lit fraction. */
export function moonPhase(time: number): { phase: number; index: number; illumination: number } {
  const days = (time - REFERENCE_NEW_MOON) / 86_400_000;
  const phase = (((days % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS) / SYNODIC_MONTH_DAYS;
  return {
    phase,
    index: Math.floor(phase * 8 + 0.5) % 8,
    illumination: (1 - Math.cos(2 * Math.PI * phase)) / 2,
  };
}

export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

/** Part of the day for a local hour (0–23). */
export function dayPart(hour: number): DayPart {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 23) return 'evening';
  return 'night';
}

/** "84 天 12 时 26 分 19 秒" / "84d 12h 26m 19s" for a non-negative duration. */
export function formatUptime(milliseconds: number, locale: string): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const pad = (value: number) => String(value).padStart(2, '0');
  const days = Math.floor(total / 86_400);
  const hours = pad(Math.floor((total % 86_400) / 3600));
  const minutes = pad(Math.floor((total % 3600) / 60));
  const seconds = pad(total % 60);
  return locale === 'en' ? `${days}d ${hours}h ${minutes}m ${seconds}s` : `${days} 天 ${hours} 时 ${minutes} 分 ${seconds} 秒`;
}
