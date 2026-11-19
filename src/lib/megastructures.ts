/**
 * The megastructures that stand at the top of each section page, after the great works of
 * Stellaris. Each one's in-game purpose echoes what its page does, and each sits in the
 * part of the sky (see sky-catalog) that the page belongs to on the homepage.
 */

import type { SkyObject } from './sky-catalog';

export type MegaKind = 'sentry' | 'nexus' | 'dyson' | 'ringworld' | 'habitat' | 'decompressor' | 'assembly' | 'gateway';

/** Something the scene shows: a post, an album, a friend… */
export interface MegaItem {
  title: string;
  href?: string;
  /** Short second line: a date, a category, a host. */
  meta?: string;
  /** Accent colour for this item, e.g. a blog category. */
  color?: string;
}

type Text = { zh: string; en: string };

export interface MegaEntry {
  name: Text;
  /** One quiet line about what the structure does, and what the page does. */
  line: Text;
  /** Which part of the homepage sky it stands in; its galaxy shows faintly behind it. */
  sky: SkyObject;
}

export const MEGA_CATALOG: Record<MegaKind, MegaEntry> = {
  sentry: {
    name: { zh: '哨兵阵列', en: 'Sentry Array' },
    line: {
      zh: '它不眠不休地扫过整片星域，只为确认那些微弱的光还在原处。',
      en: 'It sweeps the whole sector without rest, only to confirm the faint lights are still where they were.',
    },
    sky: 'blogs',
  },
  nexus: {
    name: { zh: '科学枢纽', en: 'Science Nexus' },
    line: {
      zh: '每一条研究臂，都绕着同一个尚未解开的问题缓慢转动。',
      en: 'Every research arm turns slowly around the same unsolved question.',
    },
    sky: 'papers',
  },
  dyson: {
    name: { zh: '戴森球', en: 'Dyson Sphere' },
    line: {
      zh: '把一颗恒星的光一片片接住，像把深夜的念头一篇篇写下。总还缺几片，留给下一篇。',
      en: 'Catching a star’s light one panel at a time, the way late-night thoughts are written down one post at a time. A few panels are always missing, kept for the next one.',
    },
    sky: 'blogs',
  },
  ringworld: {
    name: { zh: '环形世界', en: 'Ring World' },
    line: {
      zh: '一整圈大地环抱着恒星，白昼沿着环慢慢走过；每一段，都住着一组照片。',
      en: 'A whole ring of land embraces its star and daylight walks slowly around it; each segment holds an album.',
    },
    sky: 'photos',
  },
  habitat: {
    name: { zh: '轨道栖息地', en: 'Orbital Habitat' },
    line: {
      zh: '日子在旋转的舱壁上亮起又熄灭。亮着灯的窗口，是被记下的那几天。',
      en: 'Days light up and go dark along its turning hull. The lit windows are the days that were written down.',
    },
    sky: 'moments',
  },
  decompressor: {
    name: { zh: '物质解压器', en: 'Matter Decompressor' },
    line: {
      zh: '从视界边缘一点点取出物质，也取出这些关于我的字句。',
      en: 'It draws matter out from the edge of the horizon, and with it, these words about me.',
    },
    sky: 'hole',
  },
  assembly: {
    name: { zh: '星际议会', en: 'Interstellar Assembly' },
    line: {
      zh: '每个文明在这里都有一席之地，你的也是。',
      en: 'Every civilisation has a seat here, and so do you.',
    },
    sky: 'moments',
  },
  gateway: {
    name: { zh: '星门', en: 'Gateway' },
    line: {
      zh: '星门的另一端，是别人的宇宙。',
      en: 'On the far side of the gate is someone else’s universe.',
    },
    sky: 'hole',
  },
};

/** A stable 0–1 value for a string, so an item keeps its place in a scene between visits. */
export function hashUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}
