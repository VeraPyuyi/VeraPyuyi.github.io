/**
 * Particle buffers and the small amount of randomness the galaxy models need.
 *
 * Every particle is stored in cylindrical form — (radius, angle, height) around the
 * owning object's spin axis — so the renderer can turn a whole galaxy on the GPU by
 * adding one angle, and the CPU can place a clickable star with the same formula.
 */

export type Rgb = readonly [number, number, number];

/** Packed, upload-ready particles. Index order is shuffled so any prefix is a fair subsample. */
export interface ParticleSet {
  count: number;
  /** (radius, angle, height) triplets in the object's own units. */
  polar: Float32Array;
  /** Linear RGB, already multiplied by brightness (or, for dust, by opacity). */
  color: Float32Array;
  /** Sprite diameter in the object's own units. */
  size: Float32Array;
  /** Uniform 0–1 value used for twinkling and drift. */
  phase: Float32Array;
}

export interface Random {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  between(min: number, max: number): number;
  /** Standard normal sample. */
  normal(): number;
  /** Exponentially distributed sample with the given scale. */
  exponential(scale: number): number;
}

/** Deterministic generator (mulberry32) so a galaxy looks the same on every visit. */
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    between: (min, max) => min + (max - min) * next(),
    normal: () => {
      const u = 1 - next();
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    exponential: (scale) => -scale * Math.log(1 - next()),
  };
}

export const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Star colours in linear RGB, from old red giants to hot young clusters and glowing hydrogen. */
export const STAR = {
  old: [1, 0.72, 0.46],
  warm: [1, 0.86, 0.68],
  white: [1, 0.96, 0.92],
  young: [0.56, 0.72, 1],
  hot: [0.44, 0.6, 1],
  hydrogen: [1, 0.3, 0.56],
  rose: [1, 0.6, 0.78],
  violet: [0.72, 0.56, 1],
  teal: [0.46, 0.86, 0.94],
} as const satisfies Record<string, Rgb>;

/** Dust absorbs blue light more than red, so lanes look brown against starlight. */
export const DUST: Rgb = [0.5, 0.62, 0.8];

export interface ParticleBuilder {
  readonly count: number;
  /** Adds a particle at cartesian (x, y, z); y is the spin axis. */
  add(x: number, y: number, z: number, color: Rgb, brightness: number, size: number): void;
  /** Freezes the particles into typed arrays, shuffled with `random`. */
  build(random: Random): ParticleSet;
}

export function createParticleBuilder(): ParticleBuilder {
  const values: number[] = [];
  const STRIDE = 8;
  return {
    get count() {
      return values.length / STRIDE;
    },
    add(x, y, z, color, brightness, size) {
      if (![x, y, z, brightness, size].every(Number.isFinite)) return;
      values.push(
        Math.hypot(x, z),
        Math.atan2(z, x),
        y,
        color[0] * brightness,
        color[1] * brightness,
        color[2] * brightness,
        size,
        0,
      );
    },
    build(random) {
      const count = values.length / STRIDE;
      const order = Array.from({ length: count }, (_, index) => index);
      for (let index = count - 1; index > 0; index--) {
        const swap = Math.floor(random.next() * (index + 1));
        [order[index], order[swap]] = [order[swap], order[index]];
      }
      const set: ParticleSet = {
        count,
        polar: new Float32Array(count * 3),
        color: new Float32Array(count * 3),
        size: new Float32Array(count),
        phase: new Float32Array(count),
      };
      order.forEach((source, target) => {
        const at = source * STRIDE;
        set.polar.set([values[at], values[at + 1], values[at + 2]], target * 3);
        set.color.set([values[at + 3], values[at + 4], values[at + 5]], target * 3);
        set.size[target] = values[at + 6];
        set.phase[target] = random.next();
      });
      return set;
    },
  };
}
