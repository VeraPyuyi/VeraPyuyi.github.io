/**
 * About — a matter decompressor built around a black hole. Light bends around the hole and its
 * accretion disk; a great arc of emitters holds open a stream that lifts matter off the horizon
 * and carries it to a collector — the stream is made of the words about me.
 */

import { glow, PALETTE, rgba } from '../kit';
import { SDF_KIT } from './prelude';
import type { Mega3D, Vec3 } from './types';

const ARC_R = 6.4;
const ARC_TILT = 0.5;

/** The matter stream: from just above the horizon, up and over to the collector on the arc. */
function streamPoint(t: number): Vec3 {
  const start: Vec3 = [0.4, 1.6, 0];
  const bend: Vec3 = [-1.5, 6.5, 1.5];
  // The collector sits at the end of the arc (2.95 rad in the arc's own plane, tilted towards us).
  const qx = Math.cos(2.95) * ARC_R;
  const qy = Math.sin(2.95) * ARC_R;
  const end: Vec3 = [qx, Math.cos(ARC_TILT) * qy, Math.sin(ARC_TILT) * qy];
  const k = (a: number, b: number, c: number) => (1 - t) ** 2 * a + 2 * (1 - t) * t * b + t * t * c;
  return [k(start[0], bend[0], end[0]), k(start[1], bend[1], end[1]), k(start[2], bend[2], end[2])];
}

export const decompressor3d: Mega3D = {
  camera: { distance: 38, pitch: 0.1, yaw: 0.0, extent: 8.5, sway: 0.05 },
  nebula: [
    [0.45, 0.25, 0.2],
    [0.2, 0.22, 0.55],
  ],
  exposure: 1.0,
  ships(time) {
    return [
      {
        kind: 'titan',
        position: [9.5, -2.2 + Math.sin(time * 0.4) * 0.15, 4],
        heading: [-1, 0.05, -0.3],
        length: 3.4,
        color: '#b8e6fe',
        alpha: 1,
      },
    ];
  },
  overlay({ ctx, time, items, project }) {
    const source = items[0]?.title ?? 'Pyuyi';
    const cjk = /[一-鿿]/.test(source);
    const words = (cjk ? [...source] : source.split(/\s+/)).filter((part) => part.trim());
    // Motes of matter riding the stream.
    for (let mote = 0; mote < 46; mote++) {
      const t = (time * 0.05 + mote / 46) % 1;
      const at = project(streamPoint(t));
      if (at) glow(ctx, at.x, at.y, 5, PALETTE.amber, 0.7 * Math.sin(t * Math.PI));
    }
    // The words, leaving the horizon one after another so the sentence reads on along the stream.
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = '500 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const slots = cjk ? 18 : 8;
    const head = (time * 0.05 + 1) * slots;
    for (let n = Math.floor(head - slots) + 1; n <= Math.floor(head); n++) {
      if (n < 0 || !words.length) continue;
      const t = (head - n) / slots;
      const at = project(streamPoint(t));
      if (!at) continue;
      ctx.fillStyle = rgba(PALETTE.white, 0.9 * Math.sin(t * Math.PI));
      ctx.fillText(words[n % words.length], at.x, at.y - 12);
    }
    ctx.globalCompositeOperation = 'lighter';
  },
  fragment: /* glsl */ `
${SDF_KIT}
const float R_IN = 2.6;
const float R_OUT = 12.0;
const float BOUND = 22.0;
const float ARC_R = ${ARC_R};
const vec3 SUN = normalize(vec3(-0.4, 0.3, 0.85));

// The arc of the decompressor stands in the plane z = 0, tilted towards the camera.
mat3 arcFrame() { return rotX(-${ARC_TILT}); }

// id: 1 arc, 2 emitters, 3 collector
float map(vec3 p, out float id) {
  vec3 q = arcFrame() * p;
  // Torus in the xy plane, kept to the upper sweep of the arc.
  float a = atan(q.y, q.x);
  float keep = max(0.25 - a, a - 2.95);
  float tube = length(vec2(length(q.xy) - ARC_R, q.z)) - 0.22 - 0.03 * plateRelief(vec2(a / TAU * 260.0, atan(q.z, length(q.xy) - ARC_R) / TAU * 10.0));
  float arc = max(tube, keep * ARC_R * 0.5);
  float rail = max(length(vec2(length(q.xy) - ARC_R - 0.5, q.z)) - 0.07, keep * ARC_R * 0.5);
  // Emitters every 0.3 rad pointing at the hole.
  float sector = 0.3;
  float ar = mod(a + sector * 0.5, sector) - sector * 0.5;
  vec2 e = vec2(cos(ar), sin(ar)) * length(q.xy);
  float emit = max(sdCapsule(vec3(e, q.z), vec3(ARC_R - 1.1, 0.0, 0.0), vec3(ARC_R, 0.0, 0.0), 0.09), keep * ARC_R * 0.5);
  vec3 c = q - vec3(cos(2.95), sin(2.95), 0.0) * ARC_R;
  float collector = length(c) - 0.6;
  float d = min(arc, rail);
  id = 1.0;
  if (emit < d) { d = emit; id = 2.0; }
  if (collector < d) { d = collector; id = 3.0; }
  return d;
}

vec4 disk(vec3 p, vec3 dir) {
  float r = length(p.xz);
  float theta = atan(p.z, p.x);
  float sweep = 6.0 * 6.5 / pow(r, 1.5);
  float phase = fract(u_time / 6.0);
  float weight = 1.0 - abs(2.0 * phase - 1.0);
  float a1 = theta - sweep * phase;
  float a2 = theta - sweep * fract(phase + 0.5) + 2.1;
  float streaks = mix(fbm(vec3(cos(a2) * 2.2, sin(a2) * 2.2, r * 3.2 + 5.0)), fbm(vec3(cos(a1) * 2.2, sin(a1) * 2.2, r * 3.2)), weight);
  streaks = clamp((streaks - 0.5) * 1.5 + 0.5, 0.0, 1.0);
  float t = clamp((r - R_IN) / (R_OUT - R_IN), 0.0, 1.0);
  float profile = smoothstep(R_IN * 0.96, R_IN * 1.25, r) * (1.0 - smoothstep(0.5, 1.0, t)) * pow(R_IN / r, 1.5);
  float density = profile * (0.3 + 1.3 * streaks);
  vec3 color = mix(vec3(1.0, 0.94, 0.84), vec3(1.0, 0.6, 0.26), smoothstep(0.0, 0.4, t));
  color = mix(color, vec3(0.75, 0.25, 0.1), smoothstep(0.4, 1.0, t));
  vec3 orbit = normalize(vec3(-p.z, 0.0, p.x));
  float beta = clamp(0.62 / sqrt(r), 0.0, 0.6);
  float g = sqrt(1.0 - beta * beta) / (1.0 - beta * dot(orbit, -dir));
  return vec4(color * density * 2.2 * mix(1.0, g * g * g, 0.6), clamp(density * 1.8, 0.0, 0.97));
}

vec3 render(vec3 ro, vec3 rd, vec2 px) {
  // The structure, with straight rays: it stands far enough out for the bending not to show.
  float id;
  float ts = march(ro, rd, length(ro) - 9.0, length(ro) + 9.0, id);
  vec3 structure = vec3(0.0);
  if (ts > 0.0) {
    vec3 p = ro + rd * ts;
    vec3 n = normalAt(p);
    vec3 base = id == 3.0 ? vec3(0.25, 0.25, 0.28) : id == 2.0 ? vec3(0.2, 0.2, 0.22) : vec3(0.16, 0.16, 0.18);
    vec3 q = arcFrame() * p;
    base *= plates(vec2(atan(q.y, q.x) * 40.0, q.z * 3.0));
    // Lit by the disk below as much as by the distant sun.
    float diskLight = max(dot(n, normalize(-p)), 0.0) * 2.5 / (1.0 + dot(p, p) * 0.02);
    structure = hull(n, rd, SUN, base, 0.5, 1.0, 1.0) * 0.6 + base * vec3(1.0, 0.6, 0.3) * diskLight;
    if (id == 2.0) structure += vec3(0.5, 0.8, 1.0) * (0.6 + 0.4 * sin(u_time * 2.4 - atan(q.y, q.x) * 8.0)) * smoothstep(ARC_R - 0.9, ARC_R - 1.1, length(q.xy)) * 3.0;
    if (id == 3.0) structure += vec3(0.5, 0.8, 1.0) * 0.6;
  }
  // The black hole: bend the ray step by step around it.
  vec3 pos = ro;
  vec3 vel = rd;
  float b = dot(pos, vel);
  float disc = b * b - (dot(pos, pos) - BOUND * BOUND);
  vec3 color = vec3(0.0);
  float alpha = 0.0;
  bool captured = false;
  float h2 = 1e6;
  if (disc > 0.0 && -b + sqrt(disc) > 0.0) {
    pos += vel * max(0.0, -b - sqrt(disc));
    vec3 momentum = cross(pos, vel);
    h2 = dot(momentum, momentum);
    for (int i = 0; i < 160; i++) {
      float r2 = dot(pos, pos);
      if (r2 < 1.0) {
        captured = true;
        break;
      }
      if (r2 > BOUND * BOUND * 1.01 && dot(pos, vel) > 0.0) break;
      float r = sqrt(r2);
      float dt = clamp(0.1 * (r - 0.9) * r, 0.015, 1.2);
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
  }
  vec3 dir = normalize(vel);
  float graze = 0.25 + 0.75 * smoothstep(2.6, 2.9, sqrt(h2));
  float bent = 1.0 - smoothstep(9.0, 16.0, sqrt(h2));
  vec3 sky = captured ? vec3(0.0) : (nebula(dir) + stars(dir)) * graze + galaxySprite(px) * (1.0 - bent);
  vec3 lensed = color + (1.0 - alpha) * sky;
  if (ts < 0.0) return lensed;
  // In front of the hole the structure covers it; behind, the disk glows over it.
  return ts < length(ro) ? structure : color + (1.0 - alpha) * structure;
}
`,
};
