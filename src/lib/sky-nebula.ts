/**
 * The nebulae behind the inner pages, as particles (pure: same environment, same sky).
 *
 * Built like the homepage galaxies: fine grains of light and soft puffs, laid down by fractal noise.
 * Every sky is modelled on a star-forming region, the Pillars of Creation in particular: glowing gas
 * in blue, white and pink (with one accent colour per page) and, rising through it, tall columns of
 * denser gas. The columns are crowds of particles, blue on their shaded flank and pink and white
 * where they face the light, with bright grains thick on the lit skin and the tips. Nothing is
 * dark: the whole sky is light. Each page keeps a signature feature of its own galaxy (planetary
 * rings, cirrus veils, a jet, the Milky Way, a supernova shell, far galaxies, spiked young stars).
 *
 * Particles live in a 1600 × 2600 field, taller than the screen so it can glide as the page
 * scrolls; the columns stand in the side margins, clear of the reading panel. The result is a flat
 * list in draw order, each particle x, y, radius, alpha and colour index; all of it adds light.
 */

import { createRandom, type Random } from './galaxy-flight/particles';
import type { SkyEnvironment } from './sky-catalog';

export const NEBULA_FIELD = { width: 1600, height: 2600 } as const;
export const NEBULA_STRIDE = 5;

export interface NebulaParticles {
  colors: string[];
  /** x, y, radius, alpha, colour index; NEBULA_STRIDE numbers per particle. */
  data: Float32Array;
}

type Spot = [x: number, y: number, rx: number, ry: number];

interface Feature {
  kind: 'cloud' | 'ring' | 'filament' | 'jet' | 'band';
  at: Spot;
  color: string;
  turn?: number;
  count: number;
}

interface Environment {
  /** Glowing gas: the base blue, white and pink, then the page's accent. */
  gas: string[];
  /** Light on the columns' lit flanks and tips. */
  rim: string;
  features: Feature[];
  sparkles?: number;
  galaxies?: number;
}

const WHITE = '#eef2ff';
const BLUE = '#7aa7ff';
const PINK = '#f58cc4';
const COLUMN_BLUE = '#8aa4ff';
const COLUMN_LILAC = '#c9a6f0';
const COLUMN_PINK = '#ffc4e4';

const ENVIRONMENTS: Record<SkyEnvironment, Environment> = {
  // M51: hydrogen glowing rose, the classic pillar sky.
  rose: { gas: [PINK, BLUE, WHITE, '#c084fc'], rim: '#ffd3ea', features: [] },
  // NGC 1300: blue reflection haze round spiked young stars, a little gold.
  gold: {
    gas: [BLUE, WHITE, PINK, '#f6c66a'],
    rim: '#ffecc8',
    features: [{ kind: 'cloud', at: [1480, 1250, 360, 300], color: '#9ad8ff', count: 3000 }],
    sparkles: 7,
  },
  // Hoag's Object: planetary nebulae, rings of gas round dying stars.
  ring: {
    gas: [BLUE, WHITE, PINK, '#3fd9c4'],
    rim: '#c6f6ff',
    features: [
      { kind: 'ring', at: [1450, 1250, 300, 300], color: '#5eead4', count: 4000 },
      { kind: 'cloud', at: [1450, 1250, 170, 170], color: '#bfdbfe', count: 1200 },
      { kind: 'ring', at: [150, 2050, 190, 190], color: '#f9a8d4', count: 2600 },
    ],
  },
  // The Small Magellanic Cloud: long cirrus veils between the columns.
  cloud: {
    gas: [BLUE, WHITE, PINK, '#a78bfa'],
    rim: '#e2d9ff',
    features: [
      { kind: 'filament', at: [170, 1300, 460, 150], color: '#a5f3fc', turn: 32, count: 4000 },
      { kind: 'filament', at: [1430, 2150, 460, 150], color: '#f9a8d4', turn: -28, count: 4000 },
    ],
  },
  // Sgr A*: the disk's blue and rose, and the jet fired from the hole's pole.
  disk: {
    gas: [BLUE, PINK, WHITE, '#8b8cf8'],
    rim: '#d3e2ff',
    features: [{ kind: 'jet', at: [1470, 1300, 60, 560], color: '#c7dcff', turn: 6, count: 4500 }],
  },
  // The star chart: the Milky Way crossing the sky.
  milkyway: {
    gas: [BLUE, WHITE, PINK, '#fde68a'],
    rim: '#fff1d6',
    features: [
      { kind: 'band', at: [800, 1300, 1700, 220], color: '#dbe4ff', turn: 62, count: 9000 },
      { kind: 'band', at: [800, 1300, 1500, 100], color: '#fde68a', turn: 62, count: 3000 },
    ],
  },
  // The pulsar: the torn shell of the supernova that made it.
  remnant: {
    gas: [BLUE, PINK, WHITE, '#f87171'],
    rim: '#ffd0d0',
    features: [
      { kind: 'ring', at: [1450, 1250, 360, 340], color: '#fb7185', count: 5000 },
      { kind: 'cloud', at: [1450, 1250, 250, 240], color: '#5eead4', count: 1800 },
    ],
  },
  // The Local Group: far galaxies scattered between the columns.
  group: { gas: [BLUE, WHITE, PINK, '#a78bfa'], rim: '#e6dcff', features: [], galaxies: 22 },
};

/** Smooth fractal value noise in about [0, 1], seeded. */
function createNoise(seed: number) {
  const hash = (x: number, y: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const value = (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const top = hash(ix, iy) + (hash(ix + 1, iy) - hash(ix, iy)) * u;
    const bottom = hash(ix, iy + 1) + (hash(ix + 1, iy + 1) - hash(ix, iy + 1)) * u;
    return top + (bottom - top) * v;
  };
  return (x: number, y: number) => {
    let sum = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let octave = 0; octave < 5; octave++) {
      sum += amplitude * value(x * frequency, y * frequency);
      frequency *= 2.03;
      amplitude *= 0.5;
    }
    return sum / 0.97;
  };
}

type Noise = ReturnType<typeof createNoise>;
const smooth = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

interface Sink {
  add(x: number, y: number, r: number, alpha: number, color: string): void;
}

function createSink(): Sink & { build(): NebulaParticles } {
  const colors: string[] = [];
  const index = new Map<string, number>();
  const data: number[] = [];
  return {
    add(x, y, r, alpha, color) {
      let at = index.get(color);
      if (at === undefined) {
        at = colors.length;
        colors.push(color);
        index.set(color, at);
      }
      data.push(x, y, r, alpha, at);
    },
    build: () => ({ colors, data: Float32Array.from(data) }),
  };
}

/** Light particles: mostly fine grains, some soft puffs, as in the galaxy models. */
function emit(sink: Sink, random: Random, x: number, y: number, color: string, weight: number) {
  if (random.next() < 0.6) sink.add(x, y, random.between(0.7, 2.1), random.between(0.1, 0.32) * weight, color);
  else sink.add(x, y, random.between(8, 30), random.between(0.03, 0.075) * weight, color);
}

/**
 * Gas inside an ellipse, laid down where the noise is dense. `ring` keeps a band round the edge,
 * `filament` and `jet` keep the noise's ridges (veils, shock fronts).
 */
function gas(sink: Sink, random: Random, noise: Noise, feature: Feature) {
  const [cx, cy, rx, ry] = feature.at;
  const turn = ((feature.turn ?? 0) * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const veined = feature.kind === 'filament' || feature.kind === 'jet';
  const scale = veined ? 0.012 : 0.006;
  let placed = 0;
  for (let tries = 0; placed < feature.count && tries < feature.count * 14; tries++) {
    const u = random.between(-1, 1);
    const v = random.between(-1, 1);
    const radius = Math.hypot(u, v);
    if (radius > 1) continue;
    const shape = feature.kind === 'ring' ? smooth(0.5, 0.78, radius) * (1 - smooth(0.82, 1, radius)) : 1 - radius * radius;
    const x = cx + u * rx * cos - v * ry * sin;
    const y = cy + u * rx * sin + v * ry * cos;
    const n = noise(x * scale, y * scale);
    const density = veined ? (1 - Math.abs(n * 2 - 1)) ** 4 : smooth(0.38, 0.72, n);
    if (random.next() > shape * density) continue;
    placed++;
    emit(sink, random, x, y, feature.color, feature.kind === 'jet' ? 1.4 : 1);
  }
}

/**
 * A group of two or three columns rising from `base` in one margin, leaning a little towards the
 * page and lit from its side. Bright grains crowd the lit flank, the tops and the tips, with a halo
 * boiling off them. Returns where the brightest gas behind them sits.
 */
function pillars(
  glow: Sink,
  random: Random,
  noise: Noise,
  [side, base]: ['left' | 'right', number],
  rim: string,
  palette: string[],
): [number, number] {
  const skin = [rim, '#ffffff', palette[0], palette[1], rim];
  const body = [COLUMN_BLUE, COLUMN_LILAC, COLUMN_PINK];
  const toward = side === 'left' ? 1 : -1;
  const anchor = side === 'left' ? random.between(70, 150) : random.between(1450, 1530);
  const count = random.next() < 0.5 ? 2 : 3;
  let light: [number, number] = [anchor, base - 500];
  for (let column = 0; column < count; column++) {
    const tall = column === 1 || count === 2 ? 1 : 0.68;
    const height = random.between(560, 780) * tall;
    const width = random.between(90, 140) * (0.75 + 0.25 * tall);
    const x0 = anchor + toward * (column * random.between(90, 125) - 40);
    const lean = toward * random.between(0.06, 0.18);
    const phase = random.between(0, Math.PI * 2);
    const head = width * 0.45;
    const spine = (t: number) =>
      x0 + lean * height * Math.min(t, 1) ** 1.3 + Math.sin(Math.min(t, 1) * 4.2 + phase) * width * 0.18;
    // Half-width: a tapering, wavering trunk, then a round head above t = 1.
    const half = (t: number) => {
      if (t <= 1) return (width / 2) * (1.25 - 0.55 * t) * (1 + 0.12 * Math.sin(t * 9 + phase * 1.7));
      const above = ((t - 1) * height) / head;
      return above >= 1 ? -1 : width * 0.35 * Math.sqrt(1 - above * above);
    };
    const top = base - height - head;
    if (tall === 1) light = [spine(1) + toward * 60, top + 120];
    const samples = Math.round(height * width * 0.16);
    for (let index = 0; index < samples; index++) {
      const y = random.between(top - 20, base + 40);
      const t = (base - y) / height;
      const cx = spine(t);
      const x = cx + random.between(-1, 1) * width * 1.1;
      // Ragged edge: the noise pushes the outline in and out.
      const edge = Math.abs(x - cx) - half(t) + (noise(x * 0.018, y * 0.018) - 0.5) * width * 0.9;
      const fade = smooth(base + 60, base - 280, y);
      const lit = (x - cx) * toward > -width * 0.1 || t > 0.97;
      if (edge < 0) {
        // The column is a dense cloud of light: blue on the shaded flank, lilac through the middle,
        // pink and white where it faces the stars that light it. Brightness rises towards the lit
        // side, so it reads as a lit volume rather than a flat shape.
        const shade = Math.max(-1, Math.min(1, ((x - cx) * toward) / Math.max(8, half(t))));
        const tone = shade < -0.2 ? body[0] : shade < 0.45 ? body[1] : body[2];
        const bright = 0.55 + 0.45 * (shade + 1) * 0.5;
        glow.add(x, y, random.between(8, 18), random.between(0.05, 0.1) * bright * fade, tone);
        glow.add(
          x + random.normal() * 4,
          y + random.normal() * 4,
          random.between(0.7, 2),
          random.between(0.14, 0.36) * bright * fade,
          tone,
        );
        // The lit skin: dense bright grains where starlight eats into the column.
        if (lit && edge > -16 * (1 + noise(y * 0.03, x * 0.03))) {
          for (let grain = 0; grain < 3; grain++) {
            const gx = x + random.normal() * 3;
            const gy = y + random.normal() * 3;
            glow.add(
              gx,
              gy,
              random.between(0.6, 1.7),
              random.between(0.3, 0.7) * fade,
              skin[Math.floor(random.next() * skin.length)],
            );
          }
        }
      } else if (lit && edge < 26) {
        // Gas boiling off the lit flank.
        glow.add(x, y, random.between(6, 18), random.between(0.03, 0.07) * fade, skin[Math.floor(random.next() * skin.length)]);
      }
    }
    // Bright tips where young stars switch on.
    const tipX = spine(1);
    const tipY = base - height - head * 0.6;
    for (let index = 0; index < 220; index++) {
      const angle = random.between(0, Math.PI * 2);
      const r = Math.abs(random.normal()) * width * 0.35;
      glow.add(
        tipX + Math.cos(angle) * r,
        tipY + Math.sin(angle) * r * 0.8,
        random.between(0.6, 1.8),
        random.between(0.25, 0.7),
        '#ffffff',
      );
    }
    glow.add(tipX, tipY, width * 0.9, 0.12, rim);
    glow.add(tipX + random.between(-8, 8), tipY + random.between(0, 14), 2.6, 1, '#ffffff');
  }
  return light;
}

/** A far galaxy: a small two-armed spiral of grains round a warm core. */
function farGalaxy(sink: Sink, random: Random, x: number, y: number) {
  const size = random.between(10, 26);
  const tilt = random.between(0.3, 0.75);
  const turn = random.between(0, Math.PI);
  for (let index = 0; index < 160; index++) {
    const angle = (index % 2) * Math.PI + random.next() * 4.2 + random.normal() * 0.25;
    const r = size * random.next();
    const px = Math.cos(angle) * r;
    const py = Math.sin(angle) * r * tilt;
    const gx = x + px * Math.cos(turn) - py * Math.sin(turn);
    const gy = y + px * Math.sin(turn) + py * Math.cos(turn);
    sink.add(gx, gy, random.between(0.5, 1.2), random.between(0.2, 0.5), '#c7d2fe');
  }
  sink.add(x, y, size * 0.5, 0.25, '#fff1d6');
}

/** A bright young star with diffraction spikes, drawn as rows of grains. */
function sparkle(sink: Sink, random: Random, x: number, y: number) {
  const length = random.between(26, 60);
  for (let step = 1; step < 34; step++) {
    const d = (step / 34) * length;
    const alpha = 0.7 * (1 - step / 34) ** 1.6;
    for (const [dx, dy] of [
      [d, 0],
      [-d, 0],
      [0, d],
      [0, -d],
    ]) {
      sink.add(x + dx, y + dy, 1, alpha, '#fff8e6');
    }
  }
  sink.add(x, y, length * 0.35, 0.18, '#dbe7ff');
  sink.add(x, y, 2.8, 1, '#ffffff');
}

/** Where the columns stand: alternating margins down the field. */
const PILLAR_BASES: ReadonlyArray<['left' | 'right', number]> = [
  ['left', 1020],
  ['right', 1820],
  ['left', 2600],
];

/**
 * The particles of a page's nebula, in draw order. `columns: false` leaves out the columns
 * (phones, where the reading panel covers the margins); `share` thins every cloud.
 */
export function nebulaParticles(env: SkyEnvironment, options: { columns?: boolean; share?: number } = {}): NebulaParticles {
  const { columns = true, share = 1 } = options;
  const { gas: palette, rim, features, sparkles = 0, galaxies = 0 } = ENVIRONMENTS[env];
  const random = createRandom(env.length * 977 + rim.charCodeAt(2) * 13);
  const noise = createNoise(env.length * 31 + rim.charCodeAt(3));
  const light = createSink();
  const glow = createSink();
  const cloud = (at: Spot, color: string, count: number): Feature => ({
    kind: 'cloud',
    at,
    color,
    count: Math.round(count * share),
  });

  const lights = columns ? PILLAR_BASES.map((place) => pillars(glow, random, noise, place, rim, palette)) : [];
  // Glowing gas: a haze down both margins, and a bright bloom behind every column group.
  for (let index = 0; index < 8; index++) {
    gas(
      light,
      random,
      noise,
      cloud([index % 2 ? 1500 : 100, 160 + index * 320, 470, 360], palette[index % palette.length], 2600),
    );
  }
  lights.forEach(([x, y], index) => {
    gas(light, random, noise, cloud([x, y, 380, 460], palette[(index + 2) % palette.length], 3600));
    gas(light, random, noise, cloud([x - 40 * (index % 2 ? -1 : 1), y + 120, 300, 340], palette[index % 2], 2600));
    gas(light, random, noise, cloud([x, y - 40, 210, 250], WHITE, 1500));
  });
  for (const feature of features) {
    const scaled = { ...feature, count: Math.round(feature.count * share) };
    gas(light, random, noise, scaled);
  }
  for (let index = 0; index < galaxies; index++) {
    const x = random.next() < 0.5 ? random.between(30, 430) : random.between(1170, 1570);
    farGalaxy(light, random, x, random.between(60, 2540));
  }
  for (let index = 0; index < sparkles; index++) {
    sparkle(glow, random, index % 2 ? random.between(1180, 1560) : random.between(40, 420), random.between(150, 2450));
  }

  // The gas first, then the columns, their lit skins, tips and stars on top.
  const parts = [light.build(), glow.build()];
  const colors: string[] = [];
  const data = new Float32Array(parts.reduce((sum, part) => sum + part.data.length, 0));
  let offset = 0;
  for (const part of parts) {
    const remap = part.colors.map((color) => {
      if (!colors.includes(color)) colors.push(color);
      return colors.indexOf(color);
    });
    data.set(part.data, offset);
    for (let index = offset + 4; index < offset + part.data.length; index += NEBULA_STRIDE) data[index] = remap[data[index]];
    offset += part.data.length;
  }
  return { colors, data };
}

/** Three layers of stars as box-shadows, spread deeper than the screen so they can glide on scroll. */
export function starLayers(env: SkyEnvironment): { depth: number; shadow: string }[] {
  const random = createRandom(env.length * 131 + 7);
  const layer = (count: number, size: [number, number], alpha: [number, number], blur: number, depth: number) =>
    Array.from({ length: count }, () => {
      const a = random.between(alpha[0], alpha[1]).toFixed(2);
      const color = random.next() < 0.2 ? `rgb(255 222 190 / ${a})` : `rgb(225 232 255 / ${a})`;
      const at = `${random.between(0, 100).toFixed(2)}vw ${random.between(0, 100 + depth).toFixed(2)}vh`;
      return `${at} ${blur}px ${random.between(size[0], size[1]).toFixed(1)}px ${color}`;
    }).join(',');
  return [
    { depth: 25, shadow: layer(300, [0, 0.4], [0.25, 0.6], 0, 25) },
    { depth: 45, shadow: layer(110, [0.4, 0.9], [0.45, 0.85], 1, 45) },
    { depth: 70, shadow: layer(26, [0.8, 1.4], [0.75, 1], 3, 70) },
  ];
}
