/**
 * Cues that the stars are links.
 * - Each star carries a hover card (title, kind, date); `place` keeps the card on screen by
 *   flipping it away from the edge it would run off, and undoes the star's depth scaling on it.
 * - The first time the camera settles on a galaxy, its stars send out one soft ring.
 */

/** Distance from the screen edge (px) at which a star's card flips to the other side. */
const EDGE_X = 230;
const EDGE_Y = 120;
/** How long the arrival ring stays on, covering its two pulses and their stagger. */
const PING_MS = 3600;

export interface StarHints {
  /** Called every frame with the star's projected position and depth scale. */
  place(element: HTMLElement, x: number, y: number, width: number, height: number, scale: number): void;
  /** Rings the given galaxy's stars, once per visit to the page. */
  arrive(galaxy: number, elements: () => readonly HTMLElement[]): void;
  stop(): void;
}

export function createStarHints(): StarHints {
  const rung = new Set<number>();
  const timers = new Set<number>();
  return {
    place(element, x, y, width, _height, scale) {
      const side = x > width - EDGE_X ? 'end' : x < EDGE_X ? 'start' : 'center';
      const level = y < EDGE_Y ? 'below' : 'above';
      if (element.dataset.tipX !== side) element.dataset.tipX = side;
      if (element.dataset.tipY !== level) element.dataset.tipY = level;
      element.style.setProperty('--s', scale.toFixed(3));
    },
    arrive(galaxy, elements) {
      if (rung.has(galaxy)) return;
      rung.add(galaxy);
      const ringing = elements();
      for (const element of ringing) element.classList.add('is-ping');
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        for (const element of ringing) element.classList.remove('is-ping');
      }, PING_MS);
      timers.add(timer);
    },
    stop() {
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
    },
  };
}
