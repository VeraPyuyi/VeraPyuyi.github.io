/**
 * Keeps the flight smooth on slower machines without giving up sharpness lightly.
 *
 * It watches a smoothed frame time, so single hitches (a garbage collection, a tab switch, a page
 * swap) never count. When the frame rate stays low it first draws fewer particles, which the eye
 * barely notices, and only then lowers the render resolution, a quarter step at a time. When the
 * frame rate stays comfortably high it gives the resolution back first, then the particles. A
 * resolution step that had to be taken back soon after it was restored becomes the new ceiling,
 * so the guard does not keep flipping between the two.
 */

export interface FrameGuard {
  /** Current cap on the device pixel ratio. */
  readonly maxRatio: number;
  /** Share of each particle layer that is drawn (0.35–1). */
  readonly detail: number;
  /** Call once per frame; `active` is false while models load or the tab is hidden. */
  tick(dt: number, active: boolean): void;
}

/** Sustained frame time above which the guard steps down (about 36 fps). */
const SLOW = 1 / 36;
/** Sustained frame time below which it steps back up (about 55 fps). */
const FAST = 1 / 55;
/** Frames to wait after any change before stepping down again, so the change can show. */
const SETTLE = 90;
/** Frames of smooth running before stepping back up. */
const PATIENCE = 300;
/** Frames after a step up within which a step back down marks that step as too much. */
const REGRET = 600;
const RATIO_STEP = 0.25;
/** Particles go no lower than this before resolution is touched. */
const DETAIL_FIRST = 0.6;
const DETAIL_FLOOR = 0.35;

export function createFrameGuard(options: {
  maxRatio: number;
  onRatioChange: () => void;
  onDetailChange: (detail: number) => void;
}): FrameGuard {
  let ceiling = options.maxRatio;
  let maxRatio = options.maxRatio;
  let detail = 1;
  /** Exponentially smoothed frame time, in seconds. */
  let smoothed = 1 / 60;
  /** Frames since the last change. */
  let since = 0;
  /** Frames since the resolution was last raised (Infinity: never). */
  let sinceRaise = Number.POSITIVE_INFINITY;

  const setDetail = (next: number) => {
    detail = next;
    options.onDetailChange(detail);
  };
  const setRatio = (next: number) => {
    maxRatio = next;
    options.onRatioChange();
  };

  return {
    get maxRatio() {
      return maxRatio;
    },
    get detail() {
      return detail;
    },
    tick(dt, active) {
      if (!active) return;
      // A hitch longer than a tenth of a second says nothing about the steady frame rate.
      smoothed += (Math.min(dt, 0.1) - smoothed) * 0.05;
      since++;
      sinceRaise++;
      if (since < SETTLE) return;

      if (smoothed > SLOW) {
        since = 0;
        if (detail > DETAIL_FIRST) setDetail(Math.max(DETAIL_FIRST, detail * 0.8));
        else if (maxRatio > 1) {
          // Only the first step down after a raise says the raise was too much.
          if (sinceRaise < REGRET) ceiling = Math.max(1, maxRatio - RATIO_STEP);
          sinceRaise = Number.POSITIVE_INFINITY;
          setRatio(Math.max(1, maxRatio - RATIO_STEP));
        } else if (detail > DETAIL_FLOOR) setDetail(Math.max(DETAIL_FLOOR, detail * 0.8));
      } else if (smoothed < FAST && since >= PATIENCE) {
        since = 0;
        if (maxRatio < ceiling) {
          sinceRaise = 0;
          setRatio(Math.min(ceiling, maxRatio + RATIO_STEP));
        } else if (detail < 1) setDetail(Math.min(1, detail * 1.15));
      }
    },
  };
}
