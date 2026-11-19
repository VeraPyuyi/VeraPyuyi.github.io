/** Scenes for the life pages: photo wall (Ring World), moments (Orbital Habitat), about (Matter Decompressor). */

import { hashUnit } from '@/lib/megastructures';
import { HitList, type SceneFactory } from './engine';
import { ellipse, glow, neon, PALETTE, rgba, tag } from './kit';
import { drawShip, run } from './ships';

const TAU = Math.PI * 2;

/** Photo wall: a ring of land around its star; daylight walks around it, and each album holds a stretch. */
export const ringworld: SceneFactory = (items) => {
  const hits = new HitList();
  const SEGMENTS = 28;
  return {
    hit: (x, y) => hits.find(x, y),
    draw({ ctx, cx, cy, size, time, focus }) {
      hits.reset();
      const rx = size * 1.08;
      const ry = size * 0.3;
      const tiltAngle = -0.12;
      const day = time * 0.07;
      const at = (a: number, scale: number): [number, number] => {
        const x = Math.cos(a) * rx * scale;
        const y = Math.sin(a) * ry * scale;
        return [cx + x * Math.cos(tiltAngle) - y * Math.sin(tiltAngle), cy + x * Math.sin(tiltAngle) + y * Math.cos(tiltAngle)];
      };
      const drawHalf = (front: boolean) => {
        for (let segment = 0; segment < SEGMENTS; segment++) {
          const a0 = (segment / SEGMENTS) * TAU;
          const a1 = ((segment + 1) / SEGMENTS) * TAU;
          const mid = (a0 + a1) / 2;
          if (Math.sin(mid) > 0 !== front) continue;
          const owner = items.length ? Math.floor((segment * items.length) / SEGMENTS) : -1;
          const light = 0.2 + 0.8 * Math.max(0, Math.cos(mid - day));
          const lit = owner >= 0 && focus === owner;
          const [ox0, oy0] = at(a0, 1);
          const [ox1, oy1] = at(a1, 1);
          const [ix1, iy1] = at(a1, 0.9);
          const [ix0, iy0] = at(a0, 0.9);
          ctx.beginPath();
          ctx.moveTo(ox0, oy0);
          ctx.lineTo(ox1, oy1);
          ctx.lineTo(ix1, iy1);
          ctx.lineTo(ix0, iy0);
          ctx.closePath();
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = rgba(PALETTE.hull, front ? 0.92 : 0.6);
          ctx.fill();
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = rgba(lit ? PALETTE.pink : PALETTE.sky, (front ? 0.32 : 0.18) * light + (lit ? 0.35 : 0));
          ctx.fill();
          neon(ctx, lit ? PALETTE.pink : PALETTE.sky, (front ? 0.55 : 0.3) * (0.4 + 0.6 * light), 0.7);
          const [hx, hy] = at(mid, 0.95);
          if (owner >= 0) hits.add(owner, hx, hy, size * 0.12);
          if (lit && segment === Math.floor(((owner + 0.5) * SEGMENTS) / items.length))
            tag(ctx, hx, hy, items[owner].title, PALETTE.pink, hx > cx);
        }
      };
      drawHalf(false);
      glow(ctx, cx, cy, size * 0.5, PALETTE.amber, 0.6);
      glow(ctx, cx, cy, size * 0.14, PALETTE.white, 0.95);
      drawHalf(true);
      // Shuttles riding the ring's orbit.
      for (let shuttle = 0; shuttle < 3; shuttle++) {
        const a = time * 0.11 + (shuttle / 3) * TAU;
        const [x, y] = at(a, 1.14);
        const [nx, ny] = at(a + 0.01, 1.14);
        drawShip(
          ctx,
          'transport',
          x,
          y,
          Math.atan2(ny - y, nx - x),
          size * 0.07,
          PALETTE.gold,
          time,
          Math.sin(a) > 0 ? 1 : 0.4,
        );
      }
    },
  };
};

/** Moments: a rotating torus habitat; each recorded day is a lit window, and more lights come on at night. */
export const habitat: SceneFactory = (items) => {
  const hits = new HitList();
  const WINDOWS = 84;
  const owned = new Map<number, number>();
  items.forEach((item, index) => {
    let slot = Math.floor(hashUnit(`${item.meta}${item.title}`) * WINDOWS);
    while (owned.has(slot)) slot = (slot + 1) % WINDOWS;
    owned.set(slot, index);
  });
  return {
    hit: (x, y) => hits.find(x, y),
    draw({ ctx, cx, cy, size, time, focus }) {
      hits.reset();
      const rx = size * 0.95;
      const ry = size * 0.34;
      const spin = time * 0.12;
      const hour = new Date().getHours();
      const night = hour >= 19 || hour < 6;
      // The torus: a band of hull with ribs that carry the spin round.
      ellipse(ctx, cx, cy, rx * 1.06, ry * 1.12);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = rgba(PALETTE.hull, 0.9);
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      neon(ctx, PALETTE.sky, 0.45, 1);
      ellipse(ctx, cx, cy, rx * 0.86, ry * 0.8);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0d1030';
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      neon(ctx, PALETTE.sky, 0.35, 0.8);
      for (let rib = 0; rib < 36; rib++) {
        const a = spin + (rib / 36) * TAU;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * rx * 0.86, cy + Math.sin(a) * ry * 0.8);
        ctx.lineTo(cx + Math.cos(a) * rx * 1.06, cy + Math.sin(a) * ry * 1.12);
        ctx.strokeStyle = rgba(PALETTE.sky, Math.sin(a) > 0 ? 0.22 : 0.1);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      for (let spoke = 0; spoke < 4; spoke++) {
        const a = spin + (spoke / 4) * TAU;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * size * 0.08, cy + Math.sin(a) * size * 0.03);
        ctx.lineTo(cx + Math.cos(a) * rx * 0.86, cy + Math.sin(a) * ry * 0.8);
        neon(ctx, PALETTE.sky, 0.35, 0.8);
      }
      ellipse(ctx, cx, cy, size * 0.09, size * 0.05);
      neon(ctx, PALETTE.gold, 0.9, 1.1);
      glow(ctx, cx, cy, size * 0.14, PALETTE.gold, 0.5);
      for (let window = 0; window < WINDOWS; window++) {
        const a = spin + (window / WINDOWS) * TAU;
        const x = cx + Math.cos(a) * rx * 0.96;
        const y = cy + Math.sin(a) * ry * 0.96;
        const front = Math.sin(a) > -0.2;
        const owner = owned.get(window);
        if (owner !== undefined) {
          const lit = focus === owner;
          glow(ctx, x, y, lit ? 16 : 7, PALETTE.gold, (front ? 0.95 : 0.4) * (lit ? 1.2 : 1));
          glow(ctx, x, y, 1.8, PALETTE.white, front ? 1 : 0.4);
          hits.add(owner, x, y, 12);
          if (lit) tag(ctx, x, y, items[owner].title, PALETTE.gold, x > cx);
        } else {
          const awake = night ? hashUnit(`w${window}`) > 0.55 : hashUnit(`w${window}`) > 0.85;
          glow(ctx, x, y, awake ? 4.5 : 3, awake ? PALETTE.amber : PALETTE.sky, (front ? 0.7 : 0.25) * (awake ? 1 : 0.55));
        }
      }
      // Transports dock at the hub along the axis.
      const arrival = run(time, 13, 0, 8, [cx + size * 0.1, cy - size * 1.15], [cx, cy - size * 0.07]);
      if (arrival)
        drawShip(ctx, 'transport', arrival.x, arrival.y, arrival.angle, size * 0.08, PALETTE.gold, time, arrival.alpha);
      const departure = run(time, 13, 6.5, 8, [cx, cy + size * 0.07], [cx - size * 0.15, cy + size * 1.15]);
      if (departure)
        drawShip(ctx, 'transport', departure.x, departure.y, departure.angle, size * 0.08, PALETTE.sky, time, departure.alpha);
    },
  };
};

/** About: a black hole with a decompressor drawing matter out of it — the stream is made of the words about me. */
export const decompressor: SceneFactory = (items) => {
  const source = items[0]?.title ?? 'Pyuyi';
  // Chinese drifts out character by character, other languages word by word.
  const cjk = /[\u4e00-\u9fff]/.test(source);
  const words = (cjk ? [...source] : source.split(/\s+/)).filter((part) => part.trim());
  const motes = Array.from({ length: 150 }, (_, index) => ({
    radius: 0.32 + hashUnit(`r${index}`) * 0.34,
    angle: hashUnit(`a${index}`) * TAU,
    size: 0.6 + hashUnit(`s${index}`) * 1.4,
  }));
  return {
    hit: () => -1,
    draw({ ctx, cx, cy, size, time }) {
      const hx = cx + size * 0.12;
      const hy = cy + size * 0.12;
      const hole = size * 0.2;
      // Accretion disk behind the hole, the lensed arch over it, then the shadow and photon ring.
      glow(ctx, hx, hy, size * 0.75, PALETTE.amber, 0.35);
      for (const mote of motes) {
        const a = mote.angle + time * (0.9 / mote.radius ** 1.5) * 0.25;
        if (Math.sin(a) > 0) continue;
        glow(
          ctx,
          hx + Math.cos(a) * size * mote.radius * 1.6,
          hy + Math.sin(a) * size * mote.radius * 0.28,
          mote.size * 2.2,
          PALETTE.gold,
          0.8,
        );
      }
      ellipse(ctx, hx, hy - hole * 0.15, hole * 1.65, hole * 1.35, 0, Math.PI, TAU);
      neon(ctx, PALETTE.amber, 0.55, 3);
      ellipse(ctx, hx, hy, hole, hole);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.globalCompositeOperation = 'lighter';
      neon(ctx, PALETTE.gold, 0.9, 1.3);
      for (const mote of motes) {
        const a = mote.angle + time * (0.9 / mote.radius ** 1.5) * 0.25;
        if (Math.sin(a) <= 0) continue;
        glow(
          ctx,
          hx + Math.cos(a) * size * mote.radius * 1.6,
          hy + Math.sin(a) * size * mote.radius * 0.28,
          mote.size * 2.2,
          PALETTE.white,
          0.85,
        );
      }
      // The decompressor: an arc frame of emitters around the upper horizon.
      ellipse(ctx, hx, hy, size * 0.62, size * 0.5, 0, Math.PI * 1.08, Math.PI * 1.92);
      neon(ctx, PALETTE.sky, 0.8, 1.6);
      for (let node = 0; node <= 6; node++) {
        const a = Math.PI * 1.08 + (node / 6) * Math.PI * 0.84;
        const pulse = 0.5 + 0.5 * Math.sin(time * 2.4 - node * 0.7);
        glow(ctx, hx + Math.cos(a) * size * 0.62, hy + Math.sin(a) * size * 0.5, 8 + pulse * 8, PALETTE.sky, 0.5 + 0.5 * pulse);
      }
      // The stream: matter lifted from the horizon and carried off to a collector — as letters.
      const start: [number, number] = [hx - hole * 0.2, hy - hole * 1.05];
      const bend: [number, number] = [hx - size * 0.35, hy - size * 0.95];
      const end: [number, number] = [cx - size * 1.05, cy - size * 0.55];
      const point = (t: number): [number, number] => [
        (1 - t) ** 2 * start[0] + 2 * (1 - t) * t * bend[0] + t * t * end[0],
        (1 - t) ** 2 * start[1] + 2 * (1 - t) * t * bend[1] + t * t * end[1],
      ];
      for (let mote = 0; mote < 40; mote++) {
        const t = (time * 0.06 + mote / 40) % 1;
        const [x, y] = point(t);
        glow(ctx, x, y, 4, PALETTE.gold, 0.6 * Math.sin(t * Math.PI));
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = '500 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Words leave the horizon one after another, so the sentence reads on along the stream.
      const slots = cjk ? 18 : 8;
      const head = (time * 0.05 + 1) * slots;
      for (let n = Math.floor(head - slots) + 1; n <= Math.floor(head); n++) {
        if (n < 0) continue;
        const t = (head - n) / slots;
        const [x, y] = point(t);
        ctx.fillStyle = rgba(PALETTE.white, 0.85 * Math.sin(t * Math.PI));
        ctx.fillText(words[n % words.length], x, y - 10);
      }
      ctx.globalCompositeOperation = 'lighter';
      ellipse(ctx, end[0], end[1], size * 0.08, size * 0.08);
      neon(ctx, PALETTE.sky, 0.9, 1.2);
      glow(ctx, end[0], end[1], size * 0.16, PALETTE.sky, 0.5);
      // A Titan stands guard over the works.
      drawShip(
        ctx,
        'titan',
        cx + size * 1.1,
        cy + size * 0.5 + Math.sin(time * 0.5) * 4,
        Math.PI * 1.06,
        size * 0.36,
        PALETTE.sky,
        time,
      );
    },
  };
};
