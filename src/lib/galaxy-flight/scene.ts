/**
 * Where the four galaxies hang in space, the route the camera flies between them,
 * and the small amount of matrix maths shared by the renderer and the clickable stars.
 *
 * Matrices are column-major Float32Arrays, ready for `uniformMatrix4fv`.
 */

import type { GalaxyKind } from '../galaxy';

export type Vec3 = readonly [number, number, number];
export type Mat4 = Float32Array;

/** A stop on the flight: where it hangs in space and where the camera rests to look at it. */
export interface FlightStop {
  center: Vec3;
  /** Radius in world units (a galaxy's disk, or a black hole's accretion disk). */
  radius: number;
  /** Unit vector from the galaxy towards the camera's resting point. */
  view: Vec3;
  /** Resting camera distance, in galaxy radii. */
  distance: number;
  /** Angle between the disk's axis and the line of sight, radians (0 = face-on). */
  inclination: number;
  /** Turn of the disk about its own axis, which sets where the arms point. */
  roll: number;
  /** Pattern speed in radians per second; spirals turn so their arms trail. */
  spin: number;
  /** Half-width (in radii) the resting view must keep on screen; smaller lets the object overflow. Default 1.25. */
  frameWidth?: number;
  /** How far right of centre it rests on wide screens, in radii, leaving room for its story. Default 0.42. */
  shift?: number;
}

export interface GalaxyPlacement extends FlightStop {
  kind: GalaxyKind;
}

/** Slow floating motion of a galaxy: offsets in galaxy radii, tilt in radians. */
export interface GalaxyDrift {
  lift: number;
  sway: number;
  tilt: number;
}

export const NO_DRIFT: GalaxyDrift = { lift: 0, sway: 0, tilt: 0 };

export interface CameraPose {
  eye: Vec3;
  target: Vec3;
  up: Vec3;
}

/** Vertical field of view, radians. */
export const FIELD_OF_VIEW = (48 * Math.PI) / 180;

const UP: Vec3 = [0, 1, 0];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: Vec3): Vec3 => scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const lerp = (a: Vec3, b: Vec3, t: number): Vec3 => add(a, scale(sub(b, a), t));
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

export const GALAXY_PLACEMENTS: readonly GalaxyPlacement[] = [
  {
    kind: 'blogs',
    center: [0, 0, 0],
    radius: 12,
    view: normalize([0.12, 0.3, 1]),
    distance: 2.55,
    inclination: 0.5,
    roll: 0.3,
    spin: -0.034,
  },
  {
    kind: 'papers',
    center: [-44, 14, -115],
    radius: 13,
    view: normalize([-0.22, 0.22, 1]),
    distance: 2.55,
    inclination: 0.55,
    roll: 0.65,
    spin: -0.026,
  },
  {
    kind: 'photos',
    center: [38, -10, -225],
    radius: 9.5,
    view: normalize([0.25, 0.08, 1]),
    distance: 2.65,
    inclination: 0.28,
    roll: 0,
    spin: 0.022,
  },
  {
    kind: 'moments',
    center: [-16, 6, -330],
    radius: 10.5,
    view: normalize([-0.1, 0.18, 1]),
    distance: 2.45,
    inclination: 0.9,
    roll: 0.4,
    spin: 0.009,
  },
];

/**
 * The last stop: a supermassive black hole, its accretion disk seen almost edge-on so that
 * lensing lifts the far side of the disk over (and under) the shadow, as in Interstellar.
 * `radius` is the disk's outer edge; the event horizon is radius / 14.
 */
export const BLACK_HOLE: FlightStop = {
  center: [26, -4, -455],
  radius: 14,
  view: normalize([0.12, 0.14, 1]),
  // Close enough that the disk spills past the edges of the screen: the hole should feel overwhelming.
  distance: 1.45,
  inclination: Math.PI / 2 - 0.16,
  roll: 0,
  spin: 0,
  frameWidth: 0.55,
  shift: 0.05,
};

/** Every stop the camera visits, in order. */
export const ROUTE: readonly FlightStop[] = [...GALAXY_PLACEMENTS, BLACK_HOLE];

/** The galaxy's own axes in world space: `x` and `z` span the disk, `y` is its spin axis. */
export function stopBasis(placement: FlightStop, tilt = 0): { x: Vec3; y: Vec3; z: Vec3 } {
  const { view, roll } = placement;
  const inclination = placement.inclination + tilt;
  const tiltTowards = normalize(sub(UP, scale(view, dot(view, UP))));
  const y = normalize(add(scale(view, Math.cos(inclination)), scale(tiltTowards, Math.sin(inclination))));
  const across = normalize(cross(UP, y));
  const along = cross(across, y);
  return {
    x: add(scale(across, Math.cos(roll)), scale(along, Math.sin(roll))),
    y,
    z: add(scale(across, -Math.sin(roll)), scale(along, Math.cos(roll))),
  };
}

/**
 * How galaxy `index` floats at `time` seconds: it rises and sinks, sways a little sideways and
 * slowly rocks, each on its own long, unrelated period so the motion never visibly repeats.
 */
export function galaxyDrift(index: number, time: number): GalaxyDrift {
  const wave = (period: number, phase: number) => Math.sin((time * 2 * Math.PI) / period + phase);
  return {
    lift: 0.032 * wave(13, index * 1.7) + 0.006 * wave(5.6, index * 0.9),
    sway: 0.013 * wave(19, index * 2.1),
    tilt: 0.03 * wave(15, index * 2.3),
  };
}

/** World position of the galaxy's centre once it has drifted. */
function driftedCenter(placement: FlightStop, drift: GalaxyDrift): Vec3 {
  const side = normalize(cross(UP, placement.view));
  return add(placement.center, add(scale(UP, drift.lift * placement.radius), scale(side, drift.sway * placement.radius)));
}

/** Model matrix taking galaxy units (radius 1) to world space. */
export function galaxyModelMatrix(placement: FlightStop, drift: GalaxyDrift = NO_DRIFT): Mat4 {
  const { x, y, z } = stopBasis(placement, drift.tilt);
  const r = placement.radius;
  const [cx, cy, cz] = driftedCenter(placement, drift);
  return new Float32Array([
    x[0] * r,
    x[1] * r,
    x[2] * r,
    0,
    y[0] * r,
    y[1] * r,
    y[2] * r,
    0,
    z[0] * r,
    z[1] * r,
    z[2] * r,
    0,
    cx,
    cy,
    cz,
    1,
  ]);
}

/** World position of a point given in galaxy units, after the galaxy has turned by `angle` and drifted. */
export function localToWorld(placement: FlightStop, angle: number, local: Vec3, drift: GalaxyDrift = NO_DRIFT): Vec3 {
  const radius = Math.hypot(local[0], local[2]);
  const theta = Math.atan2(local[2], local[0]) + angle;
  const { x, y, z } = stopBasis(placement, drift.tilt);
  const r = placement.radius;
  return add(
    driftedCenter(placement, drift),
    add(add(scale(x, radius * Math.cos(theta) * r), scale(y, local[1] * r)), scale(z, radius * Math.sin(theta) * r)),
  );
}

/** Where the camera rests to look at galaxy `index`, for a viewport of the given aspect ratio. */
function restingPose(index: number, aspect: number): { eye: Vec3; target: Vec3 } {
  const placement = ROUTE[index];
  const halfWidth = Math.tan(FIELD_OF_VIEW / 2) * aspect;
  const fit = Math.max(1, Math.min(2.4, (placement.frameWidth ?? 1.25) / halfWidth / placement.distance));
  const eye = add(placement.center, scale(placement.view, placement.distance * placement.radius * fit));
  // On wide screens the galaxy sits right of centre, leaving the left for its name and words.
  const wide = clamp01((aspect - 1.15) / 0.55);
  const right = normalize(cross(scale(placement.view, -1), UP));
  const target = sub(placement.center, scale(right, placement.radius * (placement.shift ?? 0.42) * wide));
  return { eye, target };
}

function catmullRom(p0: Vec3, p1: Vec3, p2: Vec3, p3: Vec3, t: number): Vec3 {
  const t2 = t * t;
  const t3 = t2 * t;
  const at = (axis: 0 | 1 | 2) =>
    0.5 *
    (2 * p1[axis] +
      (-p0[axis] + p2[axis]) * t +
      (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t2 +
      (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t3);
  return [at(0), at(1), at(2)];
}

/**
 * Camera pose for a flight `progress` in [0, galaxies − 1]: integer values rest on a galaxy,
 * values in between fly past the current galaxy towards the next one. `nudge` shifts the eye
 * sideways and up (world units) while it keeps looking at the same point, for pointer parallax.
 */
export function cameraAt(progress: number, aspect: number, nudge: readonly [number, number] = [0, 0]): CameraPose {
  const last = ROUTE.length - 1;
  const p = Math.min(last, Math.max(0, progress));
  const index = Math.min(last - 1, Math.floor(p));
  const raw = p - index;
  // Linger a little near each galaxy, travel a little faster in between.
  const t = raw + (smoothstep(raw) - raw) * 0.35;
  const poses = ROUTE.map((_, i) => restingPose(i, aspect));
  const eye = (i: number): Vec3 => {
    if (i < 0) return lerp(poses[0].eye, poses[1].eye, -0.5);
    if (i > last) return lerp(poses[last].eye, poses[last - 1].eye, -0.5);
    return poses[i].eye;
  };
  const position = catmullRom(eye(index - 1), eye(index), eye(index + 1), eye(index + 2), t);
  const look = smoothstep(clamp01((t - 0.12) / 0.7));
  const target = lerp(poses[index].target, poses[index + 1].target, look);
  // Bank gently while travelling, like a ship turning towards the next galaxy.
  const forward = normalize(sub(target, position));
  const side = normalize(cross(forward, UP));
  const bank = Math.sin(Math.PI * t) * 0.06 * (index % 2 === 0 ? 1 : -1);
  const up = normalize(add(scale(UP, Math.cos(bank)), scale(side, Math.sin(bank))));
  const lifted = cross(side, forward);
  return { eye: add(position, add(scale(side, nudge[0]), scale(lifted, nudge[1]))), target, up };
}

export function perspective(fieldOfView: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fieldOfView / 2);
  const range = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (near + far) * range, -1, 0, 0, 2 * near * far * range, 0]);
}

export function lookAt(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const z = normalize(sub(eye, target));
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return new Float32Array([
    x[0],
    y[0],
    z[0],
    0,
    x[1],
    y[1],
    z[1],
    0,
    x[2],
    y[2],
    z[2],
    0,
    -dot(x, eye),
    -dot(y, eye),
    -dot(z, eye),
    1,
  ]);
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let column = 0; column < 4; column++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

/** Screen position (CSS pixels) of a world point; `depth` ≤ 0 means it is behind the camera. */
export function project(
  viewProjection: Mat4,
  point: Vec3,
  width: number,
  height: number,
): { x: number; y: number; depth: number } {
  const m = viewProjection;
  const x = m[0] * point[0] + m[4] * point[1] + m[8] * point[2] + m[12];
  const y = m[1] * point[0] + m[5] * point[1] + m[9] * point[2] + m[13];
  const w = m[3] * point[0] + m[7] * point[1] + m[11] * point[2] + m[15];
  if (w <= 1e-4) return { x: 0, y: 0, depth: w };
  return { x: ((x / w + 1) / 2) * width, y: ((1 - y / w) / 2) * height, depth: w };
}
