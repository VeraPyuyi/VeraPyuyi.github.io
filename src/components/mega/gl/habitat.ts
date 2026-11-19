/**
 * Moments — a rotating torus habitat in orbit over a blue planet. Sunlight rakes its hull; the
 * glass roof of the ring shows the green world inside, and rows of windows light up along the
 * rim. Each recorded day is one window burning gold.
 */

import { rotY } from './fib';
import { PLANET_KIT, SDF_KIT } from './prelude';
import type { Mega3D, ShipPose, Vec3 } from './types';

const TILT = 0.95;
const SPIN = 0.07;
const MAJOR = 1.0;
const WINDOWS = 96;

const rotX = (v: Vec3, a: number): Vec3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
};
const toWorld = (v: Vec3, time: number) => rotX(rotY(v, time * SPIN), TILT);
const windowOf = (index: number) => (index * 37 + 11) % WINDOWS;

export const habitat3d: Mega3D = {
  camera: { distance: 4.2, pitch: 0.16, yaw: 0.25, extent: 1.15 },
  nebula: [
    [0.2, 0.35, 0.65],
    [0.45, 0.25, 0.55],
  ],
  itemData: (index) => [windowOf(index), 0, 0, 0],
  marker(index, _count, time, camera) {
    const angle = ((windowOf(index) + 0.5) / WINDOWS) * Math.PI * 2;
    const local: Vec3 = [Math.cos(angle) * (MAJOR + 0.14), 0, Math.sin(angle) * (MAJOR + 0.14)];
    const world = toWorld(local, time);
    const normal = toWorld([Math.cos(angle), 0, Math.sin(angle)], time);
    const view: Vec3 = [camera.eye[0] - world[0], camera.eye[1] - world[1], camera.eye[2] - world[2]];
    return normal[0] * view[0] + normal[1] * view[1] + normal[2] * view[2] > 0.3 ? world : null;
  },
  ships(time) {
    const axis = toWorld([0, 1, 0], 0);
    const ships: ShipPose[] = [];
    for (let k = 0; k < 2; k++) {
      const t = ((time + k * 7) % 14) / 14;
      const out = k === 1;
      const d = out ? 0.25 + t * 2.4 : 2.65 - t * 2.4;
      const position: Vec3 = [axis[0] * d, axis[1] * d, axis[2] * d];
      const sign = out ? 1 : -1;
      ships.push({
        kind: 'transport',
        position,
        heading: [axis[0] * sign, axis[1] * sign, axis[2] * sign],
        length: 0.09,
        color: out ? '#b8e6fe' : '#ffd27a',
        alpha: Math.min(1, t * 6, (1 - t) * 6),
      });
    }
    return ships;
  },
  fragment: /* glsl */ `
${SDF_KIT}
${PLANET_KIT}
const float TILT = ${TILT};
const float MAJOR = ${MAJOR.toFixed(2)};
const float MINOR = 0.14;
const float WINDOWS = ${WINDOWS}.0;
const vec3 SUN = normalize(vec3(-0.75, 0.5, 0.45));
const vec3 PLANET_C = vec3(1.7, -2.3, -2.6);
const float PLANET_R = 2.5;

mat3 toLocal() { return rotY(-u_time * ${SPIN}) * rotX(-TILT); }

// Distance to the habitat in its own frame; id: 1 ring, 2 spokes, 3 hub.
float map(vec3 p, out float id) {
  float ring = sdTorus(p, MAJOR, MINOR) - 0.005 * torusRelief(p, MAJOR, 160.0, 14.0);
  vec3 sp = foldY(p, 6.0);
  float spokes = sdCapsule(sp, vec3(0.1, 0.0, 0.0), vec3(MAJOR - 0.1, 0.0, 0.0), 0.022);
  float hub = min(length(p) - 0.13, sdCapsule(p, vec3(0.0, -0.42, 0.0), vec3(0.0, 0.42, 0.0), 0.035));
  float d = ring;
  id = 1.0;
  if (spokes < d) { d = spokes; id = 2.0; }
  if (hub < d) { d = hub; id = 3.0; }
  return d;
}

vec3 hullColor(vec3 p, vec3 n, vec3 rd, float id, vec3 lp, vec3 ln, float shadow, float ao) {
  float diffuse = max(dot(n, SUN), 0.0) * shadow;
  vec3 refl = reflect(rd, n);
  float spec = pow(max(dot(refl, SUN), 0.0), 40.0) * shadow;
  // Bounce light from the planet below.
  float bounce = max(dot(n, normalize(PLANET_C - p)), 0.0) * 0.12;
  vec3 base = id == 1.0 ? vec3(0.24, 0.245, 0.27) : vec3(0.16, 0.17, 0.19);
  float a = atan(lp.z, lp.x);
  float ribs = smoothstep(0.85, 1.0, abs(cos(a * 48.0)));
  base *= 0.75 + 0.25 * hash2(floor(vec2(a * 160.0, atan(lp.y, length(lp.xz) - MAJOR) * 12.0)));
  base *= 1.0 - ribs * 0.35;
  vec3 color = base * (diffuse * vec3(1.0, 0.94, 0.86) * 1.2 + vec3(0.3, 0.5, 0.9) * bounce * ao + 0.01 * ao) + spec * 0.9;
  color += nebula(refl) * 0.25 * ao;
  if (id != 1.0) return color;
  // Across the tube: theta = 0 at the outer rim, PI/2 on the roof.
  float theta = atan(lp.y, length(lp.xz) - MAJOR);
  // Glass roof: the green interior lit by mirrored sunlight.
  float roof = smoothstep(0.55, 0.75, theta) * smoothstep(1.55, 1.3, theta);
  if (roof > 0.0) {
    vec3 inside = mix(vec3(0.08, 0.22, 0.08), vec3(0.25, 0.3, 0.18), fbm(vec3(a * 20.0, theta * 6.0, 1.0)));
    inside *= 0.6 + 0.6 * diffuse;
    inside += vec3(1.0, 0.75, 0.4) * step(0.94, hash2(floor(vec2(a * 300.0, theta * 30.0)))) * 0.8;
    color = mix(color, inside + spec * 2.0 + vec3(0.2, 0.35, 0.6) * pow(1.0 - abs(dot(n, rd)), 3.0) * 0.6, roof);
  }
  // Windows in three rows along the outer rim.
  float rowf = theta * 9.0;
  if (abs(rowf) < 1.5) {
    float cellA = floor(a / TAU * WINDOWS * 4.0);
    vec2 f = vec2(fract(a / TAU * WINDOWS * 4.0), fract(rowf + 0.5));
    float pane = step(0.2, f.x) * step(f.x, 0.8) * step(0.25, f.y) * step(f.y, 0.75);
    float row = floor(rowf + 0.5);
    float lit = step(0.55, hash2(vec2(cellA, row) + floor(u_time * 0.05 + hash2(vec2(row, cellA)) * 3.0)));
    color += vec3(1.0, 0.72, 0.42) * pane * lit * (0.5 + 0.8 * (1.0 - diffuse));
    // A recorded day: a whole window bay burning gold.
    float bay = floor(a / TAU * WINDOWS);
    if (bay < 0.0) bay += WINDOWS;
    for (int k = 0; k < 32; k++) {
      if (k >= u_count) break;
      if (abs(u_items[k].x - bay) < 0.5 && abs(row) < 0.5) {
        float focus = k == u_focus ? 1.0 : 0.0;
        color += vec3(1.0, 0.8, 0.4) * (2.5 + 6.0 * focus) * (0.6 + 0.4 * pane);
      }
    }
  }
  return color;
}

vec3 render(vec3 ro, vec3 rd, vec2 px) {
  float planetT;
  vec3 color = planetAt(ro, rd, PLANET_C, PLANET_R, SUN, true, space(rd, px), planetT);
  mat3 M = toLocal();
  vec2 bound = sphereHits(ro, rd, vec3(0.0), MAJOR + MINOR + 0.05);
  if (bound.y < 0.0) return color;
  float id = 0.0;
  float t = march(M * ro, M * rd, bound.x, bound.y, id);
  if (t < 0.0) return color;
  vec3 wp = ro + rd * t;
  vec3 lp = M * wp;
  vec3 ln = normalAt(lp);
  vec3 n = transpose(M) * ln;
  float shadow = shadowRay(lp + ln * 0.004, M * SUN);
  vec3 lit = hullColor(wp, n, rd, id, lp, ln, shadow, occlusion(lp, ln));
  // Hub beacon.
  return lit + (id == 3.0 ? vec3(0.6, 0.85, 1.0) * step(0.6, fract(u_time * 0.5)) * 0.3 : vec3(0.0));
}
`,
};
