/**
 * Drives the homepage flight: scroll position → camera along the route, galaxies turning
 * (slower under the pointer), post stars that follow their arms, links orbiting the black hole
 * at the end, and the warp jump that pushes the camera into the chosen star.
 */

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
import { resolveDeepLink } from './deep-link';
import { createCatalogue } from './catalogue';
import { createStarHints } from './star-hints';
import { createFrameGuard } from './frame-guard';
import { createOverscrollPull } from './overscroll';
import { paintIntro } from './intro';
import { loadModels } from './model-loader';
import { createGalaxyRenderer, type ParticleLayer } from './renderer';
/** Matches the warp overlay's aim + spool phases, so the camera arrives as the jump begins. */
const WARP_CAMERA_MS = 2000;
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/** How quickly the camera catches up with the scroll position (per second). */
const FOLLOW_RATE = 2.2;
/** Fastest the camera may travel along the route, in galaxies per second, however fast the page scrolls. */
const MAX_TRAVEL_SPEED = 0.7;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const prefersStill = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('motion-off');

interface GalaxyState {
  matrix: Float32Array;
  drift: ReturnType<typeof galaxyDrift>;
  angle: number;
  speed: number;
  /**
   * Time the particles finished uploading (earlier than the clock for a model kept from before,
   * so it shows at once), or null while still being built.
   */
  readyAt: number | null;
}

interface StarLink {
  element: HTMLAnchorElement;
  /** Index of the stop it belongs to. */
  galaxy: number;
  local: Vec3;
  /** Links around the black hole orbit it; this is their starting angle. */
  orbit?: number;
}

/** A point on the ring the black hole's links orbit along (stop units); taller and narrower on portrait screens. */
const orbitPoint = (angle: number, aspect: number): Vec3 => {
  const squeeze = Math.min(1, aspect * 1.3);
  return [Math.cos(angle) * 0.86 * squeeze, (Math.sin(angle) * 0.5) / squeeze, 0];
};
const HOLE = blackHoleFrame();
/** How strongly the black hole shows while still far down the route. */
const DISTANT_HOLE = 0.85;

interface Warp {
  start: number;
  eye: Vec3;
  target: Vec3;
  point: Vec3;
}

/** Starts the flight inside `root`; returns a function that stops it and frees the GPU. */
export function mountGalaxyFlight(root: HTMLElement): () => void {
  const stage = root.querySelector<HTMLElement>('[data-flight-stage]');
  const canvas = root.querySelector<HTMLCanvasElement>('[data-flight-canvas]');
  if (!stage || !canvas) return () => undefined;
  const surface: HTMLElement = stage;
  paintIntro(root);

  const labels = [...root.querySelectorAll<HTMLElement>('[data-flight-label]')];
  const gotos = [...root.querySelectorAll<HTMLButtonElement>('[data-flight-goto]')];
  const fades = [...root.querySelectorAll<HTMLElement>('[data-flight-fade]')];
  const ask = root.querySelector<HTMLElement>('[data-flight-ask]');
  const askText = root.querySelector<HTMLElement>('[data-flight-ask-text]');
  const stars: StarLink[] = [...root.querySelectorAll<HTMLAnchorElement>('[data-flight-star]')].map((element) => ({
    element,
    galaxy: Number(element.dataset.galaxy),
    local: [Number(element.dataset.u), 0, Number(element.dataset.v)],
    orbit: element.dataset.orbit === undefined ? undefined : Number(element.dataset.orbit),
  }));
  const last = ROUTE.length - 1;
  let orbitClock = 0;
  /** Turn of the star field about the route, so the sky drifts behind the black hole. */
  let skyTurn = 0;
  const overscroll = createOverscrollPull();
  const hints = createStarHints();
  const catalogue = createCatalogue(root);
  const galaxies: GalaxyState[] = GALAXY_PLACEMENTS.map((placement) => ({
    matrix: galaxyModelMatrix(placement),
    drift: galaxyDrift(0, 0),
    angle: 0,
    speed: prefersStill() ? 0 : 1,
    readyAt: null,
  }));

  const renderer = createGalaxyRenderer(canvas);
  root.classList.toggle('is-flat', !renderer);
  const small = Math.min(window.innerWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency || 8) <= 4;
  let width = 1;
  let height = 1;
  let backdropReady: number | null = null;
  const guard = createFrameGuard({
    maxRatio: small ? 1.25 : 2,
    onRatioChange: () => resize(),
    onDetailChange: (detail) => renderer?.setDetail(detail),
  });

  const resize = () => {
    width = stage.clientWidth || window.innerWidth;
    height = stage.clientHeight || window.innerHeight;
    renderer?.resize(width, height, Math.min(window.devicePixelRatio || 1, guard.maxRatio));
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
  /** Galaxy whose story is showing, and one whose story should open when the camera arrives. */
  let revealed = -1;
  let revealOnArrival = -1;
  const nudge = { x: 0, y: 0 };
  let camera: { eye: Vec3; target: Vec3 } = { eye: [0, 0, 0], target: [0, 0, -1] };
  let viewProjection: Float32Array = IDENTITY;

  const models = renderer
    ? loadModels({
        small,
        progress,
        onBuilt: ({ id, light, dust }, cached) => {
          // A model kept from earlier in the visit is shown at once rather than faded in again.
          const readyAt = cached ? time - 10 : time;
          if (id === 'backdrop') {
            renderer.upload('backdrop', light);
            backdropReady = readyAt;
            return;
          }
          renderer.upload(`${id}-light`, light);
          if (dust) renderer.upload(`${id}-dust`, dust);
          const index = GALAXY_PLACEMENTS.findIndex((placement) => placement.kind === id);
          if (index >= 0) galaxies[index].readyAt = readyAt;
        },
      })
    : null;

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
      if (still) progress = target;
      else {
        const step = (target - progress) * (1 - Math.exp(-dt * FOLLOW_RATE));
        progress += Math.max(-MAX_TRAVEL_SPEED * dt, Math.min(MAX_TRAVEL_SPEED * dt, step));
      }
      if (Math.abs(target - progress) < 1e-4) progress = target;
    }

    const aspect = width / height;
    // Pointer parallax: the eye drifts a little with the pointer, so the galaxy seems to float in depth.
    const ease = still ? 1 : 1 - Math.exp(-dt * 1.6);
    nudge.x += ((pointer && !still ? (pointer.x / width - 0.5) * 2 : 0) - nudge.x) * ease;
    nudge.y += ((pointer && !still ? (pointer.y / height - 0.5) * 2 : 0) - nudge.y) * ease;
    const pose = cameraAt(progress, aspect, [nudge.x * 0.6, -nudge.y * 0.4]);
    let eye = pose.eye;
    let target = pose.target;
    // Pushing past either end of the route eases the camera towards that object instead of bouncing the page.
    overscroll.update(dt);
    // Past the first galaxy the camera drifts away from it; past the black hole it is drawn in.
    if (!still && overscroll.amount > 0) {
      const toward = overscroll.edge === 'end' ? overscroll.amount * 0.24 : -overscroll.amount * 0.32;
      eye = mix(eye, ROUTE[Math.round(progress)].center, toward);
    }
    if (warp) {
      const k = easeInOut(clamp((now - warp.start) / WARP_CAMERA_MS));
      eye = mix(warp.eye, warp.point, k * 0.86);
      target = mix(warp.target, warp.point, clamp(k * 1.8));
    }
    if (!warp) camera = { eye, target };
    const view = lookAt(eye, target, pose.up);
    const projection = perspective(FIELD_OF_VIEW, aspect, 0.05, 3000);
    viewProjection = multiply(projection, view);

    // Each galaxy floats: it rises and sinks, sways and slowly rocks.
    galaxies.forEach((galaxy, index) => {
      galaxy.drift = still ? galaxyDrift(index, 0) : galaxyDrift(index, time);
      galaxy.matrix = galaxyModelMatrix(GALAXY_PLACEMENTS[index], galaxy.drift);
    });

    // Galaxy under the pointer (only the one we are visiting) and the spin it should have.
    hoverGalaxy = pointer ? galaxyAt(pointer.x, pointer.y) : -1;
    surface.style.cursor = hoverGalaxy >= 0 || (pointer && distantHoleAt(pointer.x, pointer.y)) ? 'pointer' : '';
    galaxies.forEach((galaxy, index) => {
      const goal = still || warp || hoverStar === index ? 0 : hoverGalaxy === index ? 0.12 : 1;
      galaxy.speed += (goal - galaxy.speed) * (1 - Math.exp(-dt / 0.45));
      galaxy.angle += GALAXY_PLACEMENTS[index].spin * galaxy.speed * dt;
    });
    if (!still && !warp && hoverStar !== last) orbitClock += dt * 0.035;

    // The black hole joins in once the camera is close enough to see it. While it is in view the star
    // field drifts slowly behind it, as if the hole were moving through space: stars passing behind it are
    // lensed into arcs that sweep round the shadow. Away from it the sky settles back to where it was.
    const toHole = Math.hypot(HOLE.center[0] - eye[0], HOLE.center[1] - eye[1], HOLE.center[2] - eye[2]);
    const nearHole = clamp((330 - toHole) / 80);
    // From the first galaxy on, the hole already hangs far ahead at the end of the route: small,
    // faint, always in sight, growing as the visitor flies towards it.
    const holeAlpha = Math.max(nearHole, DISTANT_HOLE);
    if (!still && nearHole > 0.3) skyTurn += dt * 0.016 * nearHole;
    else if (!still) {
      const settled = Math.round(skyTurn / (2 * Math.PI)) * 2 * Math.PI;
      skyTurn += (settled - skyTurn) * (1 - Math.exp(-dt * 1.2));
    }

    if (renderer) {
      const layers: ParticleLayer[] = [];
      if (backdropReady !== null) {
        layers.push({
          mesh: 'backdrop',
          model: IDENTITY,
          modelScale: 1,
          spin: skyTurn,
          wobble: 0,
          alpha: clamp((time - backdropReady) / 0.8),
          dust: false,
          soft: [6.5, 8],
          spikes: 1,
        });
      }
      const byDistance = GALAXY_PLACEMENTS.map((placement, index) => ({
        index,
        distance: Math.hypot(placement.center[0] - eye[0], placement.center[1] - eye[1], placement.center[2] - eye[2]),
      })).sort((a, b) => b.distance - a.distance);
      for (const { index } of byDistance) {
        const galaxy = galaxies[index];
        if (galaxy.readyAt === null) continue;
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
        // Dust also dims the deep-space background drawn under it, so it needs a lighter hand
        // than the light layer to keep lanes from reading darker than empty space.
        layers.push({ ...base, alpha: base.alpha * 0.4, mesh: `${placement.kind}-dust`, dust: true });
      }
      const blackHole =
        holeAlpha > 0
          ? {
              ...HOLE,
              eye,
              viewProjection,
              inverseViewProjection: invert(viewProjection) ?? IDENTITY,
              time: still ? 0 : time,
              alpha: holeAlpha,
              sharp: nearHole === 0,
            }
          : null;
      renderer.render({
        view,
        projection,
        fieldOfView: FIELD_OF_VIEW,
        time: still ? 0 : time,
        exposure: 1.25,
        layers,
        blackHole,
      });
    }

    updateOverlay();
    guard.tick(dt, Boolean(renderer) && !models?.busy && document.visibilityState === 'visible');
  }

  /** Whether (x, y) falls on the distant black hole while it is still far ahead. */
  function distantHoleAt(x: number, y: number): boolean {
    if (warp || progress > last - 0.6) return false;
    const hole = ROUTE[last];
    const point = project(viewProjection, hole.center, width, height);
    if (point.depth <= 0) return false;
    const reach = (hole.radius * height) / (2 * Math.tan(FIELD_OF_VIEW / 2) * point.depth);
    return Math.hypot(x - point.x, y - point.y) < Math.max(18, reach);
  }

  /** Index of the galaxy being visited if (x, y) falls on its disk, else -1. */
  function galaxyAt(x: number, y: number): number {
    const active = Math.round(progress);
    if (warp || Math.abs(progress - active) > 0.3) return -1;
    const placement = ROUTE[active];
    const drift = galaxies[active]?.drift;
    const center = project(viewProjection, localToWorld(placement, 0, [0, 0, 0], drift), width, height);
    if (center.depth <= 0) return -1;
    let reach = 0;
    for (const local of [
      [1, 0, 0],
      [0, 0, 1],
    ] as const) {
      const rim = project(viewProjection, localToWorld(placement, 0, local, drift), width, height);
      reach = Math.max(reach, Math.hypot(rim.x - center.x, rim.y - center.y));
    }
    return Math.hypot(x - center.x, y - center.y) < reach * 0.95 ? active : -1;
  }

  function updateOverlay() {
    for (const star of stars) {
      const placement = ROUTE[star.galaxy];
      const galaxy = galaxies[star.galaxy];
      const local = star.orbit === undefined ? star.local : orbitPoint(star.orbit + orbitClock, width / height);
      const point = project(viewProjection, localToWorld(placement, galaxy?.angle ?? 0, local, galaxy?.drift), width, height);
      const near = clamp(1 - Math.abs(progress - star.galaxy) * 2.2);
      const opacity = point.depth > 0.5 && !warp ? near : 0;
      const scale = clamp((placement.radius * 2.3) / Math.max(point.depth, 0.01), 0.55, 1.5);
      const style = star.element.style;
      style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      style.opacity = opacity.toFixed(3);
      style.visibility = opacity < 0.02 ? 'hidden' : 'visible';
      star.element.classList.toggle('is-idle', opacity < 0.5);
      hints.place(star.element, point.x, point.y, width, height, scale);
      catalogue.place(star.element, point.x, point.y, opacity > 0.3);
    }
    const settled = Math.round(progress);
    // Ring the stars once the galaxy itself is showing (the black hole stop has no galaxy model).
    if (!warp && !prefersStill() && Math.abs(progress - settled) < 0.06 && galaxies[settled]?.readyAt !== null)
      hints.arrive(settled, () => stars.filter((star) => star.galaxy === settled).map((star) => star.element));
    // Stories stay hidden until their galaxy is clicked; leaving the galaxy closes it again.
    if (revealOnArrival >= 0 && Math.abs(progress - revealOnArrival) < 0.12) {
      revealed = revealOnArrival;
      revealOnArrival = -1;
    }
    if (revealed >= 0 && (warp || Math.abs(progress - revealed) > 0.45)) revealed = -1;
    labels.forEach((label, index) => {
      const offset = progress - index;
      label.classList.toggle('is-revealed', revealed === index);
      label.style.opacity = (warp ? 0 : clamp(1 - Math.abs(offset) * 2.4)).toFixed(3);
      label.style.transform = `translate3d(0, ${(-offset * 48).toFixed(1)}px, 0)`;
    });
    catalogue.update(progress, revealed, Boolean(warp));
    const active = Math.round(progress);
    if (ask) {
      const visible = !warp && revealed !== active && Math.abs(progress - active) < 0.2;
      ask.style.opacity = visible ? String(clamp(1 - Math.abs(progress - active) * 5)) : '0';
      ask.style.setProperty('--accent', labels[active]?.style.getPropertyValue('--accent') ?? '');
      const text = labels[active]?.dataset.ask;
      if (askText && text && askText.textContent !== text) askText.textContent = text;
    }
    const nearest = Math.round(progress);
    gotos.forEach((button, index) => {
      button.toggleAttribute('aria-current', index === nearest);
      button.setAttribute('aria-expanded', String(revealed === index));
    });
    root.style.setProperty('--flight-progress', (progress / last).toFixed(4));
    for (const element of fades) {
      const until = Number(element.dataset.flightFade) || 0.3;
      element.style.opacity = warp ? '0' : clamp(1 - progress / until).toFixed(3);
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
    const element = event.target as Element | null;
    const goto = element?.closest<HTMLElement>('[data-flight-goto]');
    if (goto) {
      const index = Number(goto.dataset.flightGoto);
      if (Math.abs(progress - index) < 0.12) {
        revealed = revealed === index ? -1 : index;
      } else {
        revealOnArrival = index;
        travelTo(index);
      }
      return;
    }
    const link = element?.closest<HTMLAnchorElement>('a[data-warp]');
    if (!link) {
      if (element?.closest('[data-flight-label], .flight-nav, a, button')) return;
      // A click on the galaxy itself opens (or closes) its story; a click on empty space closes it.
      const rect = stage.getBoundingClientRect();
      // The far-off black hole is a way there: fly to the end of the route and open its story.
      if (distantHoleAt(event.clientX - rect.left, event.clientY - rect.top)) {
        revealOnArrival = last;
        travelTo(last);
        return;
      }
      const hit = galaxyAt(event.clientX - rect.left, event.clientY - rect.top);
      revealed = hit >= 0 && revealed !== hit ? hit : -1;
      return;
    }
    const warpReady = (window as Window & { __pyuyiWarp?: boolean }).__pyuyiWarp;
    if (!link || !warpReady || warp || prefersStill()) return;
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    const star = starOf(link);
    const galaxyIndex = star ? star.galaxy : Number(link.dataset.flightEnter);
    const placement = ROUTE[galaxyIndex] ?? ROUTE[0];
    const owner = galaxies[galaxyIndex];
    const point = localToWorld(placement, owner?.angle ?? 0, star ? star.local : [0, 0, 0], owner?.drift);
    const onScreen = project(viewProjection, point, width, height);
    const rect = stage.getBoundingClientRect();
    warp = { start: performance.now(), eye: camera.eye, target: camera.target, point };
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

  const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') revealed = -1;
  };
  window.addEventListener('keydown', onKey);
  // Arriving from "find it in the sky" on a post: fly to its galaxy, open the story, light the star.
  const deepLink = resolveDeepLink(
    window.location.hash,
    stars.map((star) => star.element),
  );
  let deepLinkTimer = 0;
  if (deepLink) {
    revealOnArrival = deepLink.stop;
    const found = stars.find((star) => star.element === deepLink.star);
    if (found) {
      found.element.classList.add('is-found');
      const { kind, date, title } = found.element.dataset;
      infoDefaults[found.galaxy] = { head: `${kind ?? ''} · ${date ?? ''}`, title: title ?? '' };
      setInfo(found.galaxy, infoDefaults[found.galaxy].head, infoDefaults[found.galaxy].title);
    }
    deepLinkTimer = window.setTimeout(() => travelTo(deepLink.stop), 700);
  }

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
    window.clearTimeout(deepLinkTimer);
    hints.stop();
    catalogue.stop();
    overscroll.stop();
    models?.stop();
    resizeObserver.disconnect();
    window.removeEventListener('keydown', onKey);
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
