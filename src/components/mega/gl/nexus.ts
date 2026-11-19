/**
 * Papers — a science nexus: a caged energy core inside turning gyroscope rings, with long arms
 * reaching out to laboratory modules, one module per paper. Science vessels survey in wide orbits.
 */

import { rotY } from './fib';
import { SDF_KIT } from './prelude';
import type { Mega3D, ShipPose, Vec3 } from './types';

const SPIN = 0.05;
const REACH = 1.05;
const slots = (count: number) => Math.max(3, count);
const armAngle = (index: number, count: number) => (index / slots(count)) * Math.PI * 2;

export const nexus3d: Mega3D = {
  camera: { distance: 4.6, pitch: 0.42, yaw: 0.3, extent: 1.2 },
  nebula: [
    [0.35, 0.22, 0.7],
    [0.15, 0.45, 0.65],
  ],
  exposure: 1.05,
  itemData: (index, count) => [armAngle(index, count), slots(count), 0, 0],
  marker(index, count, time) {
    return rotY([REACH + 0.1, 0.12, 0], armAngle(index, count) + time * SPIN);
  },
  ships(time) {
    const ships: ShipPose[] = [];
    for (let k = 0; k < 2; k++) {
      const a = time * 0.09 + k * Math.PI;
      const r = 1.9;
      const position: Vec3 = [Math.cos(a) * r, 0.35 * Math.sin(a * 2 + k), Math.sin(a) * r];
      ships.push({
        kind: 'science',
        position,
        heading: [-Math.sin(a), 0, Math.cos(a)],
        length: 0.13,
        color: '#b8e6fe',
        alpha: 1,
      });
    }
    return ships;
  },
  fragment: /* glsl */ `
${SDF_KIT}
const vec3 SUN = normalize(vec3(-0.6, 0.6, 0.5));
const float REACH = ${REACH};
const vec3 CORE = vec3(0.45, 0.75, 1.0);

// Arms turn with the station; the angle is measured the way the TypeScript markers are.
mat3 spinM() { return rotY(u_time * ${SPIN}); }

int armOf(vec3 p) {
  float slotCount = max(u_items[0].y, 3.0);
  float a = atan(p.z, p.x);
  if (a < 0.0) a += TAU;
  return int(mod(floor(a / TAU * slotCount + 0.5), slotCount));
}

// id: 1 cage and rings, 2 arms, 3 modules
float map(vec3 p, out float id) {
  float slotCount = max(u_items[0].y, 3.0);
  // Gyroscope rings, each tilted and turning on its own.
  vec3 r1 = rotX(0.9 + u_time * 0.21) * p;
  vec3 r2 = rotX(-0.6) * rotY(u_time * 0.13) * rotX(1.3) * p;
  float rings = min(sdTorus(r1, 0.46, 0.022), sdTorus(r2, 0.56, 0.02));
  rings = min(rings, sdTorus(p, 0.66, 0.035) - 0.004 * torusRelief(p, 0.66, 90.0, 8.0));
  float cage = abs(length(p) - 0.33) - 0.006;
  cage = max(cage, -(abs(fract(atan(p.z, p.x) * 6.0 / TAU) - 0.5) - 0.38) * 0.3);
  vec3 a = foldY(p, slotCount);
  float arms = sdCapsule(a, vec3(0.66, 0.0, 0.0), vec3(REACH, 0.0, 0.0), 0.026);
  arms = min(arms, sdCapsule(a, vec3(0.66, 0.06, 0.0), vec3(REACH - 0.05, 0.06, 0.0), 0.01));
  float module = sdBox(a - vec3(REACH + 0.07, 0.0, 0.0), vec3(0.08, 0.06, 0.13)) - 0.01;
  module = min(module, sdBox(a - vec3(REACH + 0.07, 0.0, 0.0), vec3(0.015, 0.012, 0.3)));
  float d = min(rings, cage);
  id = 1.0;
  if (arms < d) { d = arms; id = 2.0; }
  if (module < d) { d = module; id = 3.0; }
  return d;
}

vec3 coreGlow(vec3 ro, vec3 rd) {
  vec2 cp = rayPoint(ro, rd, vec3(0.0));
  float swirl = fbm(normalize(ro + rd * cp.y) * 3.0 + vec3(0.0, u_time * 0.3, 0.0));
  return CORE * (exp(-cp.x * 9.0) * (2.0 + 2.0 * swirl) + exp(-cp.x * 2.5) * 0.25);
}

vec3 render(vec3 ro, vec3 rd, vec2 px) {
  vec3 color = space(rd, px);
  mat3 M = transpose(spinM());
  vec3 lro = M * ro;
  vec3 lrd = M * rd;
  vec3 glow = coreGlow(lro, lrd);
  vec2 bound = sphereHits(lro, lrd, vec3(0.0), REACH + 0.45);
  if (bound.y < 0.0) return color + glow * 0.4;
  float id;
  float t = march(lro, lrd, bound.x, bound.y, id);
  vec2 cp = rayPoint(lro, lrd, vec3(0.0));
  bool coreInFront = t < 0.0 || cp.y < t;
  if (t < 0.0) return color + glow;
  vec3 lp = lro + lrd * t;
  vec3 ln = normalAt(lp);
  vec3 n = spinM() * ln;
  vec3 base = id == 3.0 ? vec3(0.12, 0.12, 0.13) : vec3(0.09, 0.095, 0.11);
  base *= plates(vec2(atan(lp.z, lp.x) * 14.0, lp.y * 18.0));
  vec3 lit = hull(n, rd, SUN, base, 0.6, shadowRay(lp + ln * 0.004, M * SUN), occlusion(lp, ln));
  // Light from the core falls on everything near it.
  float coreLight = max(dot(ln, normalize(-lp)), 0.0) / (1.0 + dot(lp, lp) * 6.0);
  lit += base * CORE * coreLight * 3.0;
  if (id == 3.0) {
    int arm = armOf(lp);
    bool paper = arm < u_count;
    vec3 a = foldY(lp, max(u_items[0].y, 3.0)) - vec3(REACH + 0.07, 0.0, 0.0);
    // Lab windows, gold where a paper lives.
    float pane = step(0.5, hash2(floor(vec2(a.z * 60.0, a.y * 30.0)))) * step(0.3, fract(a.z * 60.0));
    float focus = arm == u_focus ? 1.0 : 0.0;
    vec3 tint = paper ? vec3(1.0, 0.78, 0.4) : vec3(0.4, 0.6, 1.0);
    lit += tint * pane * (paper ? 1.4 + 3.0 * focus : 0.3) * step(abs(a.x), 0.09);
    if (paper) lit += vec3(1.0, 0.8, 0.45) * focus * 0.4;
  }
  float ang = atan(lp.z, lp.x);
  if (id == 1.0) lit += CORE * step(0.95, fract(ang * 60.0 / TAU)) * 1.2 * smoothstep(0.6, 0.7, length(lp.xz));
  if (id == 2.0) lit += vec3(1.0, 0.8, 0.5) * step(0.9, fract(length(lp.xz) * 30.0)) * 0.8;
  return lit + (coreInFront ? glow : glow * 0.15);
}
`,
};
