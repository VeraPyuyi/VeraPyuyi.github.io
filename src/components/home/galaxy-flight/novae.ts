/**
 * The homepage news, as novae: each telegram in the corner has a new star in the opening sky.
 * A nova flares when its news is posted and fades back to an ordinary star over the following
 * weeks (`novaGlow`, worked out here in the browser so it keeps fading between deploys). The
 * novae hang far beyond the galaxies, fixed to the sky, and leave with the opening view.
 */

import { cameraAt, FIELD_OF_VIEW, project } from '@/lib/galaxy-flight';
import type { Mat4, Vec3 } from '@/lib/galaxy-flight/scene';
import { NOVA_SLOTS, novaGlow } from '@/lib/news';

/** How far ahead the novae are drawn: far enough that the flight shows no parallax on them. */
const SKY_DISTANCE = 1500;
/** Progress along the route by which the novae and telegrams have gone (with the opening view). */
const GONE_BY = 0.45;

const clamp = (value: number) => Math.min(1, Math.max(0, value));
const normalize = (v: Vec3): Vec3 => {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
};
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Direction of a point on the opening view's screen (x right, y up, -1…1). */
function skyDirection(slot: readonly [number, number], aspect: number): Vec3 {
  const pose = cameraAt(0, aspect);
  const forward = normalize([pose.target[0] - pose.eye[0], pose.target[1] - pose.eye[1], pose.target[2] - pose.eye[2]]);
  const right = normalize(cross(forward, pose.up));
  const up = cross(right, forward);
  const spread = Math.tan(FIELD_OF_VIEW / 2);
  const sx = slot[0] * spread * aspect;
  const sy = slot[1] * spread;
  return normalize([
    forward[0] + right[0] * sx + up[0] * sy,
    forward[1] + right[1] * sx + up[1] * sy,
    forward[2] + right[2] * sx + up[2] * sy,
  ]);
}

export interface NovaFrame {
  viewProjection: Mat4;
  eye: Vec3;
  width: number;
  height: number;
  progress: number;
  warp: boolean;
}

export interface Novae {
  /** Every frame: place each nova and fade the novae and telegrams with the opening view. */
  update(frame: NovaFrame, place: (element: HTMLElement, x: number, y: number, showing: boolean) => void): void;
}

export function createNovae(root: HTMLElement): Novae {
  const novae = [...root.querySelectorAll<HTMLElement>('[data-nova]')].slice(0, NOVA_SLOTS.length);
  const telegrams = root.querySelector<HTMLElement>('[data-telegrams]');
  const now = Date.now();
  for (const nova of novae) {
    const glow = novaGlow(Date.parse(nova.dataset.posted ?? ''), now);
    nova.style.setProperty('--glow', (Number.isFinite(glow) ? glow : 1).toFixed(3));
  }
  let aspect = 0;
  let directions: Vec3[] = [];

  return {
    update(frame, place) {
      const nextAspect = frame.width / Math.max(frame.height, 1);
      if (nextAspect !== aspect) {
        aspect = nextAspect;
        directions = novae.map((_, index) => skyDirection(NOVA_SLOTS[index], aspect));
      }
      const opacity = frame.warp ? 0 : clamp(1 - frame.progress / GONE_BY);
      const idle = opacity < 0.5;
      novae.forEach((nova, index) => {
        const direction = directions[index];
        const point = project(
          frame.viewProjection,
          [
            frame.eye[0] + direction[0] * SKY_DISTANCE,
            frame.eye[1] + direction[1] * SKY_DISTANCE,
            frame.eye[2] + direction[2] * SKY_DISTANCE,
          ],
          frame.width,
          frame.height,
        );
        const shown = point.depth > 0 ? opacity : 0;
        nova.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0)`;
        nova.style.opacity = shown.toFixed(3);
        nova.style.visibility = shown < 0.02 ? 'hidden' : 'visible';
        nova.classList.toggle('is-idle', idle);
        place(nova, point.x, point.y, shown > 0.3);
      });
      if (telegrams) {
        telegrams.style.opacity = opacity.toFixed(3);
        telegrams.style.visibility = opacity < 0.02 ? 'hidden' : 'visible';
        telegrams.classList.toggle('is-idle', idle);
      }
    },
  };
}
