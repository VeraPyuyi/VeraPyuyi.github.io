/** The rendered megastructure, with item markers, labels and ships drawn crisply over it. */

import type { MegaItem } from '@/lib/megastructures';
import type { Layout, Painter } from '../engine';
import { HitList, PALETTE, rgba, tag } from '../kit';
import { drawShip } from '../ships';
import { createMegaRenderer, projectPoint } from './renderer';
import type { Mega3D, Vec3 } from './types';

function toLinear(hex: string): Vec3 {
  const value = Number.parseInt(hex.slice(1, 7), 16);
  const channel = (shift: number) => (((value >> shift) & 255) / 255) ** 2.2;
  return [channel(16), channel(8), channel(0)];
}

function reticle(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, time: number, lit: boolean) {
  const r = lit ? 13 : 6;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(time * (lit ? 0.9 : 0.3));
  ctx.strokeStyle = rgba(color, lit ? 0.95 : 0.6);
  ctx.lineWidth = lit ? 1.4 : 1;
  for (let quarter = 0; quarter < 4; quarter++) {
    ctx.beginPath();
    ctx.arc(0, 0, r, quarter * (Math.PI / 2) + 0.25, quarter * (Math.PI / 2) + 1.2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = rgba(PALETTE.white, lit ? 1 : 0.8);
  ctx.beginPath();
  ctx.arc(x, y, lit ? 2.2 : 1.4, 0, Math.PI * 2);
  ctx.fill();
}

export function createPainter3d(
  glCanvas: HTMLCanvasElement,
  overlay: HTMLCanvasElement,
  scene: Mega3D,
  items: readonly MegaItem[],
  galaxySrc?: string,
): Painter | null {
  const count = items.length;
  const data = items.map((_, index) => scene.itemData?.(index, count) ?? ([0, 0, 0, 0] as [number, number, number, number]));
  const renderer = createMegaRenderer(glCanvas, scene, data, galaxySrc);
  if (!renderer) return null;
  const ctx = overlay.getContext('2d');
  if (!ctx) {
    renderer.dispose();
    return null;
  }
  glCanvas.dataset.megaLive = 'true';
  const colors = items.map((item) => toLinear(item.color ?? PALETTE.pink));
  const hits = new HitList();
  let slowFrames = 0;

  return {
    hit: (x, y) => hits.find(x, y),
    dispose: () => renderer.dispose(),
    paint(layout: Layout) {
      const { width, height, ratio, time, cx, cy, size, wide, focus } = layout;
      const galaxySize = Math.min(width, height) * (wide ? 0.55 : 0.4);
      renderer.render({
        time,
        cssWidth: width,
        cssHeight: height,
        centerX: cx,
        centerY: cy,
        size,
        count,
        focus,
        colors,
        galaxyRect: [width * (wide ? 0.9 : 0.86) - galaxySize / 2, height * 0.22 - galaxySize / 2, galaxySize, galaxySize],
      });
      // Keep the frame rate: drop the render resolution after a run of slow frames.
      slowFrames = layout.dt > 1 / 38 ? slowFrames + 1 : Math.max(0, slowFrames - 1);
      if (slowFrames > 45 && renderer.scale > 0.34) {
        renderer.scale *= 0.8;
        slowFrames = 0;
      }

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      const camera = renderer.camera(time);
      const focal = renderer.focal(size);
      const project = (point: Vec3) => projectPoint(camera, focal, cx, cy, point);

      for (const ship of scene.ships?.(time) ?? []) {
        const at = project(ship.position);
        const ahead = project([
          ship.position[0] + ship.heading[0] * 0.01,
          ship.position[1] + ship.heading[1] * 0.01,
          ship.position[2] + ship.heading[2] * 0.01,
        ]);
        if (!at || !ahead) continue;
        const angle = Math.atan2(ahead.y - at.y, ahead.x - at.x);
        drawShip(ctx, ship.kind, at.x, at.y, angle, (ship.length * focal) / at.depth, ship.color, time, ship.alpha);
      }

      scene.overlay?.({ ctx, time, width, height, items, focus, project, camera });

      hits.reset();
      items.forEach((item, index) => {
        const world = scene.marker?.(index, count, time, camera);
        const at = world && project(world);
        if (!at) return;
        const lit = focus === index;
        const color = item.color ?? PALETTE.pink;
        reticle(ctx, at.x, at.y, color, time, lit);
        hits.add(index, at.x, at.y, 16);
        if (lit) tag(ctx, at.x, at.y, item.title, color, at.x > cx);
      });
      ctx.globalCompositeOperation = 'source-over';
    },
  };
}
