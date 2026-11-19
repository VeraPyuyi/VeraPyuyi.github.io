/**
 * Original line-art starships for the megastructure scenes, from corvettes to a Titan.
 * Hulls are drawn nose towards +x in a unit length; `size` is the ship's length in pixels.
 */

import { ellipse, glow, neon, PALETTE, rgba } from './kit';

export type ShipKind = 'corvette' | 'cruiser' | 'science' | 'constructor' | 'transport' | 'titan';

const HULLS: Record<ShipKind, readonly (readonly [number, number])[]> = {
  corvette: [
    [0.5, 0],
    [-0.3, 0.22],
    [-0.5, 0.12],
    [-0.42, 0],
    [-0.5, -0.12],
    [-0.3, -0.22],
  ],
  cruiser: [
    [0.5, 0],
    [0.2, 0.11],
    [-0.1, 0.13],
    [-0.25, 0.28],
    [-0.5, 0.28],
    [-0.4, 0.1],
    [-0.5, 0],
    [-0.4, -0.1],
    [-0.5, -0.28],
    [-0.25, -0.28],
    [-0.1, -0.13],
    [0.2, -0.11],
  ],
  science: [
    [0.5, 0],
    [0.25, 0.17],
    [-0.2, 0.17],
    [-0.5, 0.08],
    [-0.5, -0.08],
    [-0.2, -0.17],
    [0.25, -0.17],
  ],
  constructor: [
    [0.38, 0.2],
    [-0.5, 0.2],
    [-0.5, -0.2],
    [0.38, -0.2],
  ],
  transport: [
    [0.5, 0],
    [0.35, 0.16],
    [-0.45, 0.16],
    [-0.5, 0],
    [-0.45, -0.16],
    [0.35, -0.16],
  ],
  titan: [
    [0.5, 0.035],
    [0.33, 0.035],
    [0.3, 0.09],
    [0.1, 0.11],
    [-0.05, 0.2],
    [-0.3, 0.2],
    [-0.38, 0.11],
    [-0.5, 0.13],
    [-0.5, -0.13],
    [-0.38, -0.11],
    [-0.3, -0.2],
    [-0.05, -0.2],
    [0.1, -0.11],
    [0.3, -0.09],
    [0.33, -0.035],
    [0.5, -0.035],
  ],
};

export function drawShip(
  ctx: CanvasRenderingContext2D,
  kind: ShipKind,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string,
  time: number,
  alpha = 1,
) {
  if (alpha <= 0.01 || size < 1) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Engine light trails behind the hull.
  const engines = kind === 'titan' ? [-0.12, 0, 0.12] : kind === 'cruiser' ? [-0.2, 0.2] : [0];
  for (const offset of engines) {
    glow(ctx, -0.55 * size, offset * size, size * (kind === 'titan' ? 0.16 : 0.3), color, 0.8 * alpha);
  }
  ctx.beginPath();
  HULLS[kind].forEach(([px, py], index) => {
    if (index === 0) ctx.moveTo(px * size, py * size);
    else ctx.lineTo(px * size, py * size);
  });
  ctx.closePath();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = rgba(PALETTE.hull, 0.92 * alpha);
  ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  neon(ctx, color, 0.85 * alpha, size > 60 ? 1.1 : 0.8);
  if (kind === 'science') {
    ellipse(ctx, 0.12 * size, 0, 0.1 * size, 0.1 * size);
    neon(ctx, color, 0.7 * alpha, 0.7);
  }
  if (kind === 'constructor') {
    ctx.beginPath();
    ctx.moveTo(0.38 * size, 0.2 * size);
    ctx.lineTo(0.62 * size, 0.38 * size);
    neon(ctx, color, 0.7 * alpha, 0.7);
  }
  if (kind === 'titan') {
    // Running lights along the hull, and the spinal lance charging at the bow.
    for (let index = 0; index < 6; index++) {
      const lx = (-0.3 + index * 0.1) * size;
      glow(ctx, lx, 0.15 * size, 2, PALETTE.white, alpha * (0.5 + 0.5 * Math.sin(time * 3 + index)));
      glow(ctx, lx, -0.15 * size, 2, PALETTE.white, alpha * (0.5 + 0.5 * Math.sin(time * 3 + index + 1)));
    }
    const charge = 0.5 + 0.5 * Math.sin(time * 1.3);
    glow(ctx, 0.52 * size, 0, size * (0.05 + 0.05 * charge), PALETTE.sky, alpha);
  }
  ctx.restore();
}

/**
 * Position on a straight run from `from` to `to` that repeats every `period` seconds, offset by
 * `delay`; fades in and out at the ends. Returns null between runs.
 */
export function run(
  time: number,
  period: number,
  delay: number,
  duration: number,
  from: readonly [number, number],
  to: readonly [number, number],
): { x: number; y: number; angle: number; alpha: number; t: number } | null {
  const local = (((time - delay) % period) + period) % period;
  if (local > duration) return null;
  const t = local / duration;
  const x = from[0] + (to[0] - from[0]) * t;
  const y = from[1] + (to[1] - from[1]) * t;
  const alpha = Math.min(1, t * 6, (1 - t) * 6);
  return { x, y, angle: Math.atan2(to[1] - from[1], to[0] - from[0]), alpha, t };
}
