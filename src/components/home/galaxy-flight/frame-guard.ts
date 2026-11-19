/**
 * Keeps the flight smooth on slower machines: after a run of slow frames it first lowers the
 * render resolution, then draws a smaller share of the particles; after a long run of fast
 * frames it gives particles back.
 */

export interface FrameGuard {
  /** Current cap on the device pixel ratio. */
  readonly maxRatio: number;
  /** Call once per frame; `active` is false while models load or the tab is hidden. */
  tick(dt: number, active: boolean): void;
}

export function createFrameGuard(options: {
  maxRatio: number;
  onRatioChange: () => void;
  onDetailChange: (detail: number) => void;
}): FrameGuard {
  let maxRatio = options.maxRatio;
  let detail = 1;
  let slow = 0;
  let fast = 0;
  return {
    get maxRatio() {
      return maxRatio;
    },
    tick(dt, active) {
      if (!active) return;
      if (dt > 1 / 38) slow++;
      else if (dt < 1 / 57) fast++;
      if (slow > 45) {
        slow = 0;
        fast = 0;
        if (maxRatio > 1) {
          maxRatio = 1;
          options.onRatioChange();
        } else if (detail > 0.35) {
          detail *= 0.8;
          options.onDetailChange(detail);
        }
      } else if (fast > 240) {
        slow = 0;
        fast = 0;
        if (detail < 1) {
          detail = Math.min(1, detail * 1.1);
          options.onDetailChange(detail);
        }
      }
    },
  };
}
