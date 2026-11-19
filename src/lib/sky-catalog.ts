/**
 * The site's star atlas: each section of the blog belongs to one object on the homepage
 * route, described the way an observatory plate would note it. Pages use it for their
 * header caption, and posts measure their age in light-days.
 */

export type SkyObject = 'blogs' | 'papers' | 'photos' | 'moments' | 'hole';

type Text = { zh: string; en: string };

export interface SkyEntry {
  /** Index of the stop on the homepage flight. */
  stop: number;
  /** Catalogue designation, kept in Latin script in every language. */
  catalog: string;
  name: Text;
  kind: Text;
  constellation: Text;
  distance: Text;
  /** Small eyepiece view of the object, rendered from the homepage scene. */
  image: string;
}

export const SKY_CATALOG: Record<SkyObject, SkyEntry> = {
  blogs: {
    stop: 0,
    catalog: 'M51',
    name: { zh: '涡状星系', en: 'Whirlpool Galaxy' },
    kind: { zh: '宏象旋涡星系', en: 'grand-design spiral' },
    constellation: { zh: '猎犬座', en: 'Canes Venatici' },
    distance: { zh: '约 3100 万光年', en: '~31 million light-years' },
    image: '/img/sky/blogs.webp',
  },
  papers: {
    stop: 1,
    catalog: 'NGC 1300',
    name: { zh: 'NGC 1300', en: 'NGC 1300' },
    kind: { zh: '棒旋星系', en: 'barred spiral' },
    constellation: { zh: '波江座', en: 'Eridanus' },
    distance: { zh: '约 6100 万光年', en: '~61 million light-years' },
    image: '/img/sky/papers.webp',
  },
  photos: {
    stop: 2,
    catalog: 'PGC 54559',
    name: { zh: '霍格天体', en: 'Hoag’s Object' },
    kind: { zh: '环状星系', en: 'ring galaxy' },
    constellation: { zh: '巨蛇座', en: 'Serpens' },
    distance: { zh: '约 6 亿光年', en: '~600 million light-years' },
    image: '/img/sky/photos.webp',
  },
  moments: {
    stop: 3,
    catalog: 'NGC 292',
    name: { zh: '小麦哲伦云', en: 'Small Magellanic Cloud' },
    kind: { zh: '不规则矮星系', en: 'dwarf irregular' },
    constellation: { zh: '杜鹃座', en: 'Tucana' },
    distance: { zh: '约 20 万光年', en: '~200,000 light-years' },
    image: '/img/sky/moments.webp',
  },
  hole: {
    stop: 4,
    catalog: 'Sgr A*',
    name: { zh: '人马座 A*', en: 'Sagittarius A*' },
    kind: { zh: '超大质量黑洞', en: 'supermassive black hole' },
    constellation: { zh: '人马座', en: 'Sagittarius' },
    distance: { zh: '约 2.6 万光年', en: '~26,000 light-years' },
    image: '/img/sky/hole.webp',
  },
};

/** One line of the plate, e.g. "NGC 1300 · 棒旋星系 · 波江座 · 约 6100 万光年". */
export function plateLine(object: SkyObject, locale: string): string {
  const entry = SKY_CATALOG[object];
  const lang = locale === 'en' ? 'en' : 'zh';
  const name = entry.name[lang] === entry.catalog ? [] : [entry.name[lang]];
  return [entry.catalog, ...name, entry.kind[lang], entry.constellation[lang], entry.distance[lang]].join(' · ');
}

/** Homepage address that flies to `object` (or to one star in it, by its galaxy item id). */
export function skyHash(object: SkyObject, starId?: string): string {
  return starId ? `#star=${encodeURIComponent(starId)}` : `#sky=${object}`;
}

/** Reads a homepage deep link: `#sky=papers` or `#star=blog-some-post`. */
export function parseSkyHash(hash: string): { sky?: SkyObject; star?: string } {
  const match = /^#(sky|star)=(.+)$/.exec(hash);
  if (!match) return {};
  const value = decodeURIComponent(match[2]);
  if (match[1] === 'star') return { star: value };
  return value in SKY_CATALOG ? { sky: value as SkyObject } : {};
}

export const AU_PER_LIGHT_DAY = 173.1446;

/** Whole light-days a piece's light has travelled since `published`. Never negative. */
export function lightDays(published: Date | number, now: number = Date.now()): number {
  const start = typeof published === 'number' ? published : published.getTime();
  return Math.max(0, Math.floor((now - start) / 86_400_000));
}
