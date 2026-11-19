import type { MegaKind } from '@/lib/megastructures';
import { assembly3d } from './assembly';
import { decompressor3d } from './decompressor';
import { dyson3d } from './dyson';
import { gateway3d } from './gateway';
import { habitat3d } from './habitat';
import { nexus3d } from './nexus';
import { ringworld3d } from './ringworld';
import { sentry3d } from './sentry';
import type { Mega3D } from './types';

/** Rendered scenes, one per page; without WebGL2 a page falls back to its line-art scene. */
export const SCENES_3D: Record<MegaKind, Mega3D> = {
  sentry: sentry3d,
  nexus: nexus3d,
  dyson: dyson3d,
  ringworld: ringworld3d,
  habitat: habitat3d,
  decompressor: decompressor3d,
  assembly: assembly3d,
  gateway: gateway3d,
};
