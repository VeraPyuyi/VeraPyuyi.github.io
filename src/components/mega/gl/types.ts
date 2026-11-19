import type { MegaItem } from '@/lib/megastructures';
import type { ShipKind } from '../ships';

export type Vec3 = [number, number, number];

export interface Camera {
  eye: Vec3;
  right: Vec3;
  up: Vec3;
  forward: Vec3;
}

/** A ship in world space; drawn as a sprite over the render. */
export interface ShipPose {
  kind: ShipKind;
  position: Vec3;
  /** Direction of travel (world). */
  heading: Vec3;
  /** Hull length in world units. */
  length: number;
  color: string;
  alpha: number;
}

export interface OverlayFrame {
  ctx: CanvasRenderingContext2D;
  time: number;
  width: number;
  height: number;
  items: readonly MegaItem[];
  focus: number;
  /** World point to CSS pixels and depth, or null when behind the camera. */
  project: (point: Vec3) => { x: number; y: number; depth: number } | null;
  camera: Camera;
}

/** One megastructure, rendered by a fragment shader with markers and ships drawn over it. */
export interface Mega3D {
  /** GLSL defining `vec3 render(vec3 ro, vec3 rd, vec2 px)` (see prelude). */
  fragment: string;
  camera: {
    distance: number;
    pitch: number;
    yaw: number;
    /** World radius that should fill the scene's `size` in pixels. */
    extent: number;
    /** Slow side-to-side drift of the view, radians. */
    sway?: number;
  };
  nebula: [Vec3, Vec3];
  exposure?: number;
  /** Strength of the bloom added back over the render. */
  bloom?: number;
  /** Data for the shader's u_items[index]; meaning is up to the scene. */
  itemData?: (index: number, count: number) => [number, number, number, number];
  /** World position of an item's marker at `time`, or null when it is hidden from the camera. */
  marker?: (index: number, count: number, time: number, camera: Camera) => Vec3 | null;
  ships?: (time: number) => ShipPose[];
  /** Extra drawing over the render (streams of text, sweeps…). */
  overlay?: (frame: OverlayFrame) => void;
}
