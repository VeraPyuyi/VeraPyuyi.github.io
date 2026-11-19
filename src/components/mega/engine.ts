/**
 * Runs one megastructure hero: sizes it, picks a painter (the WebGL render, or line art where
 * WebGL2 is missing), animates while it is on screen, and ties scene items to the page: hovering
 * a matching link lights the item, hovering or clicking the item in the scene shows it and
 * follows its link.
 */

import type { MegaItem, MegaKind } from '@/lib/megastructures';
import { createPainter3d } from './gl/painter';
import { SCENES_3D } from './gl/scenes';
import { createPainter2d } from './painter-2d';
import { SCENES } from './scenes';

export interface Layout {
  width: number;
  height: number;
  /** Device pixels per CSS pixel for the overlay canvas. */
  ratio: number;
  /** Seconds since mount (frozen at a pleasant moment when motion is reduced). */
  time: number;
  dt: number;
  /** Where the structure stands and how big it may be, in CSS pixels. */
  cx: number;
  cy: number;
  size: number;
  wide: boolean;
  /** Index of the item to highlight, or -1. */
  focus: number;
}

export interface Frame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  time: number;
  dt: number;
  cx: number;
  cy: number;
  size: number;
  focus: number;
}

export interface Scene {
  draw(frame: Frame): void;
  /** Item under (x, y) in canvas pixels from the last draw, or -1. */
  hit(x: number, y: number): number;
}

export type SceneFactory = (items: readonly MegaItem[]) => Scene;

export interface Painter {
  paint(layout: Layout): void;
  hit(x: number, y: number): number;
  dispose(): void;
}

const STILL_TIME = 7.5;

const prefersStill = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('motion-off');

export function mountMegaHero(root: HTMLElement, kind: MegaKind): () => void {
  const glCanvas = root.querySelector<HTMLCanvasElement>('[data-mega-canvas]');
  const overlay = root.querySelector<HTMLCanvasElement>('[data-mega-overlay]');
  const readout = root.querySelector<HTMLElement>('[data-mega-readout]');
  if (!glCanvas || !overlay) return () => undefined;

  const items: MegaItem[] = JSON.parse(root.querySelector('[data-mega-items]')?.textContent || '[]');
  const galaxy = root.dataset.megaGalaxy;
  const painter =
    createPainter3d(glCanvas, overlay, SCENES_3D[kind], items, galaxy) || createPainter2d(overlay, SCENES[kind], items, galaxy);
  if (!painter) return () => undefined;
  root.dataset.megaMode = glCanvas.dataset.megaLive ? '3d' : '2d';
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
    width = overlay.clientWidth || 1;
    height = overlay.clientHeight || 1;
    overlay.width = Math.round(width * ratio);
    overlay.height = Math.round(height * ratio);
    if (prefersStill()) draw(0);
  };

  const setReadout = (index: number) => {
    if (!readout) return;
    const item = items[index];
    readout.textContent = item ? (item.meta ? `${item.meta} · ${item.title}` : item.title) : defaultReadout;
  };

  function draw(dt: number) {
    const wide = width / height > 1.15;
    painter?.paint({
      width,
      height,
      ratio,
      time: prefersStill() ? STILL_TIME : time,
      dt,
      cx: wide ? width * 0.68 : width * 0.5,
      cy: wide ? height * 0.45 : height * 0.3,
      size: Math.min(height * (wide ? 0.5 : 0.27), wide ? width * 0.3 : width * 0.42),
      wide,
      focus: pointerFocus >= 0 ? pointerFocus : linkFocus,
    });
  }

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!visible || document.visibilityState !== 'visible') return;
    if (prefersStill()) {
      if (dt > 0 && time !== STILL_TIME) draw(0);
      time = STILL_TIME;
      return;
    }
    time += dt;
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
    if (prefersStill()) draw(0);
  };
  const onOut = (event: Event) => {
    const link = (event.target as Element | null)?.closest?.('a[href]');
    if (!link || root.contains(link)) return;
    linkFocus = -1;
    if (pointerFocus < 0) setReadout(-1);
    if (prefersStill()) draw(0);
  };
  const local = (event: PointerEvent | MouseEvent) => {
    const rect = overlay.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const onMove = (event: PointerEvent) => {
    const { x, y } = local(event);
    pointerFocus = painter.hit(x, y);
    overlay.style.cursor = pointerFocus >= 0 && items[pointerFocus]?.href ? 'pointer' : '';
    setReadout(pointerFocus >= 0 ? pointerFocus : linkFocus);
  };
  const onLeave = () => {
    pointerFocus = -1;
    overlay.style.cursor = '';
    setReadout(linkFocus);
  };
  const onClick = (event: MouseEvent) => {
    const { x, y } = local(event);
    const href = items[painter.hit(x, y)]?.href;
    if (href) window.location.assign(href);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(overlay);
  const visibility = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
  });
  visibility.observe(root);
  document.addEventListener('pointerover', onOver);
  document.addEventListener('pointerout', onOut);
  document.addEventListener('focusin', onOver);
  document.addEventListener('focusout', onOut);
  overlay.addEventListener('pointermove', onMove);
  overlay.addEventListener('pointerleave', onLeave);
  overlay.addEventListener('click', onClick);
  resize();
  draw(0);
  raf = requestAnimationFrame(loop);

  return () => {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    visibility.disconnect();
    painter.dispose();
    document.removeEventListener('pointerover', onOver);
    document.removeEventListener('pointerout', onOut);
    document.removeEventListener('focusin', onOver);
    document.removeEventListener('focusout', onOut);
    overlay.removeEventListener('pointermove', onMove);
    overlay.removeEventListener('pointerleave', onLeave);
    overlay.removeEventListener('click', onClick);
  };
}
