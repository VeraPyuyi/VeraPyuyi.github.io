/**
 * Paints a page's particle nebula (src/lib/sky-nebula.ts) onto its canvas, once. Every particle is
 * a pre-tinted soft sprite, and their light adds up ('lighter'), as in the galaxies. The work is
 * spread over a few frames so the page never stalls, and the canvas fades in when done. After
 * that nothing is redrawn: the canvas only glides and drifts as a composited layer.
 */

import { NEBULA_FIELD, NEBULA_STRIDE, nebulaParticles } from '@/lib/sky-nebula';
import type { SkyEnvironment } from '@/lib/sky-catalog';

const PER_FRAME = 6000;
const SPRITE = 64;

/** A soft round sprite in one colour: a bright core falling off to nothing. */
function sprite(color: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SPRITE;
  canvas.height = SPRITE;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  const gradient = context.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.25, `${color}88`);
  gradient.addColorStop(1, `${color}00`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, SPRITE, SPRITE);
  return canvas;
}

/** Paints the nebula for `env` into `canvas`; returns a function that stops a paint in progress. */
export function paintNebula(canvas: HTMLCanvasElement, env: SkyEnvironment): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => undefined;
  const small = window.innerWidth < 768;
  const { colors, data } = nebulaParticles(env, { columns: !small, share: small ? 0.5 : 1 });
  // One canvas pixel per CSS pixel (a little more on dense screens): nebulae are soft anyway.
  const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
  const scale = Math.min(2400, Math.max(600, canvas.clientWidth * ratio)) / NEBULA_FIELD.width;
  canvas.width = Math.round(NEBULA_FIELD.width * scale);
  canvas.height = Math.round(NEBULA_FIELD.height * scale);
  const sprites = colors.map((color) => sprite(color));
  context.globalCompositeOperation = 'lighter';

  let cursor = 0;
  let frame = requestAnimationFrame(function paint() {
    const end = Math.min(data.length, cursor + PER_FRAME * NEBULA_STRIDE);
    for (; cursor < end; cursor += NEBULA_STRIDE) {
      // Grains narrower than a pixel are drawn at a pixel, fainter, so they stay crisp points.
      const size = Math.max(1.1, data[cursor + 2] * 2 * scale);
      const fade = Math.min(1, (data[cursor + 2] * 2 * scale) / 1.1);
      context.globalAlpha = Math.min(1, data[cursor + 3] * (0.6 + 0.4 * fade));
      context.drawImage(
        sprites[data[cursor + 4]],
        data[cursor] * scale - size / 2,
        data[cursor + 1] * scale - size / 2,
        size,
        size,
      );
    }
    if (cursor < data.length) frame = requestAnimationFrame(paint);
    else canvas.classList.add('is-painted');
  });
  return () => cancelAnimationFrame(frame);
}
