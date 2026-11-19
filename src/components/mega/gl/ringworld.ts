/**
 * Photo wall — a ring world around its star. The far side shows its inner face: oceans, land and
 * weather under a sky held in by rim walls, with shadow squares sweeping night across it. Each
 * album holds a stretch of the ring.
 */

import { rotY } from './fib';
import type { Mega3D, ShipPose } from './types';

const RADIUS = 1.6;
const SPIN = 0.025;

const segmentAngle = (index: number, count: number) => ((index + 0.5) / Math.max(count, 1)) * Math.PI * 2;

export const ringworld3d: Mega3D = {
  camera: { distance: 4.6, pitch: 0.3, yaw: 0.2, extent: 1.2, sway: 0.06 },
  nebula: [
    [0.25, 0.35, 0.75],
    [0.6, 0.3, 0.5],
  ],
  exposure: 1.05,
  itemData: (index, count) => [segmentAngle(index, count), 0, 0, 0],
  marker(index, count, time) {
    const angle = segmentAngle(index, count) + time * SPIN;
    return rotY([RADIUS, 0, 0], angle);
  },
  ships(time) {
    const ships: ShipPose[] = [];
    for (let k = 0; k < 3; k++) {
      const a = time * 0.06 + (k / 3) * Math.PI * 2;
      const r = RADIUS * 1.18;
      ships.push({
        kind: 'transport',
        position: [Math.cos(a) * r, 0.12 + k * 0.04, Math.sin(a) * r],
        heading: [-Math.sin(a), 0, Math.cos(a)],
        length: 0.07,
        color: '#ffd27a',
        alpha: 1,
      });
    }
    return ships;
  },
  fragment: /* glsl */ `
const float RING_R = ${RADIUS.toFixed(3)};
const float HALF_W = 0.1;
const float WALL = 0.018;
const float STAR_R = 0.16;
const vec3 HOT = vec3(1.0, 0.86, 0.66);

// Ray against the infinite cylinder x^2 + z^2 = r^2: both hits.
vec2 cylinder(vec3 ro, vec3 rd, float r) {
  float a = dot(rd.xz, rd.xz);
  float b = dot(ro.xz, rd.xz);
  float c = dot(ro.xz, ro.xz) - r * r;
  float h = b * b - a * c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h) / a;
}

int segmentOf(float angle) {
  if (u_count <= 0) return -1;
  return int(floor(fract(angle / TAU) * float(u_count)));
}

vec3 land(float angle, float y, vec3 rd, vec3 n) {
  // Surface coordinates: around the ring and across it.
  vec3 q = vec3(cos(angle) * 11.0, sin(angle) * 11.0, y * 70.0);
  float height = fbm(q + 3.0) + 0.35 * fbm(q * 3.0);
  float sea = smoothstep(0.62, 0.66, height);
  vec3 water = mix(vec3(0.02, 0.07, 0.2), vec3(0.04, 0.16, 0.32), fbm(q * 2.0));
  vec3 ground = mix(vec3(0.09, 0.2, 0.06), vec3(0.32, 0.27, 0.16), smoothstep(0.7, 0.95, height));
  ground = mix(ground, vec3(0.75), smoothstep(1.02, 1.1, height));
  vec3 albedo = mix(water, ground, sea);
  float cloud = smoothstep(0.55, 0.85, fbm(q * 1.4 + vec3(u_time * 0.05, 0.0, 0.0)));
  albedo = mix(albedo, vec3(0.9), cloud * 0.85);
  // Shadow squares orbit inside the ring and cast night in bands.
  float spin = u_time * ${SPIN};
  float day = smoothstep(-0.25, 0.25, cos((angle - spin * 3.0) * 4.0) + 0.35);
  vec3 sun = HOT * 1.5;
  vec3 color = albedo * sun * day;
  // Cities on the night side.
  float city = step(0.9, hash2(floor(vec2(angle * 400.0, y * 300.0)))) * sea * (1.0 - day);
  color += vec3(1.0, 0.7, 0.35) * city * 1.4;
  // Air held in by the walls: haze towards the horizon and along the edges.
  float graze = 1.0 - abs(dot(n, rd));
  vec3 air = vec3(0.35, 0.55, 1.0) * (0.25 + 0.75 * day);
  color = mix(color, air, clamp(pow(graze, 3.0) * 0.8 + smoothstep(HALF_W * 0.7, HALF_W, abs(y)) * 0.5, 0.0, 0.9));
  // Albums: the focused stretch glows.
  int seg = segmentOf(angle);
  if (seg >= 0 && seg == u_focus) color += vec3(1.0, 0.55, 0.75) * 0.35;
  return color;
}

vec3 hull(float angle, float y, vec3 n, vec3 rd) {
  vec3 refl = reflect(rd, n);
  vec3 env = nebula(refl) * 2.0;
  float plates = 0.7 + 0.3 * hash2(floor(vec2(angle * 160.0, y * 40.0)));
  float side = max(dot(n, normalize(vec3(-0.6, 0.5, 0.6))), 0.0);
  vec3 color = vec3(0.014, 0.014, 0.02) * plates * (0.4 + 1.2 * side) + env * 0.06;
  float rib = smoothstep(0.97, 1.0, abs(cos(angle * 120.0)));
  color += vec3(0.008, 0.009, 0.014) * rib;
  float light = step(0.985, hash2(floor(vec2(angle * 900.0, y * 160.0))));
  color += vec3(0.6, 0.8, 1.0) * light * (0.4 + 0.6 * step(0.5, fract(u_time * 0.5 + angle * 7.0)));
  int seg = segmentOf(angle);
  if (seg >= 0 && seg == u_focus) color += vec3(1.0, 0.55, 0.75) * 0.25;
  return color;
}

vec3 render(vec3 ro, vec3 rd, vec2 px) {
  float spin = u_time * ${SPIN};
  vec3 color = space(rd, px);
  vec2 sp = rayPoint(ro, rd, vec3(0.0));
  vec3 starLight = HOT * (2.5 * exp(-max(sp.x - STAR_R, 0.0) * 18.0) + 0.6 * exp(-max(sp.x - STAR_R, 0.0) * 4.0));
  vec2 star = sphereHits(ro, rd, vec3(0.0), STAR_R);
  float starT = star.x > 0.0 ? star.x : 1e9;

  vec2 outer = cylinder(ro, rd, RING_R + WALL);
  vec2 inner = cylinder(ro, rd, RING_R);
  // Far side first (seen from inside), then the star, then the near side's hull on top.
  float tFar = inner.y;
  float yFar = ro.y + rd.y * tFar;
  if (tFar > 0.0 && abs(yFar) < HALF_W) {
    vec3 p = ro + rd * tFar;
    float angle = atan(p.z, p.x) - spin;
    vec3 n = -normalize(vec3(p.x, 0.0, p.z));
    color = land(angle, yFar, rd, n);
  } else if (tFar > 0.0 && abs(yFar) < HALF_W + 0.012) {
    // The rim walls, lit on their inner faces.
    color = vec3(0.12, 0.12, 0.15) + HOT * 0.3 * smoothstep(HALF_W + 0.012, HALF_W, abs(yFar));
  }
  if (starT < tFar || tFar < 0.0) {
    if (star.x > 0.0) color = starSurface(normalize(ro + rd * star.x), rd, HOT, u_time);
  }
  if (starT > sp.y || star.x < 0.0) color += starLight;
  float tNear = outer.x;
  float yNear = ro.y + rd.y * tNear;
  if (tNear > 0.0 && abs(yNear) < HALF_W + 0.012 && tNear < starT) {
    vec3 p = ro + rd * tNear;
    float angle = atan(p.z, p.x) - spin;
    vec3 n = normalize(vec3(p.x, 0.0, p.z));
    color = hull(angle, yNear, n, rd);
    // The upper rim edge catches the sun.
    color += HOT * 0.6 * smoothstep(HALF_W + 0.004, HALF_W + 0.012, yNear);
  }
  return color;
}
`,
};
