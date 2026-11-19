/**
 * Blogs — a Dyson sphere under construction. A plated shell closes around a star; along a band
 * still being built the shell gives way to its bare frame, latitude rings and meridian ribs black
 * against the light, the inner face of the far shell glowing in the star's heat. Polar hubs carry
 * radiator fins. Each post is a lit panel on the shell, ringed in its category colour.
 */

import { lerp3, rotY, scale } from './fib';
import { SDF_KIT } from './prelude';
import type { Mega3D, ShipPose, Vec3 } from './types';

const SPIN = 0.02;
const BAND_LAT = 0.2;

/** Where a post's panel sits on the shell: spread in longitude, kept off the open band and the poles. */
function itemDir(index: number): Vec3 {
  const t = (index * 0.618 + 0.13) % 1;
  const lat = t < 0.5 ? -0.85 + t * 1.3 : 0.55 + (t - 0.5) * 0.6;
  const lon = index * 2.39996 + 0.4;
  return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)];
}

export const dyson3d: Mega3D = {
  camera: { distance: 4.2, pitch: 0.22, yaw: 0.6, extent: 1.25 },
  nebula: [
    [0.45, 0.2, 0.38],
    [0.16, 0.22, 0.6],
  ],
  bloom: 0.16,
  itemData: (index) => [...itemDir(index), 0],
  marker(index, _count, time, camera) {
    const world = rotY(itemDir(index), time * SPIN);
    const facing = world[0] * camera.eye[0] + world[1] * camera.eye[1] + world[2] * camera.eye[2];
    return facing > 1.3 ? scale(world, 1.03) : null;
  },
  ships(time) {
    const ships: ShipPose[] = [];
    for (let k = 0; k < 2; k++) {
      const local = (time + k * 12) % 24;
      const t = local / 17;
      if (t > 1) continue;
      const lon = 0.6 + k * 0.5 + time * SPIN;
      const target: Vec3 = scale(
        [Math.cos(BAND_LAT) * Math.cos(lon), Math.sin(BAND_LAT), Math.cos(BAND_LAT) * Math.sin(lon)],
        1.06,
      );
      const from: Vec3 = k ? [2.6, -0.6, 2.2] : [-2.3, 1.0, 2.4];
      ships.push({
        kind: 'constructor',
        position: lerp3(from, target, 1 - (1 - t) ** 2),
        heading: [target[0] - from[0], target[1] - from[1], target[2] - from[2]],
        length: 0.07,
        color: '#ffd27a',
        alpha: Math.min(1, t * 8, (1 - t) * 8),
      });
    }
    return ships;
  },
  fragment: /* glsl */ `
${SDF_KIT}
const float STAR_R = 0.27;
const float BAND = ${BAND_LAT};
const vec3 HOT = vec3(1.0, 0.7, 0.4);
const vec3 KEY = normalize(vec3(-0.75, 0.55, 0.45));
const vec3 HOLE = normalize(vec3(-0.5, -0.55, 0.65));
const float HOLE_R = 0.1;

mat3 toLocal() { return rotY(-u_time * ${SPIN}); }

float bandWidth(float lon) {
  return 0.1 + 0.035 * sin(lon * 3.0 + 1.0) + 0.02 * sin(lon * 7.0);
}

vec2 shellUV(vec3 n) {
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float lon = atan(n.z, n.x);
  return vec2(lon / TAU * 96.0, lat / PI * 48.0);
}

// id: 1 shell, 2 frame, 3 polar hubs, 4 star
float map(vec3 p, out float id) {
  float r = length(p);
  vec3 n = p / max(r, 1e-4);
  float lat = asin(clamp(n.y, -1.0, 1.0));
  float lon = atan(n.z, n.x);
  vec2 uv = shellUV(n);
  float relief = plateRelief(uv) * 0.007 + plateRelief(uv * 3.0 + 5.0) * 0.0025;
  float shell = max(r - (1.012 + relief), 0.985 - r);
  // The open band, and a smaller opening on the lower side.
  float band = (abs(lat - BAND) - bandWidth(lon)) * r;
  shell = max(shell, -band);
  float holeAngle = acos(clamp(dot(n, HOLE), -1.0, 1.0));
  shell = max(shell, -(holeAngle - HOLE_R) * r);
  // Frame across the band: latitude rings at its edges and middle, meridian ribs between.
  float frame = 1e3;
  for (int k = -1; k <= 1; k++) {
    float l = BAND + float(k) * 0.12;
    frame = min(frame, length(vec2(length(p.xz) - cos(l), p.y - sin(l))) - (k == 0 ? 0.008 : 0.013));
  }
  vec3 q = foldY(p, 36.0);
  frame = min(frame, max(length(vec2(q.z, r - 0.995)) - 0.008, abs(lat - BAND) - 0.17));
  // A reinforced rim round the lower opening.
  frame = min(frame, length(vec2((holeAngle - HOLE_R) * r, r - 0.998)) - 0.012);
  // Polar hubs: a drum, radiator fins and a mast.
  vec3 a = vec3(p.x, abs(p.y), p.z);
  float hub = sdCapsule(a, vec3(0.0, 0.96, 0.0), vec3(0.0, 1.08, 0.0), 0.11);
  hub = min(hub, sdCapsule(a, vec3(0.0, 1.0, 0.0), vec3(0.0, 1.34, 0.0), 0.012));
  vec3 f = foldY(a, 10.0);
  hub = min(hub, sdBox(f - vec3(0.2, 1.02, 0.0), vec3(0.09, 0.006, 0.035)));
  float star = r - STAR_R;
  float d = shell;
  id = 1.0;
  if (frame < d) { d = frame; id = 2.0; }
  if (hub < d) { d = hub; id = 3.0; }
  if (star < d) { d = star; id = 4.0; }
  return d;
}

// How much of the star's light reaches p, marching towards the centre.
float starVisibility(vec3 p) {
  vec3 l = -normalize(p);
  float t = 0.01;
  float res = 1.0;
  float limit = length(p) - STAR_R - 0.02;
  for (int i = 0; i < 24; i++) {
    float id;
    float h = map(p + l * t, id);
    if (id == 4.0) break;
    res = min(res, 12.0 * h / t);
    t += clamp(h, 0.006, 0.12);
    if (res < 0.02 || t > limit) break;
  }
  return clamp(res, 0.0, 1.0);
}

vec3 shade(vec3 p, vec3 n, vec3 rd, float id, mat3 M) {
  float r = length(p);
  vec3 refl = reflect(rd, n);
  float ao = occlusion(p, n);
  // Starlight from the centre, falling off with distance, blocked by the shell.
  float starDiffuse = max(dot(n, -normalize(p)), 0.0);
  vec3 starLight = HOT * 3.2 / (r * r * 4.0 + 0.2);
  float vis = starDiffuse > 0.0 ? starVisibility(p + n * 0.004) : 0.0;
  // A cold key light from outside, and the nebula in the reflections.
  vec3 key = M * KEY;
  float keyDiffuse = max(dot(n, key), 0.0) * shadowRay(p + n * 0.004, key);
  float spec = pow(max(dot(refl, key), 0.0), 40.0);
  vec2 uv = shellUV(p / r);
  vec3 base = id == 1.0 ? vec3(0.09, 0.085, 0.09) : id == 2.0 ? vec3(0.12, 0.11, 0.1) : vec3(0.16, 0.16, 0.17);
  base *= 0.75 + 0.5 * hash2(floor(uv));
  vec3 color = base * (starLight * starDiffuse * vis + vec3(0.55, 0.62, 0.9) * keyDiffuse * 0.9 + 0.02 * ao)
    + vec3(0.6, 0.65, 0.9) * spec * 0.25 * keyDiffuse + nebula(refl) * 0.25 * ao;
  if (id == 1.0 && r > 1.0) {
    // Hull lights, and heat bleeding through the seams near the open band.
    float lat = asin(clamp(p.y / r, -1.0, 1.0));
    float lon = atan(p.z, p.x);
    vec2 f = fract(uv);
    float seam = 1.0 - smoothstep(0.0, 0.07, min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y)));
    float nearBand = 1.0 - smoothstep(0.0, 0.1, abs(lat - BAND) - bandWidth(lon));
    color += HOT * seam * nearBand * 0.6;
    float lamp = step(0.985, hash2(floor(uv * 2.0) + 3.0)) * step(0.5, fract(u_time * 0.3 + hash2(floor(uv)) * 4.0));
    color += vec3(1.0, 0.5, 0.3) * lamp * 2.0 * smoothstep(0.35, 0.1, length(fract(uv * 2.0) - 0.5));
    // Posts: a lit panel ringed in its colour.
    for (int k = 0; k < 32; k++) {
      if (k >= u_count) break;
      float c = dot(p / r, u_items[k].xyz);
      float ring = smoothstep(0.9985, 0.9989, c) * smoothstep(0.9996, 0.9992, c);
      float fill = smoothstep(0.9989, 0.9994, c);
      float focus = k == u_focus ? 1.0 : 0.0;
      color += u_colors[k] * (ring * (3.0 + 8.0 * focus) + fill * (0.25 + 1.6 * focus));
    }
  }
  if (id == 3.0) color += vec3(1.0, 0.3, 0.2) * step(1.3, abs(p.y)) * step(0.6, fract(u_time * 0.5)) * 4.0;
  return color;
}

vec3 render(vec3 ro, vec3 rd, vec2 px) {
  mat3 M = toLocal();
  vec3 lro = M * ro;
  vec3 lrd = M * rd;
  vec3 bg = space(rd, px);
  vec2 cp = rayPoint(lro, lrd, vec3(0.0));
  float dc = cp.x;
  vec3 corona = HOT * (3.0 * exp(-max(dc - STAR_R, 0.0) * 14.0) + 0.45 * exp(-max(dc - STAR_R, 0.0) * 4.0));
  // Beams of light escaping through the band, out into space beside the sphere.
  vec3 dirC = normalize(lro + lrd * cp.y);
  float latC = asin(clamp(dirC.y, -1.0, 1.0));
  float open = 1.0 - smoothstep(-0.02, 0.03, abs(latC - BAND) - bandWidth(atan(dirC.z, dirC.x)));
  vec3 beams = HOT * open * exp(-max(dc - 1.0, 0.0) * 2.6) * 0.5 * (0.7 + 0.3 * noise3(dirC * 30.0)) * step(1.0, dc);
  vec2 bound = sphereHits(lro, lrd, vec3(0.0), 1.4);
  if (bound.y < 0.0) return bg + beams;
  float id;
  float t = march(lro, lrd, bound.x, bound.y, id);
  if (t < 0.0) return bg + beams;
  vec3 lp = lro + lrd * t;
  if (id == 4.0) return starSurface(normalize(lp), lrd, HOT, u_time) + corona * 0.3;
  vec3 color = shade(lp, normalAt(lp), lrd, id, M);
  // Glare of the star across the opening, in front of whatever lies behind it.
  if (cp.y < t) color += corona;
  return color;
}
`,
};
