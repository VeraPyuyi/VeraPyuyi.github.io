/**
 * WebGL2 renderer for the galaxy flight.
 *
 * Particles are drawn as soft sprites into a half-float (HDR) target: starlight adds up,
 * dust multiplies it down. A dual-filter bloom then lets bright cores and young clusters
 * glow, and an ACES tone map brings everything back to the screen without clipping.
 */

import type { Mat4, ParticleSet } from '@/lib/galaxy-flight';
import { type BlackHoleInput, createBlackHolePass } from './black-hole-pass';
import { compile, createTarget, deleteTarget, FULLSCREEN_VERTEX, type Program, type Target } from './gl-utils';

export interface ParticleLayer {
  /** Id given to `upload`. */
  mesh: string;
  model: Mat4;
  /** World units per model unit, used for sprite sizes and the near fade. */
  modelScale: number;
  /** Turn of the object about its axis, radians. */
  spin: number;
  /** Amount of slow, per-star drift around the orbit. */
  wobble: number;
  /** 0–1 fade of the whole layer. */
  alpha: number;
  /** Dust absorbs instead of adding light. */
  dust: boolean;
  /** Sprite sizes (model units) over which stars turn into soft puffs. */
  soft: readonly [number, number];
  /** 0–1: draw stars as sharp points with faint diffraction spikes (the background sky). */
  spikes?: number;
}

export interface FrameInput {
  view: Mat4;
  projection: Mat4;
  fieldOfView: number;
  time: number;
  exposure: number;
  layers: readonly ParticleLayer[];
  /** The black hole, when it is close enough to be seen. */
  blackHole?: BlackHoleInput | null;
}

export interface GalaxyRenderer {
  upload(id: string, set: ParticleSet): void;
  resize(cssWidth: number, cssHeight: number, pixelRatio: number): void;
  render(frame: FrameInput): void;
  /** Fraction (0–1] of every mesh to draw; meshes are shuffled, so a prefix is a fair sample. */
  setDetail(fraction: number): void;
  destroy(): void;
}

const PARTICLE_VERTEX = `#version 300 es
layout(location = 0) in vec3 a_polar;
layout(location = 1) in vec3 a_color;
layout(location = 2) in float a_size;
layout(location = 3) in float a_phase;
uniform mat4 u_model;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform float u_spin;
uniform float u_time;
uniform float u_wobble;
uniform float u_pixels;
uniform float u_scale;
uniform float u_alpha;
uniform vec2 u_sizeRange;
uniform vec2 u_soft;
out vec3 v_color;
out float v_soft;
void main() {
  float r = a_polar.x;
  float theta = a_polar.y + u_spin + u_wobble * sin(u_time * 0.35 + a_phase * 6.2832) / (0.6 + r * 3.0);
  vec4 view = u_view * (u_model * vec4(r * cos(theta), a_polar.z, r * sin(theta), 1.0));
  gl_Position = u_projection * view;
  float depth = -view.z;
  if (depth < 0.05) {
    gl_PointSize = 0.0;
    v_color = vec3(0.0);
    v_soft = 0.0;
    return;
  }
  v_soft = smoothstep(u_soft.x, u_soft.y, a_size);
  // Scintillation: about 40% of stars flicker, each at its own uneven rhythm (two detuned waves),
  // the strongest dipping almost to nothing. Soft puffs of gas stay steady.
  float twinkle = 1.0;
  float pick = fract(a_phase * 13.7);
  if (pick > 0.6) {
    float speed = 1.4 + fract(a_phase * 7.31) * 5.0;
    float wave = 0.6 * sin(u_time * speed + a_phase * 50.0) + 0.4 * sin(u_time * speed * 1.73 + a_phase * 91.0);
    float strength = 0.35 + 0.6 * (pick - 0.6) / 0.4;
    twinkle = mix(max(0.04, 1.0 + wave * strength), 1.0, v_soft);
  }
  float px = a_size * u_scale * u_pixels / depth;
  float size = clamp(px, u_sizeRange.x, u_sizeRange.y);
  // Sub-pixel stars keep their light by dimming; huge sprites right next to the camera fade away.
  float energy = px < size ? (px * px) / (size * size) : size / px;
  float near = smoothstep(0.4, 3.0, depth);
  v_color = a_color * energy * twinkle * near * u_alpha;
  gl_PointSize = size;
}`;

const PARTICLE_FRAGMENT = `#version 300 es
precision highp float;
in vec3 v_color;
in float v_soft;
uniform float u_spikes;
out vec4 outColor;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d2 = dot(p, p);
  if (d2 > 1.0) discard;
  // Background stars are sharper points, and the larger (brighter) ones carry the faint cross of
  // diffraction spikes a telescope gives them.
  float star = exp(-d2 * mix(7.0, 20.0, u_spikes)) + mix(0.12, 0.06, u_spikes) * exp(-d2 * 2.2);
  vec2 a = abs(p);
  star += u_spikes * 0.3 * (exp(-a.y * 38.0) * (1.0 - a.x) + exp(-a.x * 38.0) * (1.0 - a.y));
  float puff = exp(-d2 * 3.0) * (1.0 - d2);
  outColor = vec4(v_color * mix(star, puff, v_soft), 1.0);
}`;

const DOWN_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texel;
uniform float u_threshold;
out vec4 outColor;
vec3 tap(vec2 uv) { return texture(u_source, uv).rgb; }
void main() {
  vec3 c = tap(v_uv) * 4.0 + tap(v_uv - u_texel) + tap(v_uv + u_texel)
    + tap(v_uv + vec2(u_texel.x, -u_texel.y)) + tap(v_uv + vec2(-u_texel.x, u_texel.y));
  c /= 8.0;
  if (u_threshold > 0.0) {
    float bright = max(c.r, max(c.g, c.b));
    float knee = clamp(bright - u_threshold + 0.5, 0.0, 1.0);
    c *= max(knee * knee * 0.5, bright - u_threshold) / max(bright, 1e-4);
  }
  outColor = vec4(c, 1.0);
}`;

const UP_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_source;
uniform vec2 u_texel;
out vec4 outColor;
void main() {
  vec2 h = u_texel;
  vec3 c = texture(u_source, v_uv + vec2(-h.x * 2.0, 0.0)).rgb + texture(u_source, v_uv + vec2(h.x * 2.0, 0.0)).rgb
    + texture(u_source, v_uv + vec2(0.0, -h.y * 2.0)).rgb + texture(u_source, v_uv + vec2(0.0, h.y * 2.0)).rgb
    + (texture(u_source, v_uv + vec2(-h.x, h.y)).rgb + texture(u_source, v_uv + vec2(h.x, h.y)).rgb
    + texture(u_source, v_uv + vec2(h.x, -h.y)).rgb + texture(u_source, v_uv + vec2(-h.x, -h.y)).rgb) * 2.0;
  outColor = vec4(c / 12.0, 1.0);
}`;

// Deep space behind everything. Drawn into the scene first, so the black hole can swallow it too.
const SKY_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 outColor;
void main() {
  vec2 c = v_uv - 0.5;
  vec3 space = mix(vec3(0.004, 0.005, 0.016), vec3(0.012, 0.011, 0.034), v_uv.y)
    + vec3(0.012, 0.008, 0.026) * exp(-dot(c, c) * 3.0);
  outColor = vec4(space, 1.0);
}`;

const COMPOSITE_FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_exposure;
uniform float u_bloomStrength;
uniform float u_time;
out vec4 outColor;
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 c = v_uv - 0.5;
  vec3 hdr = texture(u_scene, v_uv).rgb + texture(u_bloom, v_uv).rgb * u_bloomStrength;
  vec3 mapped = aces(hdr * u_exposure);
  mapped = max(mix(vec3(dot(mapped, vec3(0.2126, 0.7152, 0.0722))), mapped, 1.2), 0.0);
  vec3 color = pow(mapped, vec3(1.0 / 2.2));
  color *= 1.0 - dot(c, c) * 0.6;
  color += (hash(gl_FragCoord.xy + fract(u_time) * 97.0) - 0.5) / 255.0;
  outColor = vec4(color, 1.0);
}`;

interface Mesh {
  vao: WebGLVertexArrayObject;
  buffers: WebGLBuffer[];
  count: number;
}

const BLOOM_LEVELS = 5;

/** Creates the renderer, or returns null when WebGL2 is unavailable. */
export function createGalaxyRenderer(canvas: HTMLCanvasElement): GalaxyRenderer | null {
  const context = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  });
  if (!context) return null;
  const gl: WebGL2RenderingContext = context;
  let particles: Program;
  let down: Program;
  let up: Program;
  let composite: Program;
  let sky: Program;
  try {
    particles = compile(gl, PARTICLE_VERTEX, PARTICLE_FRAGMENT);
    down = compile(gl, FULLSCREEN_VERTEX, DOWN_FRAGMENT);
    up = compile(gl, FULLSCREEN_VERTEX, UP_FRAGMENT);
    composite = compile(gl, FULLSCREEN_VERTEX, COMPOSITE_FRAGMENT);
    sky = compile(gl, FULLSCREEN_VERTEX, SKY_FRAGMENT);
  } catch {
    return null;
  }
  const hdr = Boolean(gl.getExtension('EXT_color_buffer_float'));
  const maxPoint = (gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array)[1] ?? 64;
  const emptyVao = gl.createVertexArray();
  const meshes = new Map<string, Mesh>();
  const blackHolePass = createBlackHolePass(gl, hdr);
  let scene: Target | null = null;
  let lensed: Target | null = null;
  let bloom: Target[] = [];
  let ratio = 1;
  let detail = 1;

  const createTargetSized = (width: number, height: number) => createTarget(gl, hdr, width, height);

  function dropTargets() {
    for (const target of [scene, lensed, ...bloom]) deleteTarget(gl, target);
    scene = null;
    lensed = null;
    bloom = [];
  }

  function fullscreen(program: Program, target: Target | null, source: Target, texel: Target, extra?: () => void) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
    gl.viewport(0, 0, target?.width ?? gl.drawingBufferWidth, target?.height ?? gl.drawingBufferHeight);
    gl.useProgram(program.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, source.texture);
    gl.uniform1i(program.uniform('u_source'), 0);
    gl.uniform2f(program.uniform('u_texel'), 1 / texel.width, 1 / texel.height);
    extra?.();
    gl.bindVertexArray(emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return {
    upload(id, set) {
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const buffers = [set.polar, set.color, set.size, set.phase].map((data, location) => {
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, location < 2 ? 3 : 1, gl.FLOAT, false, 0, 0);
        return buffer;
      });
      gl.bindVertexArray(null);
      const previous = meshes.get(id);
      if (previous) {
        gl.deleteVertexArray(previous.vao);
        for (const buffer of previous.buffers) gl.deleteBuffer(buffer);
      }
      meshes.set(id, { vao, buffers, count: set.count });
    },

    resize(cssWidth, cssHeight, pixelRatio) {
      ratio = pixelRatio;
      const width = Math.max(1, Math.round(cssWidth * pixelRatio));
      const height = Math.max(1, Math.round(cssHeight * pixelRatio));
      if (canvas.width === width && canvas.height === height && scene) return;
      canvas.width = width;
      canvas.height = height;
      dropTargets();
      scene = createTargetSized(width, height);
      lensed = createTargetSized(width, height);
      blackHolePass?.resize(width, height);
      let w = width;
      let h = height;
      for (let level = 0; level < BLOOM_LEVELS; level++) {
        w = Math.max(1, Math.floor(w / 2));
        h = Math.max(1, Math.floor(h / 2));
        bloom.push(createTargetSized(w, h));
      }
    },

    setDetail(fraction) {
      detail = Math.min(1, Math.max(0.15, fraction));
    },

    render(frame) {
      if (!scene || gl.isContextLost()) return;
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.framebuffer);
      gl.viewport(0, 0, scene.width, scene.height);
      gl.useProgram(sky.program);
      gl.bindVertexArray(emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.enable(gl.BLEND);
      gl.useProgram(particles.program);
      const u = particles.uniform;
      gl.uniformMatrix4fv(u('u_view'), false, frame.view);
      gl.uniformMatrix4fv(u('u_projection'), false, frame.projection);
      gl.uniform1f(u('u_time'), frame.time);
      gl.uniform1f(u('u_pixels'), scene.height / (2 * Math.tan(frame.fieldOfView / 2)));
      gl.uniform2f(u('u_sizeRange'), Math.max(1, ratio), Math.min(maxPoint, 64 * ratio));
      for (const layer of frame.layers) {
        const mesh = meshes.get(layer.mesh);
        if (!mesh || layer.alpha <= 0.001) continue;
        if (layer.dust) gl.blendFunc(gl.ZERO, gl.ONE_MINUS_SRC_COLOR);
        else gl.blendFunc(gl.ONE, gl.ONE);
        gl.uniformMatrix4fv(u('u_model'), false, layer.model);
        gl.uniform1f(u('u_scale'), layer.modelScale);
        gl.uniform1f(u('u_spin'), layer.spin);
        gl.uniform1f(u('u_wobble'), layer.wobble);
        gl.uniform1f(u('u_alpha'), layer.alpha);
        gl.uniform2f(u('u_soft'), layer.soft[0], layer.soft[1]);
        gl.uniform1f(u('u_spikes'), layer.spikes ?? 0);
        gl.bindVertexArray(mesh.vao);
        gl.drawArrays(gl.POINTS, 0, Math.floor(mesh.count * detail));
      }
      gl.disable(gl.BLEND);

      // The black hole bends everything already drawn; the lensed copy replaces the scene from here on.
      let lit = scene;
      if (frame.blackHole && blackHolePass && lensed) {
        blackHolePass.draw(scene, lensed, frame.blackHole, emptyVao);
        lit = lensed;
      }

      // Bloom: threshold and halve down the chain, then add each level back up.
      fullscreen(down, bloom[0], lit, lit, () => gl.uniform1f(down.uniform('u_threshold'), 1.1));
      for (let level = 1; level < bloom.length; level++) {
        fullscreen(down, bloom[level], bloom[level - 1], bloom[level - 1], () => gl.uniform1f(down.uniform('u_threshold'), 0));
      }
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      for (let level = bloom.length - 1; level > 0; level--) {
        fullscreen(up, bloom[level - 1], bloom[level], bloom[level]);
      }
      gl.disable(gl.BLEND);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.useProgram(composite.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, lit.texture);
      gl.uniform1i(composite.uniform('u_scene'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, bloom[0].texture);
      gl.uniform1i(composite.uniform('u_bloom'), 1);
      gl.uniform1f(composite.uniform('u_exposure'), frame.exposure);
      gl.uniform1f(composite.uniform('u_bloomStrength'), hdr ? 0.7 : 0.45);
      gl.uniform1f(composite.uniform('u_time'), frame.time);
      gl.bindVertexArray(emptyVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },

    destroy() {
      dropTargets();
      blackHolePass?.destroy();
      for (const mesh of meshes.values()) {
        gl.deleteVertexArray(mesh.vao);
        for (const buffer of mesh.buffers) gl.deleteBuffer(buffer);
      }
      meshes.clear();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
