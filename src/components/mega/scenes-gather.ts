/** Scenes for the pages where other people arrive: guestbook (Interstellar Assembly) and friends (Gateway). */

import { hashUnit } from '@/lib/megastructures';
import type { SceneFactory } from './engine';
import { ellipse, glow, HitList, neon, PALETTE, rgba, tag } from './kit';
import { drawShip, run } from './ships';

const TAU = Math.PI * 2;

/**
 * Guestbook: the assembly hall seen from above, tier on tier of seats around the speaker's floor.
 * Seats light as delegations arrive; one empty seat keeps pulsing — the visitor's own. Item 0 is it.
 */
export const assembly: SceneFactory = (items) => {
  const hits = new HitList();
  const TIERS = 5;
  return {
    hit: (x, y) => hits.find(x, y),
    draw({ ctx, cx, cy, size, time, focus }) {
      hits.reset();
      const tilt = 0.46;
      const floorY = cy + size * 0.18;
      // Floor and the speaker's podium with its slowly turning hologram.
      ellipse(ctx, cx, floorY, size * 0.22, size * 0.22 * tilt);
      neon(ctx, PALETTE.violet, 0.6, 1);
      glow(ctx, cx, floorY - size * 0.18, size * 0.28, PALETTE.violet, 0.35);
      for (let ring = 0; ring < 3; ring++) {
        ellipse(
          ctx,
          cx,
          floorY - size * (0.12 + ring * 0.07),
          size * (0.1 - ring * 0.025),
          size * 0.03,
          time * 0.4 * (ring % 2 ? -1 : 1),
        );
        neon(ctx, PALETTE.sky, 0.55, 0.8);
      }
      let mine: [number, number] | null = null;
      for (let tier = 0; tier < TIERS; tier++) {
        const radius = size * (0.36 + tier * 0.15);
        const seats = 9 + tier * 4;
        ellipse(ctx, cx, floorY, radius + size * 0.05, (radius + size * 0.05) * tilt, 0, Math.PI * 1.02, Math.PI * 1.98);
        neon(ctx, PALETTE.sky, 0.18, 0.7);
        for (let seat = 0; seat < seats; seat++) {
          const a = Math.PI * 1.06 + (seat / (seats - 1)) * Math.PI * 0.88;
          const x = cx + Math.cos(a) * radius;
          const y = floorY + Math.sin(a) * radius * tilt;
          const key = hashUnit(`seat${tier}:${seat}`);
          // Each seat lights for a while in a long, slow cycle: delegations come and go.
          const phase = (time * 0.035 + key) % 1;
          const occupied = phase < 0.62;
          const isMine = tier === 2 && seat === Math.floor(seats / 2);
          if (isMine) {
            mine = [x, y];
            continue;
          }
          const hue = key > 0.66 ? PALETTE.pink : key > 0.33 ? PALETTE.sky : PALETTE.gold;
          glow(ctx, x, y, occupied ? 7 : 3, hue, occupied ? 0.75 * Math.min(1, phase * 20, (0.62 - phase) * 20) + 0.15 : 0.15);
        }
      }
      if (mine) {
        const [x, y] = mine;
        const lit = focus === 0;
        const pulse = 0.5 + 0.5 * Math.sin(time * 2.2);
        ellipse(ctx, x, y, 7 + pulse * 4, (7 + pulse * 4) * 0.7);
        neon(ctx, PALETTE.pink, 0.6 + 0.4 * pulse, 1.1);
        glow(ctx, x, y, lit ? 26 : 12 + pulse * 6, PALETTE.pink, lit ? 0.95 : 0.5);
        if (items[0]) {
          hits.add(0, x, y, 22);
          tag(ctx, x, y, items[0].title, PALETTE.pink, x > cx);
        }
      }
      // Delegations arriving from every side of the sky.
      const routes: [number, number, number, number, number][] = [
        [-1.9, -0.9, -0.55, -0.32, 0],
        [1.9, -1, 0.6, -0.36, 5],
        [-1.7, 0.95, -0.7, 0.42, 10],
      ];
      routes.forEach(([fx, fy, tx, ty, delay], index) => {
        const trip = run(time, 15, delay, 9, [cx + size * fx, cy + size * fy], [cx + size * tx, cy + size * ty]);
        if (!trip) return;
        const color = index === 1 ? PALETTE.gold : PALETTE.sky;
        const scale = 1 - 0.35 * trip.t;
        drawShip(ctx, 'cruiser', trip.x, trip.y, trip.angle, size * 0.13 * scale, color, time, trip.alpha);
        drawShip(
          ctx,
          'corvette',
          trip.x - size * 0.12,
          trip.y + size * 0.08,
          trip.angle,
          size * 0.07 * scale,
          color,
          time,
          trip.alpha,
        );
      });
    },
  };
};

/** Friends: a gate whose far side is someone else's universe; every friend is a beacon on its rim. */
export const gateway: SceneFactory = (items) => {
  const hits = new HitList();
  return {
    hit: (x, y) => hits.find(x, y),
    draw({ ctx, cx, cy, size, time, focus }) {
      hits.reset();
      const rx = size * 0.42;
      const ry = size * 0.8;
      const lean = 0.28;
      const tint = focus >= 0 && items[focus] ? (items[focus].color ?? PALETTE.pink) : PALETTE.sky;
      // The event surface: rings swirling inward, tinted by whoever you are looking at.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(lean);
      ctx.save();
      ellipse(ctx, 0, 0, rx * 0.86, ry * 0.86);
      ctx.clip();
      glow(ctx, 0, 0, ry, tint, 0.45);
      for (let ring = 0; ring < 9; ring++) {
        const t = (time * 0.18 + ring / 9) % 1;
        const k = 1 - t;
        ellipse(ctx, 0, 0, rx * 0.86 * k, ry * 0.86 * k, time * 0.3 + ring);
        ctx.strokeStyle = rgba(tint, 0.35 * Math.sin(t * Math.PI));
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      glow(ctx, 0, 0, ry * 0.35, PALETTE.white, 0.5);
      ctx.restore();
      // The gate frame: an outer ring with six clamps.
      ellipse(ctx, 0, 0, rx, ry);
      neon(ctx, PALETTE.gold, 0.85, 2.2);
      ellipse(ctx, 0, 0, rx * 0.9, ry * 0.9);
      neon(ctx, PALETTE.gold, 0.5, 1);
      for (let clamp = 0; clamp < 6; clamp++) {
        const a = (clamp / 6) * TAU + Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * rx * 0.88, Math.sin(a) * ry * 0.88);
        ctx.lineTo(Math.cos(a) * rx * 1.14, Math.sin(a) * ry * 1.08);
        neon(ctx, PALETTE.gold, 0.8, 2.4);
      }
      ctx.restore();
      // Beacons around the rim, one per friend.
      const count = items.length;
      items.forEach((item, index) => {
        const a = -Math.PI / 2 + ((index + 0.5) / Math.max(count, 1)) * TAU;
        const px = Math.cos(a) * rx * 1.22;
        const py = Math.sin(a) * ry * 1.12;
        const x = cx + px * Math.cos(lean) - py * Math.sin(lean);
        const y = cy + px * Math.sin(lean) + py * Math.cos(lean);
        const color = item.color ?? PALETTE.pink;
        const lit = focus === index;
        const blink = 0.6 + 0.4 * Math.sin(time * 1.6 + index * 1.7);
        glow(ctx, x, y, lit ? 22 : 9, color, lit ? 1 : 0.55 * blink + 0.2);
        glow(ctx, x, y, 2.2, PALETTE.white, 0.95);
        hits.add(index, x, y, 15);
        if (lit) tag(ctx, x, y, item.title, color, x > cx);
      });
      // A fleet led by a Titan sails in and through; a corvette comes back out the other way.
      const jump = run(time, 18, 0, 11, [cx - size * 2, cy + size * 0.55], [cx, cy]);
      if (jump) {
        const shrink = jump.t > 0.75 ? 1 - (jump.t - 0.75) * 3.6 : 1;
        const fade = jump.alpha * Math.max(0, shrink);
        drawShip(ctx, 'titan', jump.x, jump.y, jump.angle, size * 0.36 * Math.max(0.1, shrink), PALETTE.sky, time, fade);
        drawShip(ctx, 'corvette', jump.x - size * 0.3, jump.y + size * 0.14, jump.angle, size * 0.07, PALETTE.sky, time, fade);
        drawShip(ctx, 'corvette', jump.x - size * 0.36, jump.y - size * 0.06, jump.angle, size * 0.07, PALETTE.sky, time, fade);
        if (jump.t > 0.9) glow(ctx, cx, cy, size * 0.6 * (jump.t - 0.9) * 10, PALETTE.white, 0.6 * (1 - (jump.t - 0.9) * 10));
      }
      const back = run(time, 18, 11, 6, [cx, cy], [cx + size * 1.6, cy - size * 0.7]);
      if (back)
        drawShip(
          ctx,
          'corvette',
          back.x,
          back.y,
          back.angle,
          size * 0.09 * Math.min(1, back.t * 4),
          PALETTE.pink,
          time,
          back.alpha,
        );
    },
  };
};
