/** Scenes for the writing pages: all posts (Sentry Array), papers (Science Nexus), blogs (Dyson Sphere). */

import { hashUnit } from '@/lib/megastructures';
import { HitList, type SceneFactory } from './engine';
import { ellipse, glow, neon, PALETTE, rgba, tag } from './kit';
import { drawShip, run } from './ships';

const TAU = Math.PI * 2;

/** All posts: a sensor array sweeping the sector; every post is a contact that flares as the beam passes. */
export const sentry: SceneFactory = (items) => {
  const hits = new HitList();
  const contacts = items.map((item, index) => ({
    angle: hashUnit(item.href ?? item.title) * TAU,
    depth: 0.3 + 0.64 * (items.length > 1 ? index / (items.length - 1) : 0.5),
    color: item.color ?? PALETTE.sky,
  }));
  return {
    hit: (x, y) => hits.find(x, y),
    draw({ ctx, cx, cy, size, time, focus }) {
      hits.reset();
      const tilt = 0.52;
      for (const k of [0.38, 0.68, 1]) {
        ellipse(ctx, cx, cy, size * k, size * k * tilt);
        ctx.setLineDash([3, 7]);
        neon(ctx, PALETTE.sky, 0.28, 0.7);
        ctx.setLineDash([]);
      }
      const sweep = (time * 0.42) % TAU;
      for (let step = 0; step < 30; step++) {
        const a = sweep - step * 0.03;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * size, cy + Math.sin(a) * size * tilt);
        ctx.strokeStyle = rgba(PALETTE.sky, 0.3 * (1 - step / 30));
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      contacts.forEach((contact, index) => {
        const x = cx + Math.cos(contact.angle) * size * contact.depth;
        const y = cy + Math.sin(contact.angle) * size * contact.depth * tilt;
        const since = (((sweep - contact.angle) % TAU) + TAU) % TAU;
        const flare = Math.exp(-since * 1.1);
        const lit = focus === index;
        glow(ctx, x, y, 7 + 12 * flare + (lit ? 16 : 0), contact.color, 0.35 + 0.6 * flare + (lit ? 0.5 : 0));
        glow(ctx, x, y, 2.4, PALETTE.white, 0.95);
        hits.add(index, x, y, 14);
        if (lit) tag(ctx, x, y, items[index].title, contact.color, x > cx + size * 0.4);
      });
      // The array: a hexagonal hub with three sensor dishes turning slowly.
      ctx.beginPath();
      for (let side = 0; side <= 6; side++) {
        const a = (side / 6) * TAU;
        const px = cx + Math.cos(a) * size * 0.07;
        const py = cy + Math.sin(a) * size * 0.07 * 0.8;
        if (side === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      neon(ctx, PALETTE.gold, 0.9, 1.1);
      for (let arm = 0; arm < 3; arm++) {
        const a = time * 0.12 + (arm / 3) * TAU;
        const ex = cx + Math.cos(a) * size * 0.2;
        const ey = cy + Math.sin(a) * size * 0.2 * tilt;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * size * 0.07, cy + Math.sin(a) * size * 0.056);
        ctx.lineTo(ex, ey);
        neon(ctx, PALETTE.gold, 0.7, 0.9);
        ellipse(ctx, ex, ey, size * 0.045, size * 0.02, a + Math.PI / 2, Math.PI, TAU);
        neon(ctx, PALETTE.gold, 0.9, 1);
      }
      glow(ctx, cx, cy, size * 0.12, PALETTE.gold, 0.5);
      // A Titan on patrol, with two corvettes on its flank.
      const patrol = run(time, 44, 3, 30, [cx - size * 1.9, cy + size * 0.5], [cx + size * 1.7, cy + size * 0.2]);
      if (patrol) {
        drawShip(ctx, 'titan', patrol.x, patrol.y, patrol.angle, size * 0.42, PALETTE.sky, time, patrol.alpha);
        drawShip(
          ctx,
          'corvette',
          patrol.x - size * 0.2,
          patrol.y + size * 0.16,
          patrol.angle,
          size * 0.08,
          PALETTE.sky,
          time,
          patrol.alpha,
        );
        drawShip(
          ctx,
          'corvette',
          patrol.x - size * 0.28,
          patrol.y - size * 0.12,
          patrol.angle,
          size * 0.08,
          PALETTE.sky,
          time,
          patrol.alpha,
        );
      }
    },
  };
};

/** Papers: a research station whose arms carry one lab module per paper, data streaming into the core. */
export const nexus: SceneFactory = (items) => {
  const hits = new HitList();
  const count = Math.max(3, items.length);
  return {
    hit: (x, y) => hits.find(x, y),
    draw({ ctx, cx, cy, size, time, focus }) {
      hits.reset();
      const tilt = 0.5;
      const reach = size * 0.82;
      ellipse(ctx, cx, cy, reach, reach * tilt);
      neon(ctx, PALETTE.violet, 0.5, 1);
      ellipse(ctx, cx, cy, reach * 1.08, reach * 1.08 * tilt);
      ctx.setLineDash([2, 9]);
      neon(ctx, PALETTE.violet, 0.3, 0.7);
      ctx.setLineDash([]);
      glow(ctx, cx, cy, size * 0.38, PALETTE.gold, 0.35);
      glow(ctx, cx, cy, size * 0.12, PALETTE.white, 0.9);
      ellipse(ctx, cx, cy, size * 0.13, size * 0.13);
      neon(ctx, PALETTE.gold, 0.9, 1.1);
      for (let module = 0; module < count; module++) {
        const a = time * 0.09 + (module / count) * TAU;
        const x = cx + Math.cos(a) * reach;
        const y = cy + Math.sin(a) * reach * tilt;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * size * 0.13, cy + Math.sin(a) * size * 0.13 * tilt);
        ctx.lineTo(x, y);
        neon(ctx, PALETTE.violet, 0.55, 0.9);
        // Data packets falling into the core along each arm.
        for (let packet = 0; packet < 3; packet++) {
          const t = (time * 0.35 + packet / 3 + module * 0.21) % 1;
          glow(ctx, x + (cx - x) * t, y + (cy - y) * t, 5, PALETTE.sky, 0.9 * (1 - t));
        }
        const item = items[module];
        const lit = item && focus === module;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(a + Math.PI / 2);
        ctx.beginPath();
        ctx.rect(-size * 0.07, -size * 0.035, size * 0.14, size * 0.07);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba(PALETTE.hull, 0.95);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        neon(ctx, item ? PALETTE.gold : PALETTE.violet, item ? 0.95 : 0.4, 1);
        ctx.restore();
        if (item) {
          glow(ctx, x, y, lit ? size * 0.22 : size * 0.1, PALETTE.gold, lit ? 0.9 : 0.45);
          hits.add(module, x, y, size * 0.12);
          if (lit) tag(ctx, x, y, item.title, PALETTE.gold, x > cx);
        }
      }
      // Two science vessels on a wide survey orbit.
      for (let ship = 0; ship < 2; ship++) {
        const a = time * 0.16 + ship * Math.PI;
        const x = cx + Math.cos(a) * size * 1.25;
        const y = cy + Math.sin(a) * size * 1.25 * 0.36;
        const heading = Math.atan2(Math.cos(a) * 0.36, -Math.sin(a));
        drawShip(ctx, 'science', x, y, heading, size * 0.12, PALETTE.sky, time, Math.sin(a) > -0.2 ? 1 : 0.45);
      }
    },
  };
};

/** Blogs: a Dyson sphere around a star, one panel per post; a few slots stay empty for posts not yet written. */
export const dyson: SceneFactory = (items) => {
  const hits = new HitList();
  const slots = items.length + 5;
  const golden = Math.PI * (3 - Math.sqrt(5));
  return {
    hit: (x, y) => hits.find(x, y),
    draw({ ctx, cx, cy, size, time, focus }) {
      hits.reset();
      const radius = size * 0.7;
      glow(ctx, cx, cy, radius * 1.15, PALETTE.amber, 0.55);
      glow(ctx, cx, cy, radius * 0.45, PALETTE.white, 0.95);
      // Lattice: latitude rings and slowly turning meridians.
      for (let lat = -2; lat <= 2; lat++) {
        const h = (lat / 3) * radius;
        const r = Math.sqrt(radius * radius - h * h);
        ellipse(ctx, cx, cy - h, r, r * 0.22);
        neon(ctx, PALETTE.gold, 0.18, 0.6);
      }
      for (let meridian = 0; meridian < 6; meridian++) {
        const phi = (meridian / 6) * Math.PI + time * 0.05;
        ellipse(ctx, cx, cy, radius * Math.abs(Math.cos(phi)), radius);
        neon(ctx, PALETTE.gold, 0.15, 0.6);
      }
      let emptyScreen: [number, number] | null = null;
      for (let slot = 0; slot < slots; slot++) {
        const y = 1 - (2 * (slot + 0.5)) / slots;
        const ring = Math.sqrt(1 - y * y);
        const theta = slot * golden + time * 0.05;
        const z = Math.sin(theta) * ring;
        if (z < -0.1) continue;
        const sx = cx + Math.cos(theta) * ring * radius;
        const sy = cy - y * radius;
        const scale = size * 0.06 * (0.55 + 0.45 * z);
        const item = items[slot];
        ctx.beginPath();
        for (let side = 0; side <= 6; side++) {
          const a = (side / 6) * TAU + Math.PI / 6;
          const px = sx + Math.cos(a) * scale * (0.5 + 0.5 * Math.abs(Math.cos(theta)));
          const py = sy + Math.sin(a) * scale;
          if (side === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        if (!item) {
          ctx.setLineDash([2, 3]);
          neon(ctx, PALETTE.gold, 0.35 * (0.5 + z), 0.6);
          ctx.setLineDash([]);
          if (!emptyScreen && z > 0.3) emptyScreen = [sx, sy];
          continue;
        }
        const color = item.color ?? PALETTE.pink;
        const lit = focus === slot;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = rgba(PALETTE.hull, 0.82);
        ctx.fill();
        ctx.globalCompositeOperation = 'lighter';
        neon(ctx, color, (0.5 + 0.5 * z) * (lit ? 1 : 0.8), lit ? 1.6 : 1);
        glow(ctx, sx, sy, scale * (lit ? 3 : 1.2), color, lit ? 0.8 : 0.25 + 0.2 * z);
        hits.add(slot, sx, sy, Math.max(10, scale * 1.4));
        if (lit) tag(ctx, sx, sy, item.title, color, sx > cx);
      }
      // A construction ship keeps bringing the next panel.
      if (emptyScreen) {
        const trip = run(time, 16, 1, 11, [cx - size * 1.7, cy + size * 0.95], emptyScreen);
        if (trip) {
          drawShip(ctx, 'constructor', trip.x, trip.y, trip.angle, size * 0.1, PALETTE.gold, time, trip.alpha);
          glow(
            ctx,
            trip.x - Math.cos(trip.angle) * size * 0.09,
            trip.y - Math.sin(trip.angle) * size * 0.09,
            6,
            PALETTE.pink,
            trip.alpha,
          );
        }
      }
    },
  };
};
