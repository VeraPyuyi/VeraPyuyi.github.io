/**
 * The black hole on the horizon. From the first galaxy on, the hole hangs far ahead at the end of
 * the route; this keeps it noticeable:
 * - `boost` draws it larger than its true size while far away (a painter's licence, the way a
 *   distant mountain is drawn a little too big), easing to its real size as the camera nears;
 * - an annotation with a fine leader line, like the ones inked onto old plates, names it until the
 *   camera starts closing in.
 */

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** How much larger than life the hole is drawn at its farthest. */
const FAR_BOOST = 2.6;
/** Distance (world units) beyond which the boost is full, and below which it is gone. */
const FAR = 430;
const NEAR = 250;

/** Screen width (CSS px) at which the full boost applies; narrower screens get less, so a tall phone keeps it in frame. */
const FULL_WIDTH = 1000;

/** Size multiplier for the hole seen from `distance` on a screen `width` CSS px wide. */
export function horizonBoost(distance: number, width: number): number {
  const room = Math.min(1, Math.max(0.35, width / FULL_WIDTH));
  return 1 + (FAR_BOOST - 1) * room * clamp((distance - NEAR) / (FAR - NEAR));
}

export interface Horizon {
  /** Every frame: the hole's projected centre, its on-screen radius, and how visible the note should be. */
  place(x: number, y: number, radius: number, visibility: number): void;
}

export function createHorizon(root: HTMLElement): Horizon {
  const note = root.querySelector<HTMLElement>('[data-flight-horizon]');
  return {
    place(x, y, radius, visibility) {
      if (!note) return;
      const shown = visibility > 0.02;
      note.style.visibility = shown ? 'visible' : 'hidden';
      if (!shown) return;
      note.style.opacity = visibility.toFixed(3);
      note.style.setProperty('--reach', `${Math.round(radius)}px`);
      note.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    },
  };
}
