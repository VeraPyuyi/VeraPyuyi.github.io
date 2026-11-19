/**
 * Generates a page's nebula particles (src/lib/sky-nebula.ts) off the main thread, so the page
 * stays responsive while a couple of hundred thousand grains are laid down. The buffer is
 * transferred, not copied.
 */

import type { SkyEnvironment } from '@/lib/sky-catalog';
import { type NebulaParticles, nebulaParticles } from '@/lib/sky-nebula';

export interface NebulaJob {
  env: SkyEnvironment;
  columns: boolean;
  share: number;
}

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<NebulaJob>) => void) | null;
  postMessage(message: NebulaParticles, transfer: Transferable[]): void;
};

scope.onmessage = (event) => {
  const { env, columns, share } = event.data;
  const particles = nebulaParticles(env, { columns, share });
  scope.postMessage(particles, [particles.data.buffer as ArrayBuffer]);
};
