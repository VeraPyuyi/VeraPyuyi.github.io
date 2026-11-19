/**
 * Builds the backdrop and the galaxy particle models, nearest galaxy first, in a worker when
 * possible (so scrolling never stutters) and on the main thread one model per tick otherwise.
 * Built models are kept for the rest of the visit (the page swaps without reloading scripts), so
 * coming back to a page, or to the homepage, brings its sky back at once instead of rebuilding.
 */

import type { GalaxyKind } from '@/lib/galaxy';
import { buildBackdrop, buildGalaxyModel, GALAXY_PLACEMENTS } from '@/lib/galaxy-flight';
import type { BuiltModel, ModelJob } from './model-worker';

/** Light particles per galaxy on a capable desktop; phones and small machines get about half. */
const BUDGETS = { blogs: 170_000, papers: 140_000, photos: 90_000, moments: 100_000 } as const;
const BACKDROP_BUDGET = 110_000;

/**
 * Models built during this visit, by id, with the budget each was built at. A request is served
 * by any kept model at least as detailed as it asks for: the homepage builds every galaxy at full
 * size, so a page hero opened from it (which asks for less) never has to build its galaxy again.
 */
const built = new Map<string, { budget: number; model: BuiltModel }>();
const keptFor = (job: ModelJob) => {
  const kept = built.get(job.id);
  return kept && kept.budget >= job.budget * 0.98 ? kept.model : null;
};

export interface ModelLoader {
  /** True until every model has arrived. */
  readonly busy: boolean;
  stop(): void;
}

export function loadModels(options: {
  small: boolean;
  progress: number;
  /** `cached` is true for a model built earlier in this visit: it can appear at once, without a fade-in. */
  onBuilt: (model: BuiltModel, cached: boolean) => void;
  /** Build only these galaxies (the backdrop always comes), e.g. one page's own galaxy. */
  only?: readonly GalaxyKind[];
  /** Share of the full particle budget. */
  share?: number;
}): ModelLoader {
  const { small, progress, onBuilt, only, share = 1 } = options;
  let jobs: ModelJob[] = [{ id: 'backdrop', kind: 'backdrop', budget: BACKDROP_BUDGET * (small ? 0.6 : 1) }];
  const order = GALAXY_PLACEMENTS.map((_, index) => index).sort((a, b) => Math.abs(a - progress) - Math.abs(b - progress));
  for (const index of order) {
    const { kind } = GALAXY_PLACEMENTS[index];
    if (only && !only.includes(kind)) continue;
    jobs.push({ id: kind, kind, budget: BUDGETS[kind] * (small ? 0.5 : 1) * share });
  }
  const pending = new Set(jobs.map((job) => job.id));
  const budgets = new Map(jobs.map((job) => [job.id, job]));
  const receive = (model: BuiltModel, cached = false) => {
    const job = budgets.get(model.id);
    if (job && !cached && (built.get(model.id)?.budget ?? 0) < job.budget) built.set(model.id, { budget: job.budget, model });
    if (pending.delete(model.id)) onBuilt(model, cached);
  };
  // Models already built this visit arrive straight away; only the rest go to the builder.
  for (const job of jobs) {
    const model = keptFor(job);
    if (model) receive(model, true);
  }
  jobs = jobs.filter((job) => pending.has(job.id));
  if (!jobs.length) {
    return {
      busy: false,
      stop() {},
    };
  }

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
