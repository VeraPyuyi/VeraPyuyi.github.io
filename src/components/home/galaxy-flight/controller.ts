/**
 * Drives the homepage galaxy flight: scroll position → camera along the route,
 * galaxies turning (slower under the pointer), post stars that follow their arms,
 * and the warp jump that pushes the camera into the chosen star.
 */

import { dayPart, MOON_PHASE_NAMES, MOON_PHASE_NAMES_EN, moonPhase } from '@/lib/galaxy';
import {
  buildBackdrop,
  buildGalaxyModel,
  cameraAt,
  FIELD_OF_VIEW,
  GALAXY_PLACEMENTS,
  galaxyModelMatrix,
  localToWorld,
  lookAt,
  multiply,
  perspective,
  project,
  type Vec3,
} from '@/lib/galaxy-flight';
import type { BuiltModel, ModelJob } from './model-worker';
import { createGalaxyRenderer, type ParticleLayer } from './renderer';

/** Light particles per galaxy on a capable desktop; phones and small machines get about half. */
const BUDGETS = { blogs: 120_000, papers: 100_000, photos: 64_000, moments: 70_000 } as const;
const BACKDROP_BUDGET = 16_000;
/** Matches the warp overlay's aim + spool phases, so the camera arrives as the jump begins. */
const WARP_CAMERA_MS = 2000;
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const GREETINGS = {
  zh: {
    morning: '早安，晨光照进小宇宙了',
    afternoon: '午后好，今天也在认真观测',
    evening: '晚上好，星星陆续亮起来了',
    night: '夜深了，宇宙只为你亮着一盏灯',
  },
  en: {
    morning: 'Good morning — first light in the small universe',
    afternoon: 'Good afternoon — still observing',
    evening: 'Good evening — the stars are coming out',
    night: 'Late night — the universe keeps one light on for you',
  },
} as const;

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const prefersStill = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('motion-off');

interface GalaxyState {
  matrix: Float32Array;
  angle: number;
  speed: number;
  /** Time the particles finished uploading, or -1 while still being built. */
  readyAt: number;
}

interface StarLink {
  element: HTMLAnchorElement;
  galaxy: number;
  local: Vec3;
}

interface Warp {
  start: number;
  eye: Vec3;
  target: Vec3;
  point: Vec3;
}

function paintIntro(root: HTMLElement) {
  const en = root.dataset.locale === 'en';
  const greeting = root.querySelector('[data-flight-greeting]');
  if (greeting) greeting.textContent = (en ? GREETINGS.en : GREETINGS.zh)[dayPart(new Date().getHours())];
  const moon = root.querySelector('[data-flight-moon]');
  if (moon) {
    const { index } = moonPhase(Date.now());
    moon.textContent = en ? `Tonight · ${MOON_PHASE_NAMES_EN[index]}` : `今晚 · ${MOON_PHASE_NAMES[index]}`;
  }
}

/** Starts the flight inside `root`; returns a function that stops it and frees the GPU. */
export function mountGalaxyFlight(root: HTMLElement): () => void {
  const stage = root.querySelector<HTMLElement>('[data-flight-stage]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-flight-canvas]');
  if (!stage || !canvas) return () => undefined;
  paintIntro(root);

  const labels = [...root.querySelectorAll<HTMLElement>('[data-flight-label]')];
  const gotos = [...root.querySelectorAll<HTMLButtonElement>('[data-flight-goto]')];
  const fades = [...root.querySelectorAll<HTMLElement>('[data-flight-fade]')];
  const stars: StarLink[] = [...root.querySelectorAll<HTMLAnchorElement>('[data-flight-star]')].map((element) => ({
    element,
    galaxy: Number(element.dataset.galaxy),
    local: [Number(element.dataset.u), 0, Number(element.dataset.v)],
  }));
  const last = GALAXY_PLACEMENTS.length - 1;
  const galaxies: GalaxyState[] = GALAXY_PLACEMENTS.map((placement) => ({
    matrix: galaxyModelMatrix(placement),
    angle: 0,
    speed: prefersStill() ? 0 : 1,
    readyAt: -1,
  }));

  const renderer = createGalaxyRenderer(canvas);
  root.classList.toggle('is-flat', !renderer);
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
  let maxRatio = small ? 1.25 : 1.5;
  let detail = 1;
  let width = 1;
  let height = 1;
  let backdropReady = -1;

  const resize = () => {
    width = stage.clientWidth || window.innerWidth;
    height = stage.clientHeight || window.innerHeight;
    renderer?.resize(width, height, Math.min(window.devicePixelRatio || 1, maxRatio));
  };
  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(stage);

  const scrollProgress = () => {
    const travel = root.offsetHeight - window.innerHeight;
    if (travel <= 0) return 0;
    return clamp(-root.getBoundingClientRect().top / travel) * last;
  };
  let progress = scrollProgress();
  let time = 0;
  let lastFrame = performance.now();
  let raf = 0;
  let pointer: { x: number; y: number } | null = null;
  let hoverGalaxy = -1;
  let hoverStar = -1;
  let warp: Warp | null = null;
  let viewProjection: Float32Array = IDENTITY;
  let slowFrames = 0;
  let fastFrames = 0;

  // Build the particles nearest galaxy first, in a worker when possible so scrolling never stutters.
  const jobs: ModelJob[] = [];
  if (renderer) {
    jobs.push({ id: 'backdrop', kind: 'backdrop', budget: BACKDROP_BUDGET * (small ? 0.6 : 1) });
    const order = GALAXY_PLACEMENTS.map((_, index) => index).sort((a, b) => Math.abs(a - progress) - Math.abs(b - progress));
    for (const index of order) {
      const { kind } = GALAXY_PLACEMENTS[index];
      jobs.push({ id: kind, kind, budget: BUDGETS[kind] * (small ? 0.5 : 1) });
    }
  }
  const pending = new Set(jobs.map((job) => job.id));
  const receive = ({ id, light, dust }: BuiltModel) => {
    if (!renderer || !pending.delete(id)) return;
    if (id === 'backdrop') {
      renderer.upload('backdrop', light);
      backdropReady = time;
      return;
    }
    renderer.upload(`${id}-light`, light);
    if (dust) renderer.upload(`${id}-dust`, dust);
    const index = GALAXY_PLACEMENTS.findIndex((placement) => placement.kind === id);
    if (index >= 0) galaxies[index].readyAt = time;
  };
  let buildTimer = 0;
  const buildOnMainThread = () => {
    const job = jobs.find((candidate) => pending.has(candidate.id));
    if (!job) return;
    if (job.kind === 'backdrop') receive({ id: job.id, light: buildBackdrop(job.budget) });
    else receive({ id: job.id, ...buildGalaxyModel(job.kind, job.budget) });
    buildTimer = window.setTimeout(buildOnMainThread, 16);
  };
  let worker: Worker | null = null;
  if (jobs.length) {
    try {
      worker = new Worker(new URL('./model-worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<BuiltModel>) => receive(event.data);
      worker.onerror = () => {
        worker?.terminate();
        worker = null;
        buildOnMainThread();
      };
      for (const job of jobs) worker.postMessage(job);
    } catch {
      worker = null;
      buildTimer = window.setTimeout(buildOnMainThread, 0);
    }
  }

  const infoDefaults = labels.map((label) => ({
    head: label.querySelector('[data-flight-info-head]')?.textContent ?? '',
    title: label.querySelector('[data-flight-info-title]')?.textContent ?? '',
  }));
  const setInfo = (galaxy: number, head: string, title: string) => {
    const label = labels[galaxy];
    const headEl = label?.querySelector('[data-flight-info-head]');
    const titleEl = label?.querySelector('[data-flight-info-title]');
    if (headEl) headEl.textContent = head;
    if (titleEl) titleEl.textContent = title;
  };

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, now - lastFrame) / 1000);
    lastFrame = now;
    time += dt;
    const still = prefersStill();
    if (!warp) {
      const target = scrollProgress();
      progress += (target - progress) * (still ? 1 : 1 - Math.exp(-dt * 4.5));
      if (Math.abs(target - progress) < 1e-4) progress = target;
    }

    const aspect = width / height;
    const pose = cameraAt(progress, aspect);
    let eye = pose.eye;
    let target = pose.target;
    if (warp) {
      const k = easeInOut(clamp((now - warp.start) / WARP_CAMERA_MS));
      eye = mix(warp.eye, warp.point, k * 0.86);
      target = mix(warp.target, warp.point, clamp(k * 1.8));
    }
    const view = lookAt(eye, target, pose.up);
    const projection = perspective(FIELD_OF_VIEW, aspect, 0.05, 3000);
    viewProjection = multiply(projection, view);

    // Galaxy under the pointer (only the one we are visiting) and the spin it should have.
    const active = Math.round(progress);
    hoverGalaxy = -1;
    if (pointer && Math.abs(progress - active) < 0.3) {
      const placement = GALAXY_PLACEMENTS[active];
      const center = project(viewProjection, placement.center, width, height);
      const rim = project(viewProjection, localToWorld(placement, 0, [1, 0, 0]), width, height);
      const reach = Math.hypot(rim.x - center.x, rim.y - center.y);
      if (center.depth > 0 && Math.hypot(pointer.x - center.x, pointer.y - center.y) < reach * 0.95) hoverGalaxy = active;
    }
    galaxies.forEach((galaxy, index) => {
      const goal = still || warp || hoverStar === index ? 0 : hoverGalaxy === index ? 0.12 : 1;
      galaxy.speed += (goal - galaxy.speed) * (1 - Math.exp(-dt / 0.45));
      galaxy.angle += GALAXY_PLACEMENTS[index].spin * galaxy.speed * dt;
    });

    if (renderer) {
      const layers: ParticleLayer[] = [];
      if (backdropReady >= 0) {
        layers.push({
          mesh: 'backdrop',
          model: IDENTITY,
          modelScale: 1,
          spin: 0,
          wobble: 0,
          alpha: clamp((time - backdropReady) / 0.8),
          dust: false,
          soft: [6.5, 8],
        });
      }
      const byDistance = GALAXY_PLACEMENTS.map((placement, index) => ({
        index,
        distance: Math.hypot(placement.center[0] - eye[0], placement.center[1] - eye[1], placement.center[2] - eye[2]),
      })).sort((a, b) => b.distance - a.distance);
      for (const { index } of byDistance) {
        const galaxy = galaxies[index];
        if (galaxy.readyAt < 0) continue;
        const placement = GALAXY_PLACEMENTS[index];
        const base = {
          model: galaxy.matrix,
          modelScale: placement.radius,
          spin: galaxy.angle,
          wobble: still ? 0 : 0.012,
          alpha: easeInOut(clamp((time - galaxy.readyAt) / 1.4)),
          soft: [0.018, 0.045] as const,
        };
        layers.push({ ...base, mesh: `${placement.kind}-light`, dust: false });
        layers.push({ ...base, mesh: `${placement.kind}-dust`, dust: true });
      }
      renderer.render({ view, projection, fieldOfView: FIELD_OF_VIEW, time, exposure: 1.25, layers });
    }

    updateOverlay();
    adapt(dt);
  }

  function updateOverlay() {
    for (const star of stars) {
      const placement = GALAXY_PLACEMENTS[star.galaxy];
      const point = project(viewProjection, localToWorld(placement, galaxies[star.galaxy].angle, star.local), width, height);
      const near = clamp(1 - Math.abs(progress - star.galaxy) * 2.2);
      const opacity = point.depth > 0.5 && !warp ? near : 0;
      const scale = clamp((placement.radius * 2.3) / Math.max(point.depth, 0.01), 0.55, 1.5);
      const style = star.element.style;
      style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      style.opacity = opacity.toFixed(3);
      style.visibility = opacity < 0.02 ? 'hidden' : 'visible';
      star.element.classList.toggle('is-idle', opacity < 0.5);
    }
    labels.forEach((label, index) => {
      const offset = progress - index;
      const opacity = warp ? 0 : clamp(1 - Math.abs(offset) * 2.4);
      label.style.opacity = opacity.toFixed(3);
      label.style.transform = `translate3d(0, ${(-offset * 48).toFixed(1)}px, 0)`;
      label.style.visibility = opacity < 0.02 ? 'hidden' : 'visible';
    });
    const nearest = Math.round(progress);
    gotos.forEach((button, index) => button.toggleAttribute('aria-current', index === nearest));
    root.style.setProperty('--flight-progress', (progress / last).toFixed(4));
    for (const element of fades) {
      const until = Number(element.dataset.flightFade) || 0.3;
      element.style.opacity = warp ? '0' : clamp(1 - progress / until).toFixed(3);
    }
  }

  /** Keeps the frame rate smooth: first lower the resolution, then draw fewer particles. */
  function adapt(dt: number) {
    if (!renderer || pending.size || document.visibilityState !== 'visible') return;
    if (dt > 1 / 38) slowFrames++;
    else if (dt < 1 / 57) fastFrames++;
    if (slowFrames > 45) {
      slowFrames = 0;
      fastFrames = 0;
      if (maxRatio > 1) {
        maxRatio = 1;
        resize();
      } else if (detail > 0.35) {
        detail *= 0.8;
        renderer.setDetail(detail);
      }
    } else if (fastFrames > 240) {
      fastFrames = 0;
      slowFrames = 0;
      if (detail < 1) {
        detail = Math.min(1, detail * 1.1);
        renderer.setDetail(detail);
      }
    }
  }

  const onPointerMove = (event: PointerEvent) => {
    const rect = stage.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const onPointerLeave = () => {
    pointer = null;
  };
  const starOf = (target: EventTarget | null) =>
    stars.find((star) => star.element === (target as Element | null)?.closest?.('[data-flight-star]'));
  const onStarEnter = (event: Event) => {
    const star = starOf(event.target);
    if (!star) return;
    hoverStar = star.galaxy;
    const { kind, date, title } = star.element.dataset;
    setInfo(star.galaxy, `${kind ?? ''} · ${date ?? ''}`, title ?? '');
  };
  const onStarLeave = (event: Event) => {
    const star = starOf(event.target);
    if (!star) return;
    hoverStar = -1;
    setInfo(star.galaxy, infoDefaults[star.galaxy]?.head ?? '', infoDefaults[star.galaxy]?.title ?? '');
  };

  const travelTo = (index: number) => {
    const travel = root.offsetHeight - window.innerHeight;
    const top = window.scrollY + root.getBoundingClientRect().top + (travel * index) / last;
    window.scrollTo({ top, behavior: prefersStill() ? 'auto' : 'smooth' });
  };
  const onClick = (event: MouseEvent) => {
    const goto = (event.target as Element | null)?.closest<HTMLElement>('[data-flight-goto]');
    if (goto) {
      travelTo(Number(goto.dataset.flightGoto));
      return;
    }
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[data-warp]');
    const warpReady = (window as Window & { __pyuyiWarp?: boolean }).__pyuyiWarp;
    if (!link || !warpReady || warp || prefersStill()) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    const star = starOf(link);
    const galaxyIndex = star ? star.galaxy : Number(link.dataset.flightEnter);
    const placement = GALAXY_PLACEMENTS[galaxyIndex] ?? GALAXY_PLACEMENTS[0];
    const point = star ? localToWorld(placement, galaxies[star.galaxy].angle, star.local) : placement.center;
    const pose = cameraAt(progress, width / height);
    const onScreen = project(viewProjection, point, width, height);
    const rect = stage.getBoundingClientRect();
    warp = { start: performance.now(), eye: pose.eye, target: pose.target, point };
    window.setTimeout(() => {
      warp = null;
    }, 9000);
    window.dispatchEvent(
      new CustomEvent('pyuyi:warp', {
        detail: {
          href: link.href,
          x: rect.left + onScreen.x,
          y: rect.top + onScreen.y,
          color: link.dataset.warpColor,
          camera: 'self',
        },
      }),
    );
  };

  stage.addEventListener('pointermove', onPointerMove);
  stage.addEventListener('pointerleave', onPointerLeave);
  root.addEventListener('pointerover', onStarEnter);
  root.addEventListener('pointerout', onStarLeave);
  root.addEventListener('focusin', onStarEnter);
  root.addEventListener('focusout', onStarLeave);
  root.addEventListener('click', onClick);
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(buildTimer);
    pending.clear();
    worker?.terminate();
    resizeObserver.disconnect();
    stage.removeEventListener('pointermove', onPointerMove);
    stage.removeEventListener('pointerleave', onPointerLeave);
    root.removeEventListener('pointerover', onStarEnter);
    root.removeEventListener('pointerout', onStarLeave);
    root.removeEventListener('focusin', onStarEnter);
    root.removeEventListener('focusout', onStarLeave);
    root.removeEventListener('click', onClick);
    renderer?.destroy();
  };
}
