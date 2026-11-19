/**
 * Runs one megastructure hero: sizes the canvas, paints the deep-space backdrop (stars and the
 * page's home galaxy, faint in the distance), draws the scene every frame while it is on screen,
 * and ties scene items to the page: hovering a matching link lights the item, hovering or
 * clicking the item in the scene shows it and follows its link.
 */

import type { MegaItem } from '@/lib/megastructures';

export interface Frame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Seconds since mount (frozen at a pleasant moment when motion is reduced). */
  time: number;
  dt: number;
  /** Where the structure stands and how big it may be. */
  cx: number;
  cy: number;
  size: number;
  /** Index of the item to highlight, or -1. */
  focus: number;
}

export interface Scene {
  draw(frame: Frame): void;
  /** Item under (x, y) in canvas pixels from the last draw, or -1. */
  hit(x: number, y: number): number;
}

export type SceneFactory = (items: readonly MegaItem[]) => Scene;

const STILL_TIME = 7.5;

const prefersStill = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('motion-off');

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

/** Points recorded during a draw so scenes can answer hit tests. */
export class HitList {
  private points: { x: number; y: number; r: number; index: number }[] = [];
  reset() {
    this.points = [];
  }
  add(index: number, x: number, y: number, r: number) {
    this.points.push({ x, y, r, index });
  }
  find(x: number, y: number): number {
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const point of this.points) {
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance <= point.r && distance < bestDistance) {
        best = point.index;
        bestDistance = distance;
      }
    }
    return best;
  }
}

export function mountMegaHero(root: HTMLElement, factory: SceneFactory): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-mega-canvas]');
  const readout = root.querySelector<HTMLElement>('[data-mega-readout]');
  const context = canvas?.getContext('2d');
  if (!canvas || !context) return () => undefined;
  const ctx: CanvasRenderingContext2D = context;

  const items: MegaItem[] = JSON.parse(root.querySelector('[data-mega-items]')?.textContent || '[]');
  const scene = factory(items);
  const stars = makeStars(260);
  const galaxy = new Image();
  let galaxySprite: HTMLCanvasElement | null = null;
  galaxy.addEventListener('load', () => {
    // Feather the eyepiece photo into the sky so it reads as a distant galaxy, not a sticker.
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 256;
    const g = sprite.getContext('2d');
    if (!g) return;
    g.drawImage(galaxy, 0, 0, 256, 256);
    g.globalCompositeOperation = 'destination-in';
    const mask = g.createRadialGradient(128, 128, 36, 128, 128, 128);
    mask.addColorStop(0, '#000');
    mask.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = mask;
    g.fillRect(0, 0, 256, 256);
    galaxySprite = sprite;
    if (prefersStill()) draw(0);
  });
  if (root.dataset.megaGalaxy) galaxy.src = root.dataset.megaGalaxy;
  const defaultReadout = readout?.textContent ?? '';

  let width = 1;
  let height = 1;
  let ratio = 1;
  let time = 0;
  let last = performance.now();
  let raf = 0;
  let visible = true;
  let linkFocus = -1;
  let pointerFocus = -1;

  const resize = () => {
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth || 1;
    height = canvas.clientHeight || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    if (prefersStill()) draw(0);
  };

  const setReadout = (index: number) => {
    if (!readout) return;
    const item = items[index];
    readout.textContent = item ? (item.meta ? `${item.meta} · ${item.title}` : item.title) : defaultReadout;
  };

  function draw(dt: number) {
    const wide = width / height > 1.15;
    const frame: Frame = {
      ctx,
      width,
      height,
      time: prefersStill() ? STILL_TIME : time,
      dt,
      cx: wide ? width * 0.68 : width * 0.5,
      cy: wide ? height * 0.45 : height * 0.3,
      size: Math.min(height * (wide ? 0.44 : 0.25), wide ? width * 0.27 : width * 0.4),
      focus: pointerFocus >= 0 ? pointerFocus : linkFocus,
    };
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0b0d2a');
    sky.addColorStop(1, '#151a42');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'lighter';
    // The page's galaxy on the homepage route hangs far behind the structure.
    if (galaxySprite) {
      const size = Math.min(width, height) * (wide ? 0.5 : 0.36);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(galaxySprite, width * (wide ? 0.92 : 0.86) - size / 2, height * 0.2 - size / 2, size, size);
    }
    for (let index = 0; index < stars.length; index += 4) {
      const twinkle = 0.55 + 0.45 * Math.sin(frame.time * (0.6 + stars[index + 3] * 2) + stars[index + 3] * 40);
      ctx.globalAlpha = 0.25 + 0.6 * twinkle * (0.4 + stars[index + 2]);
      ctx.fillStyle = stars[index + 3] > 0.8 ? '#ffe6c2' : '#dfe6ff';
      const r = 0.5 + stars[index + 2] * 1.3;
      ctx.fillRect(stars[index] * width, stars[index + 1] * height, r, r);
    }
    ctx.globalAlpha = 1;
    scene.draw(frame);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!visible || document.visibilityState !== 'visible') return;
    if (!prefersStill()) time += dt;
    draw(dt);
  };

  // Links on the page that point at the same things as the scene's items.
  const resolve = (href?: string) => (href ? new URL(href, window.location.href).href.replace(/\/$/, '') : '');
  const targets = new Map(items.map((item, index) => [resolve(item.href), index]));
  const onOver = (event: Event) => {
    const link = (event.target as Element | null)?.closest?.('a[href]');
    if (!link || root.contains(link)) return;
    const index = targets.get(resolve(link.getAttribute('href') ?? undefined));
    if (index === undefined || !items[index]?.href) return;
    linkFocus = index;
    if (pointerFocus < 0) setReadout(index);
  };
  const onOut = (event: Event) => {
    const link = (event.target as Element | null)?.closest?.('a[href]');
    if (!link || root.contains(link)) return;
    linkFocus = -1;
    if (pointerFocus < 0) setReadout(-1);
  };
  const local = (event: PointerEvent | MouseEvent) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const onMove = (event: PointerEvent) => {
    const { x, y } = local(event);
    pointerFocus = scene.hit(x, y);
    canvas.style.cursor = pointerFocus >= 0 && items[pointerFocus]?.href ? 'pointer' : '';
    setReadout(pointerFocus >= 0 ? pointerFocus : linkFocus);
  };
  const onLeave = () => {
    pointerFocus = -1;
    canvas.style.cursor = '';
    setReadout(linkFocus);
  };
  const onClick = (event: MouseEvent) => {
    const { x, y } = local(event);
    const href = items[scene.hit(x, y)]?.href;
    if (href) window.location.assign(href);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
  });
  visibility.observe(root);
  document.addEventListener('pointerover', onOver);
  document.addEventListener('pointerout', onOut);
  document.addEventListener('focusin', onOver);
  document.addEventListener('focusout', onOut);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('click', onClick);
  resize();
  draw(0);
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    visibility.disconnect();
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointerout', onOut);
    document.removeEventListener('focusin', onOver);
    document.removeEventListener('focusout', onOut);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerleave', onLeave);
    canvas.removeEventListener('click', onClick);
  };
}
