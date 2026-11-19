/**
 * Particle models of the four homepage galaxies, in units of the galaxy radius.
 *
 * Each model borrows the structure of the real galaxy it is named after, and its arms,
 * bar, ring or clumps follow `galaxyPoint` from `@/lib/galaxy`, the same curves that
 * place the clickable post stars, so every post sits on a real arm.
 */

import { type GalaxyKind, galaxyPoint, MOMENT_CLUMPS } from '../galaxy';
import {
  createParticleBuilder,
  createRandom,
  DUST,
  mixRgb,
  type ParticleBuilder,
  type ParticleSet,
  type Random,
  type Rgb,
  STAR,
} from './particles';

export interface GalaxyModel {
  /** Stars and glowing gas, drawn additively. */
  light: ParticleSet;
  /** Dust, drawn as absorption on top of the light. */
  dust: ParticleSet;
}

type Vec3 = readonly [number, number, number];

interface Brush {
  light: ParticleBuilder;
  dust: ParticleBuilder;
  random: Random;
}

/** Colour, brightness and sprite size for one particle. */
type Look = readonly [Rgb, number, number];

const SEEDS: Record<GalaxyKind, number> = { blogs: 5194, papers: 1300, photos: 1950, moments: 292 };

/** A point at `distance` in a random direction, stretched by `spread` on each axis. */
function blob(brush: Brush, count: number, at: Vec3, spread: Vec3, look: (random: Random) => Look, centred = false) {
  const { random } = brush;
  for (let index = 0; index < count; index++) {
    let dx: number;
    let dy: number;
    let dz: number;
    if (centred) {
      // Exponential radial profile: a bright, concentrated core like a bulge or a globular cluster.
      const radius = random.exponential(1);
      const cosine = random.between(-1, 1);
      const sine = Math.sqrt(1 - cosine * cosine);
      const angle = random.between(0, Math.PI * 2);
      dx = radius * sine * Math.cos(angle);
      dy = radius * cosine;
      dz = radius * sine * Math.sin(angle);
    } else {
      dx = random.normal();
      dy = random.normal();
      dz = random.normal();
    }
    const [color, brightness, size] = look(random);
    brush.light.add(at[0] + dx * spread[0], at[1] + dy * spread[1], at[2] + dz * spread[2], color, brightness, size);
  }
}

/** A point on a spiral arm (or ring) of `kind`, pushed off the ridge by `offset` radially. */
function onArm(kind: GalaxyKind, arm: number, t: number, offset: number, along: number): [number, number] {
  const [x, z] = galaxyPoint(kind, arm, t);
  const radius = Math.hypot(x, z) || 1;
  const ux = x / radius;
  const uz = z / radius;
  return [x + ux * offset - uz * along, z + uz * offset + ux * along];
}

const youngLook =
  (gain: number) =>
  (random: Random): Look => {
    if (random.next() < 0.05) return [mixRgb(STAR.hot, STAR.white, random.next() * 0.3), 0.6 * gain, 0.009];
    if (random.next() < 0.2) return [mixRgb(STAR.warm, STAR.white, random.next()), 0.11 * gain, 0.0055];
    return [mixRgb(STAR.young, STAR.white, random.next() * 0.35), 0.14 * gain, 0.0055];
  };

const oldLook =
  (gain: number) =>
  (random: Random): Look => [mixRgb(STAR.old, STAR.warm, random.next()), 0.17 * gain, 0.007];

/** Star-forming knots along arms: a cluster of pink stars in a soft hydrogen glow. */
function knots(brush: Brush, kind: GalaxyKind, count: number, from: number, to: number, width: (t: number) => number) {
  const { random } = brush;
  for (let index = 0; index < count; index++) {
    const arm = index % 2;
    const t = random.between(from, to);
    const [x, z] = onArm(kind, arm, t, random.normal() * width(t) * 0.5, random.normal() * width(t) * 0.3);
    const radius = random.between(0.005, 0.013);
    const pink = random.next() < 0.7;
    blob(brush, 22 + Math.floor(random.next() * 40), [x, 0, z], [radius, radius * 0.5, radius], (r) => [
      pink ? mixRgb(STAR.hydrogen, STAR.rose, r.next() * 0.6) : mixRgb(STAR.hot, STAR.young, r.next()),
      0.42,
      0.005,
    ]);
    blob(brush, 3, [x, 0, z], [radius, radius * 0.4, radius], () => [pink ? STAR.hydrogen : STAR.young, 0.09, 0.026]);
  }
}

/** Soft, wide puffs along the arms that read as unresolved starlight and gas. */
function armHaze(brush: Brush, kind: GalaxyKind, count: number, maxT: number, width: (t: number) => number) {
  const { random } = brush;
  for (let index = 0; index < count; index++) {
    const t = random.between(0, maxT);
    const [x, z] = onArm(kind, index % 2, t, random.normal() * width(t) * 1.4, random.normal() * width(t));
    const fade = 1.2 - 0.6 * (t / maxT);
    const tint =
      random.next() < 0.2
        ? mixRgb(STAR.rose, STAR.violet, random.next())
        : mixRgb(STAR.young, STAR.violet, random.next() * 0.3);
    brush.light.add(x, random.normal() * 0.01, z, tint, 0.016 * fade, random.between(0.035, 0.07));
  }
}

/** Dust lanes on the concave side of each arm. */
function armDust(brush: Brush, kind: GalaxyKind, count: number, maxT: number, width: (t: number) => number) {
  const { random } = brush;
  for (let index = 0; index < count; index++) {
    const t = random.between(0.02, maxT);
    const [x, z] = onArm(kind, index % 2, t, -width(t) * 0.9 + random.normal() * width(t) * 0.35, random.normal() * 0.01);
    brush.dust.add(x, random.normal() * 0.006, z, DUST, random.between(0.18, 0.38), random.between(0.02, 0.045));
  }
}

function glow(brush: Brush, count: number, at: Vec3, spread: number, color: Rgb, brightness: number, size: number) {
  blob(brush, count, at, [spread, spread * 0.6, spread], (r) => [color, brightness, size * r.between(0.8, 1.2)]);
}

/** Wide, faint puffs of unresolved starlight that give a disk its smooth glow. */
function diskGlow(brush: Brush, count: number, scale: number, maxRadius: number, brightness: number) {
  const { random } = brush;
  for (let index = 0; index < count; index++) {
    const radius = random.exponential(scale);
    if (radius > maxRadius) continue;
    const angle = random.between(0, Math.PI * 2);
    const color = mixRgb(STAR.warm, STAR.young, Math.min(1, radius * 1.4));
    brush.light.add(
      radius * Math.cos(angle),
      random.normal() * 0.012,
      radius * Math.sin(angle),
      color,
      brightness,
      random.between(0.08, 0.16),
    );
  }
}

/** Exponential disk of older, redder light between the arms. */
function disk(brush: Brush, count: number, scale: number, maxRadius: number, brightness: number) {
  const { random } = brush;
  for (let index = 0; index < count; index++) {
    const radius = random.exponential(scale);
    if (radius > maxRadius) continue;
    const angle = random.between(0, Math.PI * 2);
    const color = mixRgb(STAR.warm, STAR.young, Math.min(1, radius * 1.3));
    brush.light.add(
      radius * Math.cos(angle),
      random.normal() * 0.018,
      radius * Math.sin(angle),
      color,
      brightness * 0.75,
      0.006,
    );
  }
}

/** M51: a grand-design spiral with its companion NGC 5195 at the tip of one arm. */
function whirlpool(brush: Brush, n: number) {
  const { random } = brush;
  const width = (t: number) => 0.018 + 0.045 * t;
  blob(brush, n * 0.008, [0, 0, 0], [0.01, 0.007, 0.01], () => [STAR.white, 0.5, 0.006], true);
  blob(brush, n * 0.09, [0, 0, 0], [0.06, 0.04, 0.06], oldLook(1), true);
  glow(brush, 30, [0, 0, 0], 0.03, STAR.warm, 0.035, 0.3);
  disk(brush, n * 0.2, 0.3, 1.2, 0.07);
  for (let index = 0; index < n * 0.38; index++) {
    const t = random.next() ** 0.85;
    const [x, z] = onArm('blogs', index % 2, t, random.normal() * width(t), random.normal() * width(t) * 0.6);
    const [color, brightness, size] = youngLook(1.25 - 0.55 * t)(random);
    brush.light.add(x, random.normal() * 0.015, z, color, brightness, size);
  }
  armHaze(brush, 'blogs', n * 0.13, 1, width);
  diskGlow(brush, n * 0.035, 0.26, 1.1, 0.01);
  knots(brush, 'blogs', 90, 0.12, 0.98, width);
  armDust(brush, 'blogs', n * 0.09, 0.95, width);

  // NGC 5195 sits just past the end of the second arm, joined to it by a faint tidal bridge.
  const [tipX, tipZ] = galaxyPoint('blogs', 1, 1);
  const companion: Vec3 = [tipX * 1.2, 0.04, tipZ * 1.2];
  blob(brush, n * 0.004, companion, [0.01, 0.008, 0.01], () => [STAR.white, 0.8, 0.006], true);
  blob(brush, n * 0.045, companion, [0.05, 0.04, 0.045], oldLook(1), true);
  glow(brush, 10, companion, 0.02, STAR.warm, 0.04, 0.15);
  for (let index = 0; index < n * 0.012; index++) {
    const t = random.between(0.86, 1);
    const blend = (t - 0.86) / 0.14;
    const [x, z] = onArm('blogs', 1, t, random.normal() * 0.04, random.normal() * 0.03);
    const at: Vec3 = [x + (companion[0] - x) * blend * 0.6, companion[1] * blend, z + (companion[2] - z) * blend * 0.6];
    brush.light.add(at[0], at[1] + random.normal() * 0.01, at[2], STAR.warm, 0.06, 0.006);
  }
  for (let index = 0; index < n * 0.003; index++) {
    brush.dust.add(companion[0] + random.normal() * 0.035, 0.05, companion[2] + random.normal() * 0.008, DUST, 0.2, 0.025);
  }
  for (let index = 0; index < n * 0.006; index++) {
    const angle = random.between(0, Math.PI * 2);
    const radius = random.between(0.05, 0.12);
    brush.dust.add(radius * Math.cos(angle), 0, radius * Math.sin(angle), DUST, 0.12, 0.02);
  }
}

/** NGC 1300: a straight bar with dust lanes on its leading edges, arms from its ends, and a tiny nuclear spiral. */
function barred(brush: Brush, n: number) {
  const { random } = brush;
  const width = (t: number) => 0.02 + 0.06 * t;
  blob(brush, n * 0.008, [0, 0, 0], [0.01, 0.007, 0.01], () => [STAR.white, 0.5, 0.006], true);
  blob(brush, n * 0.05, [0, 0, 0], [0.045, 0.03, 0.045], oldLook(1), true);
  glow(brush, 24, [0, 0, 0], 0.02, STAR.warm, 0.05, 0.22);
  for (let index = 0; index < n * 0.012; index++) {
    const s = random.next();
    const angle = (index % 2) * Math.PI + s * 3 * Math.PI;
    const radius = 0.012 + 0.05 * s;
    const jitter = random.normal() * 0.004;
    brush.light.add((radius + jitter) * Math.cos(angle), 0, (radius + jitter) * Math.sin(angle), STAR.white, 0.25, 0.005);
    if (index % 4 === 0) {
      brush.dust.add((radius - 0.006) * Math.cos(angle - 0.3), 0, (radius - 0.006) * Math.sin(angle - 0.3), DUST, 0.18, 0.012);
    }
  }
  for (let index = 0; index < n * 0.17; index++) {
    const x = ((random.next() + random.next() + random.next() - 1.5) / 1.5) * 0.44;
    const taper = 1 - (0.5 * Math.abs(x)) / 0.44;
    const [color, brightness] = oldLook(0.9)(random);
    brush.light.add(x, random.normal() * 0.02, random.normal() * 0.045 * taper, color, brightness, 0.0065);
  }
  for (const end of [-1, 1]) {
    blob(brush, n * 0.0075, [end * 0.4, 0, 0], [0.03, 0.015, 0.025], oldLook(0.6));
  }
  // Dust lanes run along the bar's leading edges and curl into the nucleus without crossing it.
  for (let index = 0; index < n * 0.035; index++) {
    const x = (index % 2 ? 1 : -1) * random.between(0.07, 0.42);
    const reach = Math.abs(x) / 0.42;
    const lane = Math.sign(x) * (0.035 + 0.045 * reach ** 2);
    const opacity = random.between(0.08, 0.16) * Math.min(1, (Math.abs(x) - 0.05) / 0.1);
    brush.dust.add(x, random.normal() * 0.004, lane + random.normal() * 0.006, DUST, opacity, random.between(0.018, 0.035));
  }
  disk(brush, n * 0.1, 0.22, 1, 0.05);
  for (let index = 0; index < n * 0.36; index++) {
    const t = random.next() * 1.08;
    const [x, z] = onArm('papers', index % 2, t, random.normal() * width(t), random.normal() * width(t) * 0.6);
    const [color, brightness, size] = youngLook(1.2 - 0.5 * Math.min(1, t))(random);
    brush.light.add(x, random.normal() * 0.015, z, color, brightness * (t > 1 ? 0.5 : 1), size);
  }
  armHaze(brush, 'papers', n * 0.11, 1.05, width);
  diskGlow(brush, n * 0.025, 0.3, 1.1, 0.008);
  knots(brush, 'papers', 60, 0.1, 1, width);
  armDust(brush, 'papers', n * 0.07, 1, width);
  for (let index = 0; index < n * 0.06; index++) {
    const radius = 0.5 + random.exponential(0.25);
    if (radius > 1.3) continue;
    const angle = random.between(0, Math.PI * 2);
    brush.light.add(radius * Math.cos(angle), random.normal() * 0.02, radius * Math.sin(angle), STAR.young, 0.03, 0.006);
  }
}

/** Hoag's Object: a round yellow core, an almost empty gap, then a clumpy blue ring. */
function ring(brush: Brush, n: number) {
  const { random } = brush;
  blob(brush, n * 0.008, [0, 0, 0], [0.012, 0.012, 0.012], () => [STAR.white, 0.45, 0.006], true);
  blob(
    brush,
    n * 0.24,
    [0, 0, 0],
    [0.07, 0.066, 0.07],
    (r) => [mixRgb(STAR.old, STAR.warm, r.next() * 0.7), 0.16, 0.007],
    true,
  );
  glow(brush, 25, [0, 0, 0], 0.035, STAR.old, 0.035, 0.26);
  for (let index = 0; index < n * 0.012; index++) {
    const radius = random.between(0.25, 0.62);
    const angle = random.between(0, Math.PI * 2);
    brush.light.add(radius * Math.cos(angle), random.normal() * 0.03, radius * Math.sin(angle), STAR.warm, 0.04, 0.006);
  }
  const clumps = Array.from({ length: 70 }, () => ({ angle: random.between(0, Math.PI * 2), shift: random.normal() * 0.02 }));
  for (let index = 0; index < n * 0.42; index++) {
    const clump = random.next() < 0.7 ? clumps[index % clumps.length] : null;
    const angle = clump ? clump.angle + random.normal() * 0.022 : random.between(0, Math.PI * 2);
    const radius = 0.74 + (clump ? clump.shift : 0) + random.normal() * 0.026;
    const look: Look = random.next() < 0.1 ? [STAR.warm, 0.1, 0.0058] : youngLook(1.1)(random);
    brush.light.add(radius * Math.cos(angle), random.normal() * 0.018, radius * Math.sin(angle), look[0], look[1], look[2]);
  }
  for (let index = 0; index < 20; index++) {
    const angle = random.between(0, Math.PI * 2);
    const at: Vec3 = [0.74 * Math.cos(angle), 0, 0.74 * Math.sin(angle)];
    blob(brush, 20 + Math.floor(random.next() * 20), at, [0.012, 0.006, 0.012], (r) => [
      mixRgb(STAR.rose, STAR.hydrogen, r.next()),
      0.3,
      0.0055,
    ]);
  }
  for (let index = 0; index < n * 0.04; index++) {
    const angle = random.between(0, Math.PI * 2);
    const radius = 0.74 + random.normal() * 0.04;
    brush.light.add(
      radius * Math.cos(angle),
      random.normal() * 0.01,
      radius * Math.sin(angle),
      mixRgb(STAR.young, STAR.violet, random.next() * 0.3),
      0.03,
      random.between(0.04, 0.085),
    );
  }
  for (let index = 0; index < n * 0.025; index++) {
    const angle = random.between(0, Math.PI * 2);
    const radius = 0.95 + random.normal() * 0.04;
    brush.light.add(radius * Math.cos(angle), random.normal() * 0.02, radius * Math.sin(angle), STAR.young, 0.03, 0.006);
  }
  for (let index = 0; index < n * 0.02; index++) {
    const angle = random.between(0, Math.PI * 2);
    const radius = 0.68 + random.normal() * 0.015;
    brush.dust.add(radius * Math.cos(angle), 0, radius * Math.sin(angle), DUST, 0.12, random.between(0.02, 0.035));
  }
}

/** The Small Magellanic Cloud: a lopsided bar of clumps, a wing, NGC 346 and the globular cluster 47 Tucanae beside it. */
function irregular(brush: Brush, n: number) {
  const { random } = brush;
  const tilt = 0.6;
  const rotate = (x: number, z: number): [number, number] => [
    x * Math.cos(tilt) - z * Math.sin(tilt),
    x * Math.sin(tilt) + z * Math.cos(tilt),
  ];
  for (let index = 0; index < n * 0.36; index++) {
    const [x, z] = rotate(random.normal() * 0.42, random.normal() * 0.18);
    brush.light.add(x, random.normal() * 0.14, z, mixRgb(STAR.warm, STAR.white, random.next()), 0.07, 0.0065);
  }
  for (const [x, z] of MOMENT_CLUMPS) {
    blob(brush, n * 0.07, [x, 0, z], [0.085, 0.06, 0.085], youngLook(1.15));
    blob(brush, n * 0.006, [x, 0, z], [0.07, 0.05, 0.07], (r) => [
      mixRgb(STAR.young, STAR.violet, r.next() * 0.4),
      0.022,
      r.between(0.04, 0.07),
    ]);
  }
  blob(brush, n * 0.08, [0.55, 0.02, -0.42], [0.16, 0.08, 0.1], youngLook(0.75));
  for (let index = 0; index < 40; index++) {
    const [x, z] = rotate(random.normal() * 0.4, random.normal() * 0.16);
    blob(brush, 12 + Math.floor(random.next() * 12), [x, random.normal() * 0.05, z], [0.006, 0.006, 0.006], () => [
      STAR.hot,
      0.5,
      0.006,
    ]);
  }
  for (let index = 0; index < n * 0.03; index++) {
    const [x, z] = rotate(random.normal() * 0.45, random.normal() * 0.2);
    brush.light.add(
      x,
      random.normal() * 0.1,
      z,
      mixRgb(STAR.young, STAR.violet, random.next()),
      0.008,
      random.between(0.06, 0.12),
    );
  }

  // NGC 346: the brightest nursery, a pink cloud around a knot of hot young stars.
  const nursery: Vec3 = [MOMENT_CLUMPS[3][0] - 0.04, 0.02, MOMENT_CLUMPS[3][1] + 0.02];
  blob(brush, n * 0.03, nursery, [0.035, 0.025, 0.035], (r) => [mixRgb(STAR.hydrogen, STAR.rose, r.next()), 0.3, 0.0055]);
  blob(brush, 300, nursery, [0.008, 0.008, 0.008], () => [STAR.hot, 0.7, 0.006]);
  glow(brush, 40, nursery, 0.03, STAR.hydrogen, 0.06, 0.08);
  for (let index = 0; index < 22; index++) {
    const [x, z] = rotate(random.normal() * 0.4, random.normal() * 0.16);
    blob(brush, 15 + Math.floor(random.next() * 15), [x, random.normal() * 0.05, z], [0.012, 0.008, 0.012], (r) => [
      mixRgb(STAR.hydrogen, STAR.rose, r.next()),
      0.28,
      0.0055,
    ]);
  }

  // Two globular clusters: 47 Tucanae (bright, dense) and NGC 362.
  const tucanae: Vec3 = [-0.78, 0.12, 0.42];
  blob(brush, n * 0.035, tucanae, [0.014, 0.014, 0.014], (r) => [mixRgb(STAR.warm, STAR.white, r.next()), 0.4, 0.005], true);
  glow(brush, 6, tucanae, 0.01, STAR.warm, 0.06, 0.06);
  blob(brush, n * 0.008, [0.62, -0.04, -0.58], [0.01, 0.01, 0.01], () => [STAR.warm, 0.35, 0.005], true);
  for (let index = 0; index < n * 0.015; index++) {
    const [x, z] = rotate(random.normal() * 0.38, random.normal() * 0.16);
    brush.dust.add(x, random.normal() * 0.06, z, DUST, random.between(0.06, 0.14), random.between(0.03, 0.06));
  }
}

const MODELS: Record<GalaxyKind, (brush: Brush, n: number) => void> = {
  blogs: whirlpool,
  papers: barred,
  photos: ring,
  moments: irregular,
};

/** Builds one galaxy with roughly `budget` light particles. Deterministic for a given kind and budget. */
export function buildGalaxyModel(kind: GalaxyKind, budget: number): GalaxyModel {
  const random = createRandom(SEEDS[kind]);
  const brush: Brush = { light: createParticleBuilder(), dust: createParticleBuilder(), random };
  MODELS[kind](brush, Math.max(2000, Math.round(budget)));
  return { light: brush.light.build(random), dust: brush.dust.build(random) };
}
