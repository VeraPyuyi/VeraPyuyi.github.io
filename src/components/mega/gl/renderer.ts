/** Runs a megastructure fragment shader full-screen at a reduced, adaptive resolution. */

import { compile, FULLSCREEN_VERTEX, type Program } from '@/components/home/galaxy-flight/gl-utils';
import { createPost } from './post';
import { PRELUDE } from './prelude';
import type { Camera, Mega3D, Vec3 } from './types';

export interface RenderState {
  time: number;
  cssWidth: number;
  cssHeight: number;
  centerX: number;
  centerY: number;
  size: number;
  count: number;
  focus: number;
  colors: readonly Vec3[];
  galaxyRect: [number, number, number, number];
}

export interface MegaRenderer {
  camera(time: number): Camera;
  focal(size: number): number;
  render(state: RenderState): void;
  /** Lower the internal resolution after slow frames. */
  scale: number;
  dispose(): void;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function sceneCamera(scene: Mega3D, time: number): Camera {
  const { distance, pitch, yaw, sway = 0.12 } = scene.camera;
  const y = yaw + Math.sin(time * 0.045) * sway;
  const p = pitch + Math.sin(time * 0.031 + 1) * sway * 0.25;
  const eye: Vec3 = [Math.sin(y) * Math.cos(p) * distance, Math.sin(p) * distance, Math.cos(y) * Math.cos(p) * distance];
  const forward = normalize(sub([0, 0, 0], eye));
  const right = normalize(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  return { eye, right, up, forward };
}

export function projectPoint(camera: Camera, focal: number, cx: number, cy: number, point: Vec3) {
  const rel = sub(point, camera.eye);
  const z = dot(rel, camera.forward);
  if (z <= 0.01) return null;
  return { x: cx + (focal * dot(rel, camera.right)) / z, y: cy - (focal * dot(rel, camera.up)) / z, depth: z };
}

export function createMegaRenderer(
  canvas: HTMLCanvasElement,
  scene: Mega3D,
  items: readonly [number, number, number, number][],
  galaxySrc: string | undefined,
): MegaRenderer | null {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  let program: Program;
  try {
    program = compile(gl, FULLSCREEN_VERTEX, PRELUDE + scene.fragment);
  } catch (error) {
    console.warn('[mega] shader', error);
    return null;
  }
  const galaxy = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, galaxy);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  let galaxyReady = false;
  if (galaxySrc) {
    const image = new Image();
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, galaxy);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      galaxyReady = true;
    };
    image.src = galaxySrc;
  }
  const post = createPost(gl);
  const itemData = new Float32Array(32 * 4);
  items.slice(0, 32).forEach((value, index) => itemData.set(value, index * 4));
  const colorData = new Float32Array(32 * 3);

  const renderer: MegaRenderer = {
    scale: 0.75,
    camera: (time) => sceneCamera(scene, time),
    focal: (size) => (size * scene.camera.distance) / scene.camera.extent,
    render(state) {
      const ratio = Math.min(window.devicePixelRatio || 1, 2) * renderer.scale;
      const width = Math.max(1, Math.round(state.cssWidth * ratio));
      const height = Math.max(1, Math.round(state.cssHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      const camera = renderer.camera(state.time);
      const hdr = post?.begin(width, height) ?? false;
      if (!hdr) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
      }
      gl.useProgram(program.program);
      const u = program.uniform;
      gl.uniform1i(u('u_direct'), hdr ? 0 : 1);
      gl.uniform2f(u('u_res'), width, height);
      gl.uniform2f(u('u_css'), state.cssWidth, state.cssHeight);
      gl.uniform2f(u('u_center'), state.centerX, state.centerY);
      gl.uniform1f(u('u_focal'), renderer.focal(state.size));
      gl.uniform3fv(u('u_eye'), camera.eye);
      gl.uniformMatrix3fv(u('u_view'), false, [...camera.right, ...camera.up, ...camera.forward]);
      gl.uniform1f(u('u_time'), state.time);
      gl.uniform1f(u('u_exposure'), scene.exposure ?? 1);
      gl.uniform1i(u('u_count'), Math.min(state.count, 32));
      gl.uniform1i(u('u_focus'), state.focus);
      gl.uniform4fv(u('u_items'), itemData);
      colorData.fill(0);
      state.colors.slice(0, 32).forEach((color, index) => colorData.set(color, index * 3));
      gl.uniform3fv(u('u_colors'), colorData);
      gl.uniform3fv(u('u_nebulaA'), scene.nebula[0]);
      gl.uniform3fv(u('u_nebulaB'), scene.nebula[1]);
      gl.uniform4fv(u('u_galaxyRect'), galaxyReady ? state.galaxyRect : [0, 0, 0, 0]);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, galaxy);
      gl.uniform1i(u('u_galaxy'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (hdr) post?.finish(state.time, scene.bloom ?? 0.12);
    },
    dispose() {
      post?.dispose();
      gl.deleteProgram(program.program);
      gl.deleteTexture(galaxy);
    },
  };
  return renderer;
}
