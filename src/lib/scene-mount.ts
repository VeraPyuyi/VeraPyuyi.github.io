/**
 * One live WebGL scene per slot for the whole tab.
 *
 * Page scripts persist across client-side navigations, and after a deploy a tab that stays open
 * can end up running two builds of the same script: the one it started with and the one the new
 * page brought. Each copy keeps its own idea of what it mounted, so both would start a renderer on
 * the same canvas and the two would draw over each other. The registry lives on `window`, so every
 * copy that uses it agrees on what is mounted and the newest call always wins.
 *
 * If the browser drops the GL context (GPU reset, too many contexts), the scene is rebuilt on a
 * fresh canvas instead of staying blank while the page's text keeps showing.
 */

interface LiveScene {
  root: HTMLElement;
  stop: () => void;
}

type SceneRegistry = Record<string, LiveScene | undefined>;

const scenes = (): SceneRegistry => {
  const host = window as Window & { __pyuyiScenes?: SceneRegistry };
  host.__pyuyiScenes ??= {};
  return host.__pyuyiScenes;
};

/** A lost context is rebuilt at most this many times per mount, so a broken GPU cannot loop. */
const MAX_REBUILDS = 2;

/** Stops whatever is mounted in `slot`, whichever copy of the script mounted it. */
export function unmountScene(slot: string): void {
  const registry = scenes();
  const live = registry[slot];
  registry[slot] = undefined;
  live?.stop();
}

/**
 * Mounts `mount(root)` in `slot`, unless the same root is already live there. Anything else in
 * the slot is stopped first. `canvasSelector` names the canvas whose GL context is watched.
 */
export function mountScene(
  slot: string,
  root: HTMLElement | null,
  canvasSelector: string,
  mount: (root: HTMLElement) => () => void,
): void {
  if (root && scenes()[slot]?.root === root) return;
  unmountScene(slot);
  if (!root) return;
  const host = root;

  let canvas = host.querySelector<HTMLCanvasElement>(canvasSelector);
  let unmount: () => void = () => undefined;
  let rebuilds = 0;
  let rebuildFrame = 0;

  const onLost = (event: Event) => {
    event.preventDefault();
    if (rebuilds >= MAX_REBUILDS || rebuildFrame) return;
    rebuilds++;
    // Rebuild on a fresh canvas: the old one's context stays unusable until the browser restores it.
    rebuildFrame = requestAnimationFrame(() => {
      rebuildFrame = 0;
      stopCurrent();
      if (canvas) {
        const fresh = canvas.cloneNode(false) as HTMLCanvasElement;
        canvas.replaceWith(fresh);
        canvas = fresh;
      }
      startCurrent();
    });
  };

  function startCurrent() {
    canvas?.addEventListener('webglcontextlost', onLost);
    unmount = mount(host);
  }
  function stopCurrent() {
    // Unmounting frees the context on purpose; that must not read as a loss to rebuild from.
    canvas?.removeEventListener('webglcontextlost', onLost);
    unmount();
    unmount = () => undefined;
  }

  startCurrent();
  scenes()[slot] = {
    root: host,
    stop() {
      cancelAnimationFrame(rebuildFrame);
      rebuildFrame = 0;
      stopCurrent();
    },
  };
}
