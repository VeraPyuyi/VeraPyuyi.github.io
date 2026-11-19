/**
 * A ray-traced Schwarzschild black hole, in the spirit of Interstellar's Gargantua.
 *
 * Each pixel's ray is bent with the classic approximation a = −3/2 · h² · r / |r|⁵ (in units of
 * the Schwarzschild radius), which reproduces the photon sphere, the shadow and the lensed image
 * of the far side of the disk arching over and under it. Rays that escape sample the already
 * rendered scene in their bent direction, so the stars and galaxies behind are lensed too.
 * It runs at half resolution and is merged into the HDR scene before bloom.
 */

import type { Vec3 } from '@/lib/galaxy-flight/scene';
import { compile, createTarget, deleteTarget, FULLSCREEN_VERTEX, type Target } from './gl-utils';

export interface BlackHoleInput {
  center: Vec3;
  /** World units per Schwarzschild radius. */
  scale: number;
  /** World → hole frame (column-major 3×3). */
  toLocal: Float32Array;
  eye: Vec3;
  viewProjection: Float32Array;
  inverseViewProjection: Float32Array;
  time: number;
  /** 0–1 fade, so the hole appears gently as the camera approaches. */
  alpha: number;
}

export interface BlackHolePass {
  resize(width: number, height: number): void;
  /** Lenses `scene` around the hole and writes the merged result into `out` (same size as scene). */
  draw(scene: Target, out: Target, input: BlackHoleInput, emptyVao: WebGLVertexArrayObject | null): void;
  destroy(): void;
}

const HOLE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform mat4 u_viewProjection;
uniform mat4 u_inverseViewProjection;
uniform mat3 u_toLocal;
uniform vec3 u_eye;
uniform vec3 u_center;
uniform float u_scale;
uniform float u_time;
uniform float u_alpha;
out vec4 outColor;

const float BOUND = 20.0;
const float R_IN = 2.6;
const float R_OUT = 14.0;
const float FLOW_PERIOD = 9.0;

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise3(p);
    p = p * 2.03 + vec3(1.7, 9.2, 3.1);
    amplitude *= 0.5;
  }
  return value;
}

// Emission (rgb, already weighted) and opacity of the disk where a ray crosses it.
vec4 disk(vec3 p, vec3 dir) {
  float r = length(p.xz);
  // Keplerian flow: the inner edge laps the hole every few seconds, the outer gas drifts slowly.
  // Two texture layers advance in turn and cross-fade, so the shear never winds the streaks
  // into ever finer stripes, however long the page stays open.
  float theta = atan(p.z, p.x);
  float sweep = FLOW_PERIOD * 3.4 / pow(r, 1.5);
  float phase = fract(u_time / FLOW_PERIOD);
  float weight = 1.0 - abs(2.0 * phase - 1.0);
  float a1 = theta - sweep * phase;
  float a2 = theta - sweep * fract(phase + 0.5) + 2.1;
  float streaks = mix(
    fbm(vec3(cos(a2) * 2.2, sin(a2) * 2.2, r * 3.2 + 5.0)),
    fbm(vec3(cos(a1) * 2.2, sin(a1) * 2.2, r * 3.2)),
    weight);
  float fine = mix(
    noise3(vec3(cos(a2) * 7.0, sin(a2) * 7.0, r * 12.0 + 3.0)),
    noise3(vec3(cos(a1) * 7.0, sin(a1) * 7.0, r * 12.0)),
    weight);
  // Cross-fading two layers flattens the contrast a little; win it back.
  streaks = clamp((streaks - 0.5) * 1.45 + 0.5, 0.0, 1.0);
  float t = clamp((r - R_IN) / (R_OUT - R_IN), 0.0, 1.0);
  float profile = smoothstep(R_IN * 0.96, R_IN * 1.25, r) * (1.0 - smoothstep(0.5, 1.0, t)) * pow(R_IN / r, 1.5);
  float density = profile * (0.3 + 1.2 * streaks * (0.65 + 0.7 * fine));
  vec3 color = mix(vec3(1.0, 0.94, 0.84), vec3(1.0, 0.62, 0.27), smoothstep(0.0, 0.4, t));
  color = mix(color, vec3(0.78, 0.27, 0.1), smoothstep(0.4, 1.0, t));
  // Relativistic beaming: the side of the disk moving towards us is brighter.
  vec3 orbit = normalize(vec3(-p.z, 0.0, p.x));
  float beta = clamp(0.62 / sqrt(r), 0.0, 0.6);
  float g = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(orbit, -dir));
  float beaming = mix(1.0, g * g * g, 0.6);
  return vec4(color * density * 1.6 * beaming, clamp(density * 1.8, 0.0, 0.97));
}

vec3 sky(vec3 direction) {
  vec4 clip = u_viewProjection * vec4(u_eye + direction * 900.0, 1.0);
  if (clip.w > 0.0) {
    vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
    if (uv == clamp(uv, 0.0, 1.0)) return texture(u_scene, uv).rgb;
  }
  // Bent off screen: the average colour of space plus a sparse star field, so the lensed sky never shows holes.
  float h = hash3(floor(direction * 160.0));
  return vec3(0.011, 0.010, 0.03) + vec3(0.9, 0.95, 1.0) * step(0.986, h) * (h - 0.986) * 60.0;
}

void main() {
  vec4 farPoint = u_inverseViewProjection * vec4(v_uv * 2.0 - 1.0, 1.0, 1.0);
  vec3 direction = normalize(farPoint.xyz / farPoint.w - u_eye);
  vec3 pos = u_toLocal * ((u_eye - u_center) / u_scale);
  vec3 vel = normalize(u_toLocal * direction);
  float b = dot(pos, vel);
  float disc = b * b - (dot(pos, pos) - BOUND * BOUND);
  if (disc < 0.0 || -b + sqrt(disc) < 0.0) {
    outColor = vec4(0.0);
    return;
  }
  pos += vel * max(0.0, -b - sqrt(disc));
  vec3 momentum = cross(pos, vel);
  float h2 = dot(momentum, momentum);
  vec3 color = vec3(0.0);
  float alpha = 0.0;
  bool captured = false;
  for (int i = 0; i < 220; i++) {
    float r2 = dot(pos, pos);
    if (r2 < 1.0) {
      captured = true;
      break;
    }
    if (r2 > BOUND * BOUND * 1.01 && dot(pos, vel) > 0.0) break;
    float r = sqrt(r2);
    float dt = clamp(0.08 * (r - 0.9) * r, 0.012, 0.9);
    vec3 previous = pos;
    vel += -1.5 * h2 * pos / (r2 * r2 * r) * dt;
    pos += vel * dt;
    if (previous.y * pos.y < 0.0) {
      vec3 hit = mix(previous, pos, previous.y / (previous.y - pos.y));
      float rr = length(hit.xz);
      if (rr > R_IN * 0.9 && rr < R_OUT) {
        vec4 emission = disk(hit, normalize(vel));
        color += (1.0 - alpha) * emission.rgb;
        alpha += (1.0 - alpha) * emission.a;
        if (alpha > 0.985) break;
      }
    }
  }
  // Rays grazing the photon sphere would smear single stars into a dotted ring; let them fade to dark.
  float graze = 0.25 + 0.75 * smoothstep(2.6, 2.9, sqrt(h2));
  vec3 background = captured ? vec3(0.0) : sky(normalize(transpose(u_toLocal) * vel)) * graze;
  // Lensing fades out towards the bounding sphere, where it meets the unbent scene seamlessly.
  float cover = 1.0 - smoothstep(BOUND * 0.72, BOUND * 0.98, sqrt(h2));
  outColor = vec4(color + (1.0 - alpha) * background, cover * u_alpha);
}`;

const MERGE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_hole;
out vec4 outColor;
void main() {
  vec4 hole = texture(u_hole, v_uv);
  outColor = vec4(mix(texture(u_scene, v_uv).rgb, hole.rgb, hole.a), 1.0);
}`;

export function createBlackHolePass(gl: WebGL2RenderingContext, hdr: boolean): BlackHolePass | null {
  let hole: ReturnType<typeof compile>;
  let merge: ReturnType<typeof compile>;
  try {
    hole = compile(gl, FULLSCREEN_VERTEX, HOLE_FRAGMENT);
    merge = compile(gl, FULLSCREEN_VERTEX, MERGE_FRAGMENT);
  } catch {
    return null;
  }
  let target: Target | null = null;

  return {
    resize(width, height) {
      deleteTarget(gl, target);
      target = createTarget(gl, hdr, Math.max(1, Math.floor(width / 2)), Math.max(1, Math.floor(height / 2)));
    },

    draw(scene, out, input, emptyVao) {
      if (!target) return;
      gl.bindVertexArray(emptyVao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, target.width, target.height);
      gl.useProgram(hole.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, scene.texture);
      gl.uniform1i(hole.uniform('u_scene'), 0);
      gl.uniformMatrix4fv(hole.uniform('u_viewProjection'), false, input.viewProjection);
      gl.uniformMatrix4fv(hole.uniform('u_inverseViewProjection'), false, input.inverseViewProjection);
      gl.uniformMatrix3fv(hole.uniform('u_toLocal'), false, input.toLocal);
      gl.uniform3f(hole.uniform('u_eye'), input.eye[0], input.eye[1], input.eye[2]);
      gl.uniform3f(hole.uniform('u_center'), input.center[0], input.center[1], input.center[2]);
      gl.uniform1f(hole.uniform('u_scale'), input.scale);
      gl.uniform1f(hole.uniform('u_time'), input.time);
      gl.uniform1f(hole.uniform('u_alpha'), input.alpha);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, out.framebuffer);
      gl.viewport(0, 0, out.width, out.height);
      gl.useProgram(merge.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, scene.texture);
      gl.uniform1i(merge.uniform('u_scene'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, target.texture);
      gl.uniform1i(merge.uniform('u_hole'), 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.activeTexture(gl.TEXTURE0);
    },

    destroy() {
      deleteTarget(gl, target);
      target = null;
    },
  };
}
