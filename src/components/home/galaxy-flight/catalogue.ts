/**
 * The star catalogue beside each galaxy: a plain list of its newest posts, so what the homepage
 * holds can be read at a glance, without hunting for stars.
 *
 * The list and the sky answer each other:
 * - pointing at a row lights its star and draws a fine leader line to it, like the annotations
 *   inked onto old astronomical plates;
 * - pointing at a star lights its row;
 * - while the pointer rests on a catalogue the sky dims, the way one turns the lamp down to read.
 */

const clamp = (value: number) => Math.min(1, Math.max(0, value));
/** Length of the leader line's level run out of the row before it turns to the star. */
const ELBOW = 22;

export interface Catalogue {
  /** Every frame, for every star: where it is on the stage and whether it is showing. */
  place(element: HTMLElement, x: number, y: number, showing: boolean): void;
  /** Every frame after the stars: fade each catalogue with its galaxy, and hide it while that galaxy's story is open. */
  update(progress: number, revealed: number, warp: boolean): void;
  stop(): void;
}

export function createCatalogue(root: HTMLElement): Catalogue {
  const stage = root.querySelector<HTMLElement>('[data-flight-stage]') ?? root;
  const logs = [...root.querySelectorAll<HTMLElement>('[data-flight-log]')];
  const leader = root.querySelector<SVGPathElement>('[data-flight-leader]');
  const rows = new Map<string, HTMLElement>();
  for (const row of root.querySelectorAll<HTMLElement>('[data-log-star]')) rows.set(row.dataset.logStar ?? '', row);
  const starsById = new Map<string, HTMLElement>();
  for (const star of root.querySelectorAll<HTMLElement>('[data-flight-star][data-star-id]'))
    starsById.set(star.dataset.starId ?? '', star);

  /** The row being pointed at, and its star. */
  let pointedRow: HTMLElement | null = null;
  let pointedStar: HTMLElement | null = null;
  /** The row lit because its star is pointed at. */
  let echoedRow: HTMLElement | null = null;

  const hideLeader = () => leader?.setAttribute('d', '');

  function point(row: HTMLElement | null) {
    if (row === pointedRow) return;
    pointedRow?.classList.remove('is-pointed');
    pointedStar?.classList.remove('is-pointed');
    pointedRow = row;
    pointedStar = row ? (starsById.get(row.dataset.logStar ?? '') ?? null) : null;
    pointedRow?.classList.add('is-pointed');
    pointedStar?.classList.add('is-pointed');
    if (!pointedStar) hideLeader();
  }

  function echo(star: HTMLElement | null) {
    const row = star ? (rows.get(star.dataset.starId ?? '') ?? null) : null;
    if (row === echoedRow) return;
    echoedRow?.classList.remove('is-echoed');
    echoedRow = row;
    echoedRow?.classList.add('is-echoed');
  }

  const onOver = (event: Event) => {
    const target = event.target as Element | null;
    point(target?.closest<HTMLElement>('[data-log-star]') ?? null);
    echo(target?.closest<HTMLElement>('[data-flight-star][data-star-id]') ?? null);
    root.classList.toggle('is-reading', Boolean(target?.closest('[data-flight-log]')));
  };
  const onLeave = () => {
    point(null);
    echo(null);
    root.classList.remove('is-reading');
  };

  root.addEventListener('pointerover', onOver);
  root.addEventListener('focusin', onOver);
  root.addEventListener('pointerleave', onLeave);
  root.addEventListener('focusout', onLeave);

  return {
    place(element, x, y, showing) {
      if (element !== pointedStar || !pointedRow || !leader) return;
      if (!showing) {
        hideLeader();
        return;
      }
      const box = stage.getBoundingClientRect();
      const from = pointedRow.getBoundingClientRect();
      const startX = from.right - box.left + 6;
      const startY = from.top + from.height / 2 - box.top;
      const turn = startX + (x > startX ? ELBOW : -ELBOW);
      leader.setAttribute('d', `M${startX.toFixed(1)} ${startY.toFixed(1)}H${turn.toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}`);
    },
    update(progress, revealed, warp) {
      for (const log of logs) {
        const index = Number(log.dataset.flightLog);
        const opacity = warp || revealed === index ? 0 : clamp(1 - Math.abs(progress - index) * 2.4);
        log.style.opacity = opacity.toFixed(3);
        log.style.visibility = opacity < 0.02 ? 'hidden' : 'visible';
        log.style.transform = `translate3d(0, ${((index - progress) * 40).toFixed(1)}px, 0)`;
        const idle = opacity < 0.4;
        log.classList.toggle('is-idle', idle);
        if (idle && pointedRow && log.contains(pointedRow)) point(null);
      }
    },
    stop() {
      root.removeEventListener('pointerover', onOver);
      root.removeEventListener('focusin', onOver);
      root.removeEventListener('pointerleave', onLeave);
      root.removeEventListener('focusout', onLeave);
      point(null);
      echo(null);
      root.classList.remove('is-reading');
    },
  };
}
