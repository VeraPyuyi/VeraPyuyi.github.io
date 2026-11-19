/**
 * Paints a page's particle nebula (src/lib/sky-nebula.ts) onto its canvas, once. Every particle is
 * a crisp point or, for the few large puffs, a pre-tinted soft sprite; their light adds up
 * ('lighter'), as in the galaxies. The particles are generated in a worker and drawn over a few
 * frames, so the page never stalls; the canvas fades in when done. After that nothing is redrawn:
 * the canvas only glides and drifts as a composited layer.
 */

import { NEBULA_FIELD, NEBULA_STRIDE, type NebulaParticles, nebulaParticles } from '@/lib/sky-nebula';
import type { NebulaJob } from './nebula-worker';
import type { SkyEnvironment } from '@/lib/sky-catalog';

const PER_FRAME = 9000;
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

/** Generates the particles in a worker, or on the main thread where workers are unavailable. */
function generate(job: NebulaJob, done: (particles: NebulaParticles) => void): () => void {
  let worker: Worker | null = null;
  const fallback = () => {
    worker?.terminate();
    worker = null;
    done(nebulaParticles(job.env, job));
  };
  try {
    worker = new Worker(new URL('./nebula-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<NebulaParticles>) => {
      worker?.terminate();
      worker = null;
      done(event.data);
    };
    worker.onerror = fallback;
    worker.postMessage(job);
  } catch {
    fallback();
  }
  return () => worker?.terminate();
}

/** Paints the nebula for `env` into `canvas`; returns a function that stops a paint in progress. */
export function paintNebula(canvas: HTMLCanvasElement, env: SkyEnvironment): () => void {
  const context = canvas.getContext('2d');
  if (!context) return () => undefined;
  const small = window.innerWidth < 768;
  let frame = 0;
  let stopped = false;
  const stopWorker = generate({ env, columns: !small, share: small ? 0.5 : 1 }, ({ colors, data }) => {
    if (stopped) return;
    // Painted at the screen's own pixel density (within a memory cap), so the finest grains are
    // real single pixels rather than smudges.
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(2200, Math.max(600, canvas.clientWidth * ratio)) / NEBULA_FIELD.width;
    canvas.width = Math.round(NEBULA_FIELD.width * scale);
    canvas.height = Math.round(NEBULA_FIELD.height * scale);
    const sprites = colors.map((color) => sprite(color));
    context.globalCompositeOperation = 'lighter';
    let cursor = 0;
    frame = requestAnimationFrame(function paint() {
      const end = Math.min(data.length, cursor + PER_FRAME * NEBULA_STRIDE);
      for (; cursor < end; cursor += NEBULA_STRIDE) {
        const size = data[cursor + 2] * 2 * scale;
        const color = data[cursor + 4];
        if (size < 2.4) {
          // A fine grain is a crisp point: one pixel (or a little more), fainter the smaller it is.
          const side = Math.max(1, size * 0.75);
          context.globalAlpha = Math.min(1, data[cursor + 3] * Math.min(1, 0.55 + size * 0.3));
          context.fillStyle = colors[color];
          context.fillRect(data[cursor] * scale - side / 2, data[cursor + 1] * scale - side / 2, side, side);
          continue;
        }
        context.globalAlpha = Math.min(1, data[cursor + 3]);
        context.drawImage(sprites[color], data[cursor] * scale - size / 2, data[cursor + 1] * scale - size / 2, size, size);
      }
      if (cursor < data.length) frame = requestAnimationFrame(paint);
      else canvas.classList.add('is-painted');
    });
  });
  return () => {
    stopped = true;
    stopWorker();
    cancelAnimationFrame(frame);
  };
}
