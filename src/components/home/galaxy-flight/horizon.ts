/**
 * The black hole on the horizon. From the first galaxy on, the hole hangs far ahead at the end of
 * the route; to keep it noticeable it is drawn larger than its true size while far away (a
 * painter's licence, the way a distant mountain is drawn a little too big), easing to its real
 * size as the camera nears.
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
