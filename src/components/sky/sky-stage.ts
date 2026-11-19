/**
 * One stop of the homepage flight, live, behind an inner page's hero: the page's own galaxy
 * turning, floating and twinkling in WebGL (or the ray-traced black hole), framed the way the
 * homepage frames it. The pointer nudges the camera; scrolling lets the object recede into the
 * dawn. Elements marked `data-ring-angle` ride the galaxy's ring in 3D (the gallery's photos on
 * Hoag's Object). Without WebGL2, or with reduced motion, the hero keeps its still image.
 */

import { createFrameGuard } from '@/components/home/galaxy-flight/frame-guard';
import { loadModels } from '@/components/home/galaxy-flight/model-loader';
import { createGalaxyRenderer, type ParticleLayer } from '@/components/home/galaxy-flight/renderer';
import {
  cameraAt,
  FIELD_OF_VIEW,
  GALAXY_PLACEMENTS,
  galaxyDrift,
  galaxyModelMatrix,
  localToWorld,
  lookAt,
  multiply,
  perspective,
  project,
  ROUTE,
} from '@/lib/galaxy-flight';
import { blackHoleFrame, invert } from '@/lib/galaxy-flight/black-hole';
import type { Vec3 } from '@/lib/galaxy-flight/scene';

const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
/** Radius of Hoag's ring in galaxy units (see `ring` in src/lib/galaxy-flight/models.ts). */
const RING_RADIUS = 0.74;
/**
 * How a hero frames its object compared with the homepage: `back` moves the camera further away,
 * `aside` (in object radii) slides the object right, clear of the title on wide screens.
 */
const HERO_FRAMING: Record<string, { back: number; aside: number }> = { hole: { back: 1.45, aside: 0.15 } };
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: Vec3): Vec3 => scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

/** Starts the live sky in `hero`; returns a function that stops it and frees the GPU. */
export function mountSkyStage(hero: HTMLElement): () => void {
  const object = hero.dataset.object;
  const canvas = hero.querySelector<HTMLCanvasElement>('[data-sky-canvas]');
  const still =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('motion-off');
  // Where the live sky cannot run, the still image stands in for it.
  const fallBack = () => {
    hero.classList.add('is-still');
    return () => undefined;
  };
  if (!object || !canvas || still) return fallBack();
  const index = object === 'hole' ? ROUTE.length - 1 : GALAXY_PLACEMENTS.findIndex((placement) => placement.kind === object);
  if (index < 0) return fallBack();
  const created = createGalaxyRenderer(canvas);
  if (!created) return fallBack();
  // On a slow machine, show the still image after a moment rather than an empty sky; the live one
  // still takes over when it is ready.
  const stillTimer = window.setTimeout(() => hero.classList.add('is-still'), 2600);
  const renderer = created;

  const galaxy = GALAXY_PLACEMENTS[index];
  const hole = galaxy ? null : blackHoleFrame();
  const stop = ROUTE[index];
  const framing = HERO_FRAMING[object] ?? { back: 1, aside: 0 };
  const riders = [...hero.querySelectorAll<HTMLElement>('[data-ring-angle]')].map((element) => ({
    element,
    angle: Number(element.dataset.ringAngle) || 0,
  }));
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
  let width = 1;
  let height = 1;
  const guard = createFrameGuard({
    maxRatio: small ? 1.25 : 1.75,
    onRatioChange: () => resize(),
    onDetailChange: (detail) => renderer.setDetail(detail),
  });
  const resize = () => {
    width = canvas.clientWidth || hero.clientWidth;
    height = canvas.clientHeight || hero.clientHeight;
    renderer.resize(width, height, Math.min(window.devicePixelRatio || 1, guard.maxRatio));
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  let backdropIn = false;
  let galaxyIn = false;
  /** The live sky takes over from the still image only after its first full frame is drawn. */
  let shown = false;
  let instant = false;
  let time = 0;
  const models = loadModels({
    small,
    progress: Math.max(0, index),
    only: galaxy ? [galaxy.kind] : [],
    share: hero.classList.contains('is-compact') ? 0.45 : 0.7,
    // Models arrive at full strength: the cross-fade from the still image is the only transition,
    // so the object never dims in between. One kept from earlier in the visit swaps in instantly.
    onBuilt: ({ id, light, dust }, cached) => {
      if (id === 'backdrop') {
        renderer.upload('backdrop', light);
        backdropIn = true;
        if (!galaxy) instant = cached;
      } else {
        renderer.upload(`${id}-light`, light);
        if (dust) renderer.upload(`${id}-dust`, dust);
        galaxyIn = true;
        instant = cached;
      }
    },
  });

  // Follow the pointer a little, eased, so the object feels like it hangs in real depth.
  const pointer = { x: 0, y: 0, eased: [0, 0] as [number, number] };
  const onPointer = (event: PointerEvent) => {
    const rect = hero.getBoundingClientRect();
    pointer.x = clamp((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = clamp((event.clientY - rect.top) / rect.height) * 2 - 1;
  };
  hero.addEventListener('pointermove', onPointer, { passive: true });

  let visible = true;
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  visibility.observe(hero);

  let angle = 0;
  let skyTurn = 0;
  let last = performance.now();
  let frame = requestAnimationFrame(tick);

  function tick(now: number) {
    frame = requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!visible || document.visibilityState !== 'visible') return;
    time += dt;

    const aspect = width / Math.max(1, height);
    pointer.eased[0] += (pointer.x - pointer.eased[0]) * (1 - Math.exp(-dt * 2.5));
    pointer.eased[1] += (pointer.y - pointer.eased[1]) * (1 - Math.exp(-dt * 2.5));
    const pose = cameraAt(index, aspect, [pointer.eased[0] * stop.radius * 0.06, -pointer.eased[1] * stop.radius * 0.04]);
    // As the page scrolls into the dawn, the object slips further away.
    const scroll = clamp(window.scrollY / Math.max(1, hero.offsetHeight));
    const wide = clamp((aspect - 1.15) / 0.55);
    const forward = normalize(sub(pose.target, pose.eye));
    const right = normalize(cross(forward, pose.up));
    const target = sub(pose.target, scale(right, stop.radius * framing.aside * wide));
    const eye = mix(pose.eye, pose.target, 1 - framing.back - scroll * 0.35);
    const view = lookAt(eye, target, pose.up);
    const projection = perspective(FIELD_OF_VIEW, aspect, 0.05, 3000);
    const viewProjection = multiply(projection, view);

    const layers: ParticleLayer[] = [];
    if (backdropIn) {
      layers.push({
        mesh: 'backdrop',
        model: IDENTITY,
        modelScale: 1,
        spin: skyTurn,
        wobble: 0,
        alpha: 1,
        dust: false,
        soft: [6.5, 8],
        spikes: 1,
      });
    }
    const drift = galaxyDrift(Math.max(0, index), time);
    if (galaxy) {
      angle += galaxy.spin * dt;
      if (galaxyIn) {
        const base = {
          model: galaxyModelMatrix(galaxy, drift),
          modelScale: galaxy.radius,
          spin: angle,
          wobble: 0.012,
          alpha: 1,
          soft: [0.018, 0.045] as const,
        };
        layers.push({ ...base, mesh: `${galaxy.kind}-light`, dust: false });
        layers.push({ ...base, alpha: base.alpha * 0.4, mesh: `${galaxy.kind}-dust`, dust: true });
      }
      const depth = riders.length ? project(viewProjection, localToWorld(galaxy, 0, [0, 0, 0], drift), width, height).depth : 0;
      for (const rider of riders) {
        const local: Vec3 = [RING_RADIUS * Math.cos(rider.angle), 0, RING_RADIUS * Math.sin(rider.angle)];
        const point = project(viewProjection, localToWorld(galaxy, angle, local, drift), width, height);
        const near = clamp(depth / Math.max(1e-3, point.depth), 0.7, 1.3);
        rider.element.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0) scale(${near.toFixed(3)})`;
        rider.element.style.zIndex = near > 1 ? '2' : '1';
      }
    } else {
      // Behind the hole the stars keep drifting, so their lensed arcs sweep round the shadow.
      skyTurn += dt * 0.016;
    }

    renderer.render({
      view,
      projection,
      fieldOfView: FIELD_OF_VIEW,
      time,
      exposure: 1.25,
      layers,
      blackHole: hole
        ? {
            ...hole,
            eye,
            viewProjection,
            inverseViewProjection: invert(viewProjection) ?? IDENTITY,
            time,
            alpha: 1,
          }
        : null,
    });
    if (!shown && (galaxy ? galaxyIn : backdropIn)) {
      shown = true;
      window.clearTimeout(stillTimer);
      if (instant) hero.classList.add('is-instant');
      hero.classList.add('is-live');
    }
    guard.tick(dt, !models.busy);
  }

  return () => {
    cancelAnimationFrame(frame);
    models.stop();
    resizeObserver.disconnect();
    visibility.disconnect();
    hero.removeEventListener('pointermove', onPointer);
    window.clearTimeout(stillTimer);
    hero.classList.remove('is-live', 'is-instant', 'is-still');
    renderer.destroy();
  };
}
