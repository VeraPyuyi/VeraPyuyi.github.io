/**
 * All posts — a sentry array: a listening spire with great dishes turned outward, standing over a
 * gas giant. Its pulse sweeps out across the sector; every post is a contact that flares as the
 * pulse passes.
 */

import { hashUnit } from '@/lib/megastructures';
import { glow, PALETTE, rgba } from '../kit';
import { PLANET_KIT, SDF_KIT } from './prelude';
import type { Mega3D, ShipPose, Vec3 } from './types';

const PULSE_PERIOD = 6;
const PULSE_REACH = 3.2;

function contact(index: number, count: number): Vec3 {
  const angle = hashUnit(`contact${index}`) * Math.PI * 2;
  const radius = 1.2 + 1.0 * (count > 1 ? index / (count - 1) : 0.5);
  return [Math.cos(angle) * radius, (hashUnit(`h${index}`) - 0.5) * 0.7, Math.sin(angle) * radius];
}

function titanRun(time: number, delay: number, offset: Vec3): ShipPose | null {
  const local = (time + delay) % 46;
  const t = local / 34;
  if (t > 1) return null;
  const from: Vec3 = [-3.6, 0.55, 1.7];
  const to: Vec3 = [3.2, 0.25, 0.9];
  const position: Vec3 = [
    from[0] + (to[0] - from[0]) * t + offset[0],
    from[1] + (to[1] - from[1]) * t + offset[1],
    from[2] + (to[2] - from[2]) * t + offset[2],
  ];
  return {
    kind: 'titan',
    position,
    heading: [to[0] - from[0], to[1] - from[1], to[2] - from[2]],
    length: 0.5,
    color: '#b8e6fe',
    alpha: Math.min(1, t * 10, (1 - t) * 10),
  };
}

export const sentry3d: Mega3D = {
  camera: { distance: 5.4, pitch: 0.2, yaw: 0.35, extent: 1.45 },
  nebula: [
    [0.2, 0.3, 0.6],
    [0.5, 0.25, 0.35],
  ],
  marker: (index, count) => contact(index, count),
  ships(time) {
    const titan = titanRun(time, 0, [0, 0, 0]);
    if (!titan) return [];
    const escort = (offset: Vec3): ShipPose => ({
      ...titan,
      kind: 'corvette',
      length: 0.09,
      position: [titan.position[0] + offset[0], titan.position[1] + offset[1], titan.position[2] + offset[2]],
    });
    return [titan, escort([-0.45, 0.12, 0.25]), escort([-0.55, -0.1, -0.2]), escort([-0.75, 0.05, 0.05])];
  },
  overlay({ ctx, time, items, project }) {
    // The pulse: a ring of light racing out across the sector plane.
    const phase = (time % PULSE_PERIOD) / PULSE_PERIOD;
    const radius = 0.3 + phase * PULSE_REACH;
    ctx.beginPath();
    for (let step = 0; step <= 96; step++) {
      const a = (step / 96) * Math.PI * 2;
      const at = project([Math.cos(a) * radius, 0, Math.sin(a) * radius]);
      if (!at) continue;
      if (step === 0) ctx.moveTo(at.x, at.y);
      else ctx.lineTo(at.x, at.y);
    }
    const fade = (1 - phase) ** 1.5;
    ctx.strokeStyle = rgba(PALETTE.sky, 0.18 * fade);
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = rgba(PALETTE.sky, 0.55 * fade);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    items.forEach((item, index) => {
      const world = contact(index, items.length);
      const at = project(world);
      if (!at) return;
      const distance = Math.hypot(world[0], world[2]);
      const since = (radius - distance) / PULSE_REACH;
      const flare = since >= 0 ? Math.exp(-since * 10) : 0;
      glow(ctx, at.x, at.y, 6 + 26 * flare, item.color ?? PALETTE.sky, 0.25 + 0.75 * flare);
    });
  },
  fragment: /* glsl */ `
${SDF_KIT}
${PLANET_KIT}
const vec3 SUN = normalize(vec3(-0.7, 0.45, 0.55));
const vec3 GIANT_C = vec3(4.0, -4.6, -6.0);
const float GIANT_R = 3.6;

mat3 toLocal() { return rotY(-u_time * 0.04); }

float dish(vec3 q) {
  // A parabolic-looking cap opening towards +x, vertex at the origin.
  float R = 0.5;
  float shell = abs(length(q - vec3(R, 0.0, 0.0)) - R) - 0.012;
  float cap = max(shell, q.x - 0.13);
  float horn = sdCapsule(q, vec3(0.0), vec3(0.36, 0.0, 0.0), 0.009);
  return min(cap, horn);
}

// id: 1 spire and core, 2 rings and arms, 3 dishes
float map(vec3 p, out float id) {
  float spire = sdCapsule(p, vec3(0.0, -1.05, 0.0), vec3(0.0, 1.05, 0.0), 0.045);
  vec3 h = foldY(p, 6.0);
  float core = max(sdBox(h, vec3(0.22, 0.17, 0.13)), length(p.xz) - 0.23) - 0.004 * plateRelief(vec2(atan(p.z, p.x) / TAU * 36.0, p.y * 30.0));
  float pods = sdCapsule(foldY(p, 3.0), vec3(0.0, 0.62, 0.0), vec3(0.16, 0.5, 0.0), 0.05);
  float body = min(min(spire, core), pods);
  float rings = min(sdTorus(p - vec3(0.0, 0.38, 0.0), 0.5, 0.022), sdTorus(p + vec3(0.0, 0.38, 0.0), 0.5, 0.022));
  rings = min(rings, sdTorus(p, 0.86, 0.016));
  vec3 a = foldY(p, 3.0);
  float arms = sdCapsule(a, vec3(0.2, 0.0, 0.0), vec3(0.86, 0.0, 0.0), 0.028);
  float struts = sdCapsule(a, vec3(0.0, 0.38, 0.0), vec3(0.5, 0.38, 0.0), 0.012);
  struts = min(struts, sdCapsule(a, vec3(0.0, -0.38, 0.0), vec3(0.5, -0.38, 0.0), 0.012));
  float frame = min(min(rings, arms), struts);
  float dishes = dish(a - vec3(0.9, 0.0, 0.0));
  float d = body;
  id = 1.0;
  if (frame < d) { d = frame; id = 2.0; }
  if (dishes < d) { d = dishes; id = 3.0; }
  return d;
}

vec3 render(vec3 ro, vec3 rd, vec2 px) {
  float giantT;
  vec3 color = planetAt(ro, rd, GIANT_C, GIANT_R, SUN, false, space(rd, px), giantT);
  mat3 M = toLocal();
  vec3 lro = M * ro;
  vec3 lrd = M * rd;
  // Glow of the dish feeds and the spire beacons, behind and in front of the hull alike.
  vec3 glows = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float a = float(k) * TAU / 3.0;
    vec3 feed = vec3(cos(a), 0.0, sin(a)) * 1.26;
    glows += glowAt(lro, lrd, feed, vec3(0.5, 0.8, 1.0), 0.02) * (0.6 + 0.4 * sin(u_time * 2.0 + float(k)));
  }
  float blink = step(0.7, fract(u_time * 0.6));
  glows += glowAt(lro, lrd, vec3(0.0, 1.1, 0.0), vec3(1.0, 0.3, 0.25), 0.02) * blink;
  glows += glowAt(lro, lrd, vec3(0.0, -1.1, 0.0), vec3(1.0, 0.3, 0.25), 0.02) * blink;
  vec2 bound = sphereHits(lro, lrd, vec3(0.0), 1.45);
  if (bound.y < 0.0) return color + glows;
  float id;
  float t = march(lro, lrd, bound.x, bound.y, id);
  if (t < 0.0) return color + glows;
  vec3 lp = lro + lrd * t;
  vec3 ln = normalAt(lp);
  vec3 n = transpose(M) * ln;
  vec3 base = id == 3.0 ? vec3(0.2, 0.205, 0.22) : id == 2.0 ? vec3(0.08, 0.085, 0.095) : vec3(0.11, 0.11, 0.125);
  float ang = atan(lp.z, lp.x);
  base *= plates(vec2(ang * 12.0, lp.y * 14.0));
  vec3 lit = hull(n, rd, SUN, base, id == 3.0 ? 0.8 : 0.4, shadowRay(lp + ln * 0.004, M * SUN), occlusion(lp, ln));
  // Windows round the core.
  if (id == 1.0 && abs(lp.y) < 0.14 && length(lp.xz) > 0.12) {
    vec2 w = vec2(ang * 30.0, lp.y * 40.0);
    float pane = step(0.75, hash2(floor(w))) * step(0.3, fract(w.x)) * step(0.35, fract(w.y)) * step(fract(w.y), 0.7);
    lit += vec3(1.0, 0.75, 0.45) * pane * 0.9;
  }
  // Running lights along rings and arms.
  if (id == 2.0) lit += vec3(0.6, 0.85, 1.0) * step(0.93, fract(ang * 40.0 / TAU)) * (0.5 + 0.5 * sin(u_time * 3.0 - ang * 6.0)) * 1.5;
  return lit + glows * 0.4;
}
`,
};
