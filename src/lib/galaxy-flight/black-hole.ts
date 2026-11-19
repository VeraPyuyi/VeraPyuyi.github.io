/**
 * Geometry the black hole shader needs: its frame in units of the Schwarzschild radius,
 * and the inverse camera matrix used to turn each pixel back into a ray.
 */

import { BLACK_HOLE, type FlightStop, type Mat4, stopBasis, type Vec3 } from './scene';

/** Outer edge of the accretion disk, in Schwarzschild radii; the stop's radius maps to this. */
export const DISK_OUTER_RS = 14;

export interface BlackHoleFrame {
  center: Vec3;
  /** World units per Schwarzschild radius. */
  scale: number;
  /** Column-major 3×3 matrix turning world directions into the hole's frame (disk in x–z, spin axis y). */
  toLocal: Float32Array;
}

export function blackHoleFrame(stop: FlightStop = BLACK_HOLE): BlackHoleFrame {
  const { x, y, z } = stopBasis(stop);
  return {
    center: stop.center,
    scale: stop.radius / DISK_OUTER_RS,
    // Rows are the local axes, so M · v gives (x·v, y·v, z·v).
    toLocal: new Float32Array([x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]),
  };
}

/** Inverse of a 4×4 column-major matrix, or null when it is singular. */
export function invert(m: Mat4): Mat4 | null {
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;
  const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-12) return null;
  const d = 1 / det;
  return new Float32Array([
    (a11 * b11 - a12 * b10 + a13 * b09) * d,
    (a02 * b10 - a01 * b11 - a03 * b09) * d,
    (a31 * b05 - a32 * b04 + a33 * b03) * d,
    (a22 * b04 - a21 * b05 - a23 * b03) * d,
    (a12 * b08 - a10 * b11 - a13 * b07) * d,
    (a00 * b11 - a02 * b08 + a03 * b07) * d,
    (a32 * b02 - a30 * b05 - a33 * b01) * d,
    (a20 * b05 - a22 * b02 + a23 * b01) * d,
    (a10 * b10 - a11 * b08 + a13 * b06) * d,
    (a01 * b08 - a00 * b10 - a03 * b06) * d,
    (a30 * b04 - a31 * b02 + a33 * b00) * d,
    (a21 * b02 - a20 * b04 - a23 * b00) * d,
    (a11 * b07 - a10 * b09 - a12 * b06) * d,
    (a00 * b09 - a01 * b07 + a02 * b06) * d,
    (a31 * b01 - a30 * b03 - a32 * b00) * d,
    (a20 * b03 - a21 * b01 + a22 * b00) * d,
  ]);
}
