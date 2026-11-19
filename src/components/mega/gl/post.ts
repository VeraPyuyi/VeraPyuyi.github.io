/**
 * Post-processing for the megastructure render: a bloom chain (bright parts blurred down four
 * octaves) and a composite that adds it back, tone maps filmically, vignettes and dithers.
 */

import {
  compile,
  createTarget,
  deleteTarget,
  FULLSCREEN_VERTEX,
  type Program,
  type Target,
} from '@/components/home/galaxy-flight/gl-utils';

const DOWN = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_texel;
uniform float u_threshold;
out vec4 outColor;
void main() {
  vec3 c = texture(u_src, v_uv + u_texel * vec2(-1.0, -1.0)).rgb;
  c += texture(u_src, v_uv + u_texel * vec2(1.0, -1.0)).rgb;
  c += texture(u_src, v_uv + u_texel * vec2(-1.0, 1.0)).rgb;
  c += texture(u_src, v_uv + u_texel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  if (u_threshold > 0.0) {
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    c *= smoothstep(u_threshold, u_threshold * 3.0, l);
  }
  outColor = vec4(c, 1.0);
}`;

const COMPOSITE = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_b1;
uniform sampler2D u_b2;
uniform sampler2D u_b3;
uniform sampler2D u_b4;
uniform float u_time;
uniform float u_bloom;
out vec4 outColor;
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
void main() {
  vec3 c = texture(u_scene, v_uv).rgb;
  vec3 bloom = texture(u_b1, v_uv).rgb * 0.4 + texture(u_b2, v_uv).rgb * 0.6 + texture(u_b3, v_uv).rgb * 0.9
    + texture(u_b4, v_uv).rgb * 1.2;
  c += bloom * u_bloom;
  c = aces(c);
  vec2 v = v_uv - 0.5;
  c *= 1.0 - dot(v, v) * 0.45;
  c = pow(c, vec3(1.0 / 2.2));
  c += (fract(sin(dot(gl_FragCoord.xy + fract(u_time) * 17.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  outColor = vec4(c, 1.0);
}`;

export interface Post {
  /** Bind the HDR scene target to draw into, sized for this frame; null when HDR is unavailable. */
  begin(width: number, height: number): boolean;
  /** Bloom and composite onto the canvas. */
  finish(time: number, strength: number): void;
  dispose(): void;
}

export function createPost(gl: WebGL2RenderingContext): Post | null {
  if (!gl.getExtension('EXT_color_buffer_float')) return null;
  let down: Program;
  let composite: Program;
  try {
    down = compile(gl, FULLSCREEN_VERTEX, DOWN);
    composite = compile(gl, FULLSCREEN_VERTEX, COMPOSITE);
  } catch (error) {
    console.warn('[mega] post', error);
    return null;
  }
  let scene: Target | null = null;
  let chain: Target[] = [];

  const release = () => {
    deleteTarget(gl, scene);
    for (const target of chain) deleteTarget(gl, target);
    scene = null;
    chain = [];
  };

  return {
    begin(width, height) {
      if (!scene || scene.width !== width || scene.height !== height) {
        release();
        scene = createTarget(gl, true, width, height);
        let w = width;
        let h = height;
        for (let level = 0; level < 4; level++) {
          w = Math.max(1, w >> 1);
          h = Math.max(1, h >> 1);
          chain.push(createTarget(gl, true, w, h));
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.framebuffer);
      gl.viewport(0, 0, width, height);
      return true;
    },
    finish(time, strength) {
      if (!scene) return;
      gl.useProgram(down.program);
      let source = scene;
      chain.forEach((target, level) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        gl.viewport(0, 0, target.width, target.height);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source.texture);
        gl.uniform1i(down.uniform('u_src'), 0);
        gl.uniform2f(down.uniform('u_texel'), 1 / source.width, 1 / source.height);
        gl.uniform1f(down.uniform('u_threshold'), level === 0 ? 0.9 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        source = target;
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, scene.width, scene.height);
      gl.useProgram(composite.program);
      const textures = [scene, ...chain];
      ['u_scene', 'u_b1', 'u_b2', 'u_b3', 'u_b4'].forEach((name, unit) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, textures[unit].texture);
        gl.uniform1i(composite.uniform(name), unit);
      });
      gl.uniform1f(composite.uniform('u_time'), time);
      gl.uniform1f(composite.uniform('u_bloom'), strength);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      release();
      gl.deleteProgram(down.program);
      gl.deleteProgram(composite.program);
    },
  };
}
