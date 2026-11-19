import type { Vec3 } from './types';

export const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Point i of n spread evenly over the unit sphere; the GLSL `fibDir` matches it. */
export function fibDir(index: number, count: number): Vec3 {
  const y = 1 - (2 * (index + 0.5)) / count;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = index * GOLDEN_ANGLE;
  return [Math.cos(theta) * r, y, Math.sin(theta) * r];
}

/** Rotate about +y by `angle`; the GLSL `rotY(angle) * v` matches it. */
export function rotY(v: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c * v[0] - s * v[2], v[1], s * v[0] + c * v[2]];
}

export const scale = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
