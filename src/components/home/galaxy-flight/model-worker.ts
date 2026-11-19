/**
 * Builds galaxy particle models off the main thread, so the page stays responsive while
 * a few hundred thousand stars are generated. Buffers are transferred, not copied.
 */

import type { GalaxyKind } from '@/lib/galaxy';
import { buildBackdrop, buildGalaxyModel, type ParticleSet } from '@/lib/galaxy-flight';

export interface ModelJob {
  id: string;
  kind: GalaxyKind | 'backdrop';
  budget: number;
}

export interface BuiltModel {
  id: string;
  light: ParticleSet;
  dust?: ParticleSet;
}

const buffersOf = (set: ParticleSet): ArrayBuffer[] =>
  [set.polar, set.color, set.size, set.phase].map((array) => array.buffer as ArrayBuffer);

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ModelJob>) => void) | null;
  postMessage(message: BuiltModel, transfer: Transferable[]): void;
};

scope.onmessage = (event) => {
  const { id, kind, budget } = event.data;
  if (kind === 'backdrop') {
    const light = buildBackdrop(budget);
    scope.postMessage({ id, light }, buffersOf(light));
    return;
  }
  const { light, dust } = buildGalaxyModel(kind, budget);
  scope.postMessage({ id, light, dust }, [...buffersOf(light), ...buffersOf(dust)]);
};
