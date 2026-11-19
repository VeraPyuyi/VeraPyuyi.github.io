/**
 * Friends — a gateway: a ring of clamps holding open a swirling passage. Through it lies someone
 * else's universe, its sky tinted by whichever friend you look at. Each friend is a beacon on the
 * rim; a Titan and its escorts sail in and through.
 */

import { SDF_KIT } from './prelude';
import type { Mega3D, ShipPose, Vec3 } from './types';

const RADIUS = 1.0;
const FACING = 0.55;

/** The gate stands upright, turned towards the camera's side by FACING about y. */
const toWorld = (v: Vec3): Vec3 => {
  const c = Math.cos(FACING);
  const s = Math.sin(FACING);
  return [c * v[0] - s * v[2], v[1], s * v[0] + c * v[2]];
};
const beaconAngle = (index: number, count: number) => Math.PI / 2 - ((index + 0.5) / Math.max(count, 1)) * Math.PI * 2;

export const gateway3d: Mega3D = {
  camera: { distance: 4.6, pitch: 0.12, yaw: 0.0, extent: 1.45, sway: 0.08 },
  nebula: [
    [0.25, 0.3, 0.65],
    [0.55, 0.3, 0.45],
  ],
  itemData: (index, count) => [beaconAngle(index, count), 0, 0, 0],
  marker: (index, count) => {
    const a = beaconAngle(index, count);
    return toWorld([Math.cos(a) * RADIUS * 1.13, Math.sin(a) * RADIUS * 1.13, 0]);
  },
  ships(time) {
    const t = (time % 20) / 13;
    if (t > 1) return [];
    const axis = toWorld([0, 0, 1]);
    const d = 3.2 * (1 - t);
    const shrink = t > 0.85 ? Math.max(0.05, 1 - (t - 0.85) / 0.15) : 1;
    const along = (k: number, side: Vec3): Vec3 => [
      axis[0] * (d + k) + side[0],
      axis[1] * (d + k) + side[1],
      axis[2] * (d + k) + side[2],
    ];
    const heading: Vec3 = [-axis[0], -axis[1], -axis[2]];
    const alpha = Math.min(1, t * 8);
    const ships: ShipPose[] = [
      {
        kind: 'titan',
        position: along(0, [0, -0.05, 0]),
        heading,
        length: 0.6 * shrink,
        color: '#b8e6fe',
        alpha: alpha * shrink,
      },
    ];
    for (const [k, side] of [
      [0.5, [0.35, 0.2, 0]],
      [0.6, [-0.35, -0.25, 0]],
      [0.8, [0.1, 0.35, 0]],
    ] as [number, Vec3][]) {
      const s = toWorld(side);
      ships.push({
        kind: 'corvette',
        position: along(k, s),
        heading,
        length: 0.09,
        color: '#b8e6fe',
        alpha: t < 0.95 ? alpha : 0,
      });
    }
    return ships;
  },
  fragment: /* glsl */ `
${SDF_KIT}
const float RADIUS = ${RADIUS.toFixed(2)};
const vec3 SUN = normalize(vec3(-0.6, 0.55, 0.6));

mat3 toLocal() { return rotY(-${FACING}); }

// The gate in its own frame: a ring in the xy plane. id: 1 ring, 2 clamps
float map(vec3 p, out float id) {
  float ring = length(vec2(length(p.xy) - RADIUS, p.z)) - 0.075 - 0.006 * plateRelief(vec2(atan(p.y, p.x) / TAU * 90.0, atan(p.z, length(p.xy) - RADIUS) / TAU * 10.0));
  float outer = length(vec2(length(p.xy) - RADIUS * 1.13, p.z * 0.6)) - 0.025;
  float sector = TAU / 8.0;
  float a = atan(p.y, p.x);
  float ar = mod(a + sector * 0.5, sector) - sector * 0.5;
  vec2 radial = vec2(cos(ar), sin(ar)) * length(p.xy);
  float clamp1 = sdBox(vec3(radial - vec2(RADIUS * 1.06, 0.0), p.z), vec3(0.16, 0.07, 0.15)) - 0.01;
  float d = min(ring, outer);
  id = 1.0;
  if (clamp1 < d) { d = clamp1; id = 2.0; }
  return d;
}

vec3 tint() {
  return u_focus >= 0 && u_focus < u_count ? u_colors[u_focus] * 1.4 + 0.05 : vec3(0.35, 0.6, 1.0);
}

// The surface of the passage: a slow vortex over another sky.
vec3 portal(vec2 q, vec3 rd) {
  float r = length(q) / RADIUS;
  float a = atan(q.y, q.x);
  float swirl = a + u_time * 0.35 + 2.4 / (r + 0.25);
  float flow = fbm(vec3(cos(swirl) * 2.0, sin(swirl) * 2.0, r * 3.0 - u_time * 0.25));
  vec3 c = tint();
  // The far universe: its own stars and clouds, warped by the vortex.
  vec3 farDir = normalize(rd + vec3(cos(swirl), sin(swirl), 0.0) * 0.15 * (1.0 - r));
  vec3 far = stars(farDir.zyx) * 1.5 + c * 0.35 * smoothstep(0.35, 0.8, fbm(farDir * 3.0 + 7.0));
  // Rings of the passage rushing inward give it depth.
  float tunnel = 0.5 + 0.5 * sin(log(r + 0.02) * 18.0 + u_time * 2.5);
  vec3 color = far + c * flow * flow * 0.45 * (0.2 + r) * (0.6 + 0.6 * tunnel);
  color += vec3(1.0) * exp(-r * 6.0) * 0.6;
  color += c * smoothstep(0.8, 1.0, r) * 1.4;
  return color;
}

vec3 render(vec3 ro, vec3 rd, vec2 px) {
  vec3 color = space(rd, px);
  mat3 M = toLocal();
  vec3 lro = M * ro;
  vec3 lrd = M * rd;
  // Halo of the gate on space around it.
  vec2 cp = rayPoint(lro, lrd, vec3(0.0));
  color += tint() * 0.12 * exp(-max(cp.x - RADIUS, 0.0) * 3.0);
  // The passage itself: the plane z = 0 inside the ring.
  float tp = -lro.z / lrd.z;
  vec3 planeHit = lro + lrd * tp;
  bool inPortal = tp > 0.0 && length(planeHit.xy) < RADIUS - 0.02;
  vec2 bound = sphereHits(lro, lrd, vec3(0.0), RADIUS * 1.35);
  float id;
  float t = bound.y < 0.0 ? -1.0 : march(lro, lrd, bound.x, bound.y, id);
  if (inPortal && (t < 0.0 || tp < t)) return portal(planeHit.xy, lrd);
  if (t < 0.0) return color;
  vec3 lp = lro + lrd * t;
  vec3 ln = normalAt(lp);
  vec3 n = transpose(M) * ln;
  float ang = atan(lp.y, lp.x);
  vec3 base = id == 2.0 ? vec3(0.13, 0.125, 0.12) : vec3(0.09, 0.09, 0.1);
  base *= plates(vec2(ang * 30.0, lp.z * 10.0));
  vec3 lit = hull(n, rd, SUN, base, 0.6, shadowRay(lp + ln * 0.004, M * SUN), occlusion(lp, ln));
  // The inner faces catch the passage's light.
  float inward = max(dot(ln, -normalize(vec3(lp.xy, 0.0))), 0.0);
  lit += base * tint() * inward * 2.5;
  // Beacons: one light on the rim per friend.
  for (int k = 0; k < 32; k++) {
    if (k >= u_count) break;
    float a = u_items[k].x;
    vec3 beacon = vec3(cos(a), sin(a), 0.0) * RADIUS * 1.13;
    float d = length(lp - beacon);
    float focus = k == u_focus ? 1.0 : 0.0;
    lit += u_colors[k] * exp(-d * 40.0) * (2.0 + 6.0 * focus);
  }
  return lit;
}
`,
};
