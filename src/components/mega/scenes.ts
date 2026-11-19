import type { MegaKind } from '@/lib/megastructures';
import type { SceneFactory } from './engine';
import { assembly, gateway } from './scenes-gather';
import { decompressor, habitat, ringworld } from './scenes-life';
import { dyson, nexus, sentry } from './scenes-research';

export const SCENES: Record<MegaKind, SceneFactory> = {
  sentry,
  nexus,
  dyson,
  ringworld,
  habitat,
  decompressor,
  assembly,
  gateway,
};
