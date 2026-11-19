/**
 * The sky behind the flight: stars, the Milky Way, small nebulae and far galaxies, in world units.
 *
 * Modelled on how the real night sky looks through a long exposure rather than as an even
 * scatter of dots:
 * - Star brightness follows a power law, as real star counts do: for every bright star there are
 *   dozens of faint ones. Faint stars are sub-pixel points; only the brightest few are large
 *   enough to bloom and carry diffraction spikes.
 * - Colour follows temperature: most stars are white to pale yellow; blue-white and orange stars
 *   are rarer and tend to be the bright ones.
 * - The Milky Way is a band of clumpy star clouds laid down by noise, its glow made of a dense
 *   dust of fine, unresolved grains rather than soft blobs.
 * - Nebulae are crowds of fine grains over a faint veil, not large puffs.
 */

import type { ParticleBuilder, ParticleSet, Random, Rgb } from './particles';
import { createParticleBuilder, createRandom, mixRgb, STAR } from './particles';
import { GALAXY_PLACEMENTS, type Vec3 } from './scene';

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: Vec3): Vec3 => scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

const ROUTE_CENTER: Vec3 = [0, 0, -220];
/** Screen pixels per world unit at distance 1 for a 900-pixel-high view; sizes are tuned against it. */
const PIXELS = 1010;

/** Smooth 3D value noise in about [0, 1], for star clouds along the Milky Way. */
function createNoise3(seed: number) {
  const hash = (x: number, y: number, z: number) => {
    let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1440662683) ^ Math.imul(seed, 2246822519);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const fade = (t: number) => t * t * (3 - 2 * t);
  const value = (x: number, y: number, z: number) => {
    const [ix, iy, iz] = [Math.floor(x), Math.floor(y), Math.floor(z)];
    const [u, v, w] = [fade(x - ix), fade(y - iy), fade(z - iz)];
    const corner = (dx: number, dy: number, dz: number) => hash(ix + dx, iy + dy, iz + dz);
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
    const bottom = lerp(lerp(corner(0, 0, 0), corner(1, 0, 0), u), lerp(corner(0, 1, 0), corner(1, 1, 0), u), v);
    const top = lerp(lerp(corner(0, 0, 1), corner(1, 0, 1), u), lerp(corner(0, 1, 1), corner(1, 1, 1), u), v);
    return lerp(bottom, top, w);
  };
  return ([x, y, z]: Vec3) => {
    let sum = 0;
    let amplitude = 0.5;
    let frequency = 1;
    for (let octave = 0; octave < 4; octave++) {
      sum += amplitude * value(x * frequency, y * frequency, z * frequency);
      frequency *= 2.07;
      amplitude *= 0.5;
    }
    return sum / 0.94;
  };
}

/**
 * A star's relative flux from a power law (most stars faint, a few bright), clipped so the
 * brightest are about sixty times the faintest.
 */
const flux = (random: Random) => Math.min(60, random.next() ** -0.75);

/** Star colour by temperature; the brighter a star, the likelier it is a hot blue or a red giant. */
function temperature(random: Random, bright: number): Rgb {
  const pick = random.next();
  const rare = Math.min(0.45, 0.12 + bright * 0.01);
  if (pick < rare * 0.45) return STAR.old;
  if (pick < rare) return random.next() < 0.6 ? STAR.young : STAR.hot;
  if (pick < 0.62) return STAR.white;
  return mixRgb(STAR.white, STAR.warm, random.next());
}

/**
 * A point star at `at`. Its size is set in screen pixels at that distance, so a faint star is a
 * sub-pixel point (drawn at a pixel and dimmed) and only bright ones grow into blooming discs.
 */
function star(builder: ParticleBuilder, random: Random, at: Vec3, distance: number, gain: number) {
  const f = flux(random);
  // Faint stars stay at a pixel or less; the brightest grow to a few pixels, enough to bloom and
  // show their spikes.
  const pixels = f < 6 ? 0.8 + 0.3 * Math.log2(f) : 1.6 + 1.5 * Math.log2(f / 6);
  builder.add(at[0], at[1], at[2], temperature(random, f), Math.min(3.2, 0.1 + 0.1 * f) * gain, (pixels * distance) / PIXELS);
}

/** Stars, the Milky Way, small nebulae and far-off galaxies around the route. */
export function buildBackdrop(budget: number): ParticleSet {
  const random = createRandom(4242);
  const noise = createNoise3(17);
  const builder = createParticleBuilder();
  const direction = (): Vec3 => normalize([random.normal(), random.normal(), random.normal()]);
  // The Milky Way: a great circle across the sky, as seen from inside our own galaxy.
  const bandAxis = normalize([0.35, 1, 0.2]);
  const bandX = normalize(cross(bandAxis, [0, 0, 1]));
  const bandY = cross(bandAxis, bandX);
  /** A direction near the band: gaussian across it, uniform along it. */
  const inBand = (width: number): Vec3 => {
    const angle = random.between(0, Math.PI * 2);
    const across = random.normal() * width;
    return normalize(add(add(scale(bandX, Math.cos(angle)), scale(bandY, Math.sin(angle))), scale(bandAxis, across)));
  };
  /** Star clouds: the band's density rises and falls along it in clumps. */
  const clumpy = (d: Vec3) => noise(scale(d, 3.2));

  // Field stars all over the sky.
  for (let index = 0; index < budget * 0.32; index++) {
    const distance = random.between(450, 700);
    star(builder, random, add(ROUTE_CENTER, scale(direction(), distance)), distance, 1);
  }
  // The Milky Way's stars, thick where its star clouds are.
  for (let placed = 0, tries = 0; placed < budget * 0.26 && tries < budget * 3; tries++) {
    const d = inBand(0.15);
    if (random.next() > clumpy(d) ** 2.2 * 1.9) continue;
    placed++;
    const distance = random.between(520, 720);
    star(builder, random, add(ROUTE_CENTER, scale(d, distance)), distance, 0.75);
  }
  // Its unresolved light: a dense dust of faint grains (no soft blobs), warmer in the star clouds.
  for (let placed = 0, tries = 0; placed < budget * 0.36 && tries < budget * 5; tries++) {
    const d = inBand(0.12);
    const density = clumpy(d);
    if (random.next() > density ** 2.6 * 2.2) continue;
    placed++;
    const distance = random.between(560, 720);
    const at = add(ROUTE_CENTER, scale(d, distance));
    const tint = mixRgb(STAR.young, STAR.warm, Math.min(1, density * 1.4 - 0.2));
    builder.add(at[0], at[1], at[2], tint, random.between(0.1, 0.26), (random.between(0.7, 1.3) * distance) / PIXELS);
  }

  // A few small nebulae in the band: crowds of fine grains over a faint veil, not blobs.
  const nebulae: { d: Vec3; tints: [Rgb, Rgb] }[] = [
    { d: inBand(0.05), tints: [STAR.hydrogen, STAR.rose] },
    { d: inBand(0.05), tints: [STAR.violet, STAR.young] },
    { d: inBand(0.05), tints: [STAR.teal, STAR.young] },
    { d: inBand(0.05), tints: [STAR.rose, STAR.violet] },
  ];
  for (const nebula of nebulae) {
    const center = add(ROUTE_CENTER, scale(nebula.d, 600));
    for (let placed = 0, tries = 0; placed < budget * 0.025 && tries < budget * 0.4; tries++) {
      const at = add(center, [random.normal() * 26, random.normal() * 18, random.normal() * 26]);
      if (random.next() > noise(scale(at, 0.045)) ** 3 * 3) continue;
      placed++;
      const tint = mixRgb(nebula.tints[0], nebula.tints[1], random.next());
      if (random.next() < 0.88)
        builder.add(at[0], at[1], at[2], tint, random.between(0.04, 0.12), (random.between(0.7, 1.4) * 600) / PIXELS);
      else builder.add(at[0], at[1], at[2], tint, random.between(0.003, 0.007), random.between(4, 9));
    }
  }

  // Nearer stars around the route, so flying past them gives depth.
  for (let index = 0; index < budget * 0.17; index++) {
    const at: Vec3 = [random.between(-150, 150), random.between(-95, 95), random.between(-560, 90)];
    const f = flux(random);
    builder.add(at[0], at[1], at[2], temperature(random, f), Math.min(1.6, 0.08 * f), 0.03 + 0.012 * Math.log2(f));
  }

  // Far galaxies: small tilted smudges of warm light.
  for (let galaxy = 0; galaxy < 50; galaxy++) {
    const center = add(ROUTE_CENTER, scale(direction(), random.between(300, 480)));
    const axes = [random.between(1.2, 3), random.between(0.3, 0.9), random.between(1.2, 3)] as const;
    for (let index = 0; index < 60; index++) {
      builder.add(
        center[0] + random.normal() * axes[0],
        center[1] + random.normal() * axes[1],
        center[2] + random.normal() * axes[2],
        mixRgb(STAR.warm, STAR.white, random.next()),
        0.05,
        0.9,
      );
    }
  }

  // Through the gap of Hoag's Object, a second, far more distant ring galaxy shows through.
  const hoag = GALAXY_PLACEMENTS[2];
  const hoagRight = normalize(cross(scale(hoag.view, -1), [0, 1, 0]));
  const hoagUp = cross(hoagRight, scale(hoag.view, -1));
  const behind = add(
    hoag.center,
    add(scale(hoag.view, -hoag.radius * 5), add(scale(hoagUp, hoag.radius * 1.1), scale(hoagRight, hoag.radius * 0.8))),
  );
  for (let index = 0; index < 700; index++) {
    const core = index < 140;
    const angle = random.between(0, Math.PI * 2);
    const radius = core ? Math.abs(random.normal()) * 0.25 : 1.25 + random.normal() * 0.12;
    const at = add(behind, add(scale(hoagRight, radius * Math.cos(angle)), scale(hoagUp, radius * Math.sin(angle))));
    builder.add(at[0], at[1], at[2], core ? STAR.old : mixRgb(STAR.old, STAR.hydrogen, 0.4), core ? 0.2 : 0.14, 0.14);
  }
  return builder.build(random);
}
