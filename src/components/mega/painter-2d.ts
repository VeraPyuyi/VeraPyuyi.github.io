/** Fallback for browsers without WebGL2: the line-art scenes on a painted starfield. */

import type { MegaItem } from '@/lib/megastructures';
import type { Frame, Layout, Painter, SceneFactory } from './engine';

/** Seeded stars for the backdrop: [x, y, size, phase] in unit coordinates. */
function makeStars(count: number): Float32Array {
  const stars = new Float32Array(count * 4);
  let seed = 1013904223;
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let index = 0; index < count; index++) {
    stars.set([next(), next(), next() ** 3, next()], index * 4);
  }
  return stars;
}

/** The eyepiece photo feathered into the sky so it reads as a distant galaxy, not a sticker. */
function featherGalaxy(image: HTMLImageElement): HTMLCanvasElement | null {
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 256;
  const g = sprite.getContext('2d');
  if (!g) return null;
  g.drawImage(image, 0, 0, 256, 256);
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(128, 128, 36, 128, 128, 128);
  mask.addColorStop(0, '#000');
  mask.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, 256, 256);
  return sprite;
}

export function createPainter2d(
  canvas: HTMLCanvasElement,
  factory: SceneFactory,
  items: readonly MegaItem[],
  galaxySrc?: string,
): Painter | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const scene = factory(items);
  const stars = makeStars(260);
  let galaxy: HTMLCanvasElement | null = null;
  if (galaxySrc) {
    const image = new Image();
    image.onload = () => {
      galaxy = featherGalaxy(image);
    };
    image.src = galaxySrc;
  }
  return {
    hit: (x, y) => scene.hit(x, y),
    dispose: () => undefined,
    paint(layout: Layout) {
      const { width, height, ratio, wide } = layout;
      const frame: Frame = { ctx, ...layout };
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, '#0b0d2a');
      sky.addColorStop(1, '#151a42');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      if (galaxy) {
        const size = Math.min(width, height) * (wide ? 0.5 : 0.36);
        ctx.globalAlpha = 0.55;
        ctx.drawImage(galaxy, width * (wide ? 0.92 : 0.86) - size / 2, height * 0.2 - size / 2, size, size);
      }
      for (let index = 0; index < stars.length; index += 4) {
        const twinkle = 0.55 + 0.45 * Math.sin(layout.time * (0.6 + stars[index + 3] * 2) + stars[index + 3] * 40);
        ctx.globalAlpha = 0.25 + 0.6 * twinkle * (0.4 + stars[index + 2]);
        ctx.fillStyle = stars[index + 3] > 0.8 ? '#ffe6c2' : '#dfe6ff';
        const r = 0.5 + stars[index + 2] * 1.3;
        ctx.fillRect(stars[index] * width, stars[index + 1] * height, r, r);
      }
      ctx.globalAlpha = 1;
      scene.draw(frame);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    },
  };
}
