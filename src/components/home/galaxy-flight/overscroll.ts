/**
 * A rubber band that never moves the page. On the homepage the page itself does not bounce
 * (see galaxy-flight.css); instead, pushing past the first or last stop with a wheel,
 * trackpad or finger builds up a "pull" that eases the camera towards the object, and it
 * springs back as soon as the input stops.
 */

export interface OverscrollPull {
  /** 0–1, with resistance: the harder you push, the less each extra push adds. */
  readonly amount: number;
  /** Which end of the route is being pushed past. */
  readonly edge: 'start' | 'end';
  update(dt: number): void;
  stop(): void;
}

const RELEASE_MS = 140;

export function createOverscrollPull(): OverscrollPull {
  let pull = 0;
  let lastInput = 0;
  let touchY: number | null = null;
  let edge: 'start' | 'end' = 'start';

  const atTop = () => window.scrollY <= 1;
  const atBottom = () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  const push = (amount: number) => {
    pull = Math.min(1.5, pull + amount);
    lastInput = performance.now();
  };
  const beyondEdge = (delta: number) => {
    if (delta < 0 && atTop()) edge = 'start';
    else if (delta > 0 && atBottom()) edge = 'end';
    else return false;
    return true;
  };

  const onWheel = (event: WheelEvent) => {
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    if (beyondEdge(delta)) push(Math.abs(delta) / 900);
  };
  const onTouchStart = (event: TouchEvent) => {
    touchY = event.touches[0]?.clientY ?? null;
  };
  const onTouchMove = (event: TouchEvent) => {
    const y = event.touches[0]?.clientY;
    if (touchY === null || y === undefined) return;
    const delta = touchY - y;
    touchY = y;
    if (beyondEdge(delta)) push(Math.abs(delta) / 500);
  };
  const onTouchEnd = () => {
    touchY = null;
  };

  window.addEventListener('wheel', onWheel, { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });

  return {
    get amount() {
      return 1 - Math.exp(-pull * 2.2);
    },
    get edge() {
      return edge;
    },
    update(dt) {
      // Hold while the push continues; spring back once it stops.
      if (performance.now() - lastInput > RELEASE_MS) pull *= Math.exp(-dt * 4.5);
      if (pull < 1e-3) pull = 0;
    },
    stop() {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    },
  };
}
