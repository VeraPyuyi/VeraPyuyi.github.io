/**
 * Builds the backdrop and the galaxy particle models, nearest galaxy first, in a worker when
 * possible (so scrolling never stutters) and on the main thread one model per tick otherwise.
 */

import type { GalaxyKind } from '@/lib/galaxy';
import { buildBackdrop, buildGalaxyModel, GALAXY_PLACEMENTS } from '@/lib/galaxy-flight';
import type { BuiltModel, ModelJob } from './model-worker';

/** Light particles per galaxy on a capable desktop; phones and small machines get about half. */
const BUDGETS = { blogs: 170_000, papers: 140_000, photos: 90_000, moments: 100_000 } as const;
const BACKDROP_BUDGET = 16_000;

export interface ModelLoader {
  /** True until every model has arrived. */
  readonly busy: boolean;
  stop(): void;
}

export function loadModels(options: {
  small: boolean;
  progress: number;
  onBuilt: (model: BuiltModel) => void;
  /** Build only these galaxies (the backdrop always comes), e.g. one page's own galaxy. */
  only?: readonly GalaxyKind[];
  /** Share of the full particle budget. */
  share?: number;
}): ModelLoader {
  const { small, progress, onBuilt, only, share = 1 } = options;
  const jobs: ModelJob[] = [{ id: 'backdrop', kind: 'backdrop', budget: BACKDROP_BUDGET * (small ? 0.6 : 1) }];
  const order = GALAXY_PLACEMENTS.map((_, index) => index).sort((a, b) => Math.abs(a - progress) - Math.abs(b - progress));
  for (const index of order) {
    const { kind } = GALAXY_PLACEMENTS[index];
    if (only && !only.includes(kind)) continue;
    jobs.push({ id: kind, kind, budget: BUDGETS[kind] * (small ? 0.5 : 1) * share });
  }
  const pending = new Set(jobs.map((job) => job.id));
  const receive = (model: BuiltModel) => {
    if (pending.delete(model.id)) onBuilt(model);
  };

  let timer = 0;
  const buildOnMainThread = () => {
    const job = jobs.find((candidate) => pending.has(candidate.id));
    if (!job) return;
    if (job.kind === 'backdrop') receive({ id: job.id, light: buildBackdrop(job.budget) });
    else receive({ id: job.id, ...buildGalaxyModel(job.kind, job.budget) });
    timer = window.setTimeout(buildOnMainThread, 16);
  };

  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('./model-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<BuiltModel>) => receive(event.data);
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      buildOnMainThread();
    };
    for (const job of jobs) worker.postMessage(job);
  } catch {
    worker = null;
    timer = window.setTimeout(buildOnMainThread, 0);
  }

  return {
    get busy() {
      return pending.size > 0;
    },
    stop() {
      window.clearTimeout(timer);
      pending.clear();
      worker?.terminate();
    },
  };
}
