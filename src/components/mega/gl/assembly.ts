/**
 * Guestbook — the interstellar assembly: a domed hall at the centre of a vast ring of delegation
 * seats. Each seat glows in its delegation's colour as fleets arrive; one seat, facing you,
 * stays empty and pulses — the visitor's own.
 */

import { rotY } from './fib';
import { SDF_KIT } from './prelude';
import type { Mega3D, ShipPose, Vec3 } from './types';

const SEATS = 28;
const RING = 1.12;
const YAW = 0.35;
/** The seat turned most nearly towards the camera. */
const VISITOR = Math.round((Math.atan2(Math.cos(YAW), Math.sin(YAW)) / (Math.PI * 2)) * SEATS);
const seatAngle = (seat: number) => (seat / SEATS) * Math.PI * 2;

export const assembly3d: Mega3D = {
  camera: { distance: 4.4, pitch: 0.38, yaw: YAW, extent: 1.3, sway: 0.06 },
  nebula: [
    [0.4, 0.25, 0.6],
    [0.6, 0.3, 0.4],
  ],
  itemData: () => [VISITOR, 0, 0, 0],
  marker: () => rotY([RING, 0.12, 0], seatAngle(VISITOR)),
  ships(time) {
    const ships: ShipPose[] = [];
    const routes: [Vec3, number, string][] = [
      [[-3.4, 1.4, 1.2], 0, '#b8e6fe'],
      [[3.6, 1.1, -0.8], 6, '#ffd27a'],
      [[-2.6, -0.6, 3.2], 12, '#f7a8c8'],
    ];
    for (const [from, delay, color] of routes) {
      const t = ((time + delay) % 18) / 12;
      if (t > 1) continue;
      const to = rotY([RING * 1.25, 0.25, 0], Math.atan2(from[2], from[0]));
      const eased = 1 - (1 - t) ** 2;
      const at: Vec3 = [
        from[0] + (to[0] - from[0]) * eased,
        from[1] + (to[1] - from[1]) * eased,
        from[2] + (to[2] - from[2]) * eased,
      ];
      const heading: Vec3 = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
      const alpha = Math.min(1, t * 8, (1 - t) * 8);
      ships.push({ kind: 'cruiser', position: at, heading, length: 0.16, color, alpha });
      ships.push({
        kind: 'corvette',
        position: [at[0] - 0.18, at[1] + 0.06, at[2] + 0.1],
        heading,
        length: 0.07,
        color,
        alpha,
      });
      ships.push({
        kind: 'corvette',
        position: [at[0] - 0.22, at[1] - 0.05, at[2] - 0.12],
        heading,
        length: 0.07,
        color,
        alpha,
      });
    }
    return ships;
  },
  fragment: /* glsl */ `
${SDF_KIT}
const float SEATS = ${SEATS}.0;
const float RING = ${RING};
const vec3 SUN = normalize(vec3(-0.5, 0.75, 0.45));

// id: 1 hall, 2 ring and bridges, 3 seats
float map(vec3 p, out float id) {
  float hall = length(p * vec3(1.0, 1.25, 1.0)) / 1.12 - 0.4 - 0.005 * plateRelief(vec2(atan(p.z, p.x) / TAU * 40.0, p.y * 18.0));
  hall = min(hall, sdCapsule(p, vec3(0.0, 0.2, 0.0), vec3(0.0, 0.95, 0.0), 0.03 - p.y * 0.02));
  hall = min(hall, sdCapsule(p, vec3(0.0, -0.9, 0.0), vec3(0.0, -0.2, 0.0), 0.06 + p.y * 0.05));
  hall = min(hall, sdTorus(p - vec3(0.0, 0.05, 0.0), 0.47, 0.035));
  vec2 q = vec2(length(p.xz) - RING, p.y * 2.4);
  float ring = (length(q) - 0.16) / 2.4;
  ring = max(ring, -p.y - 0.01);
  ring = min(ring, sdTorus(p, RING, 0.05) - 0.004 * torusRelief(p, RING, 140.0, 8.0));
  float bridges = sdCapsule(foldY(p, 4.0), vec3(0.4, 0.0, 0.0), vec3(RING - 0.12, 0.0, 0.0), 0.022);
  vec3 s = foldY(p, SEATS) - vec3(RING, 0.06, 0.0);
  float seat = length(s * vec3(1.0, 1.6, 1.0)) / 1.6 - 0.045;
  float d = hall;
  id = 1.0;
  float frame = min(ring, bridges);
  if (frame < d) { d = frame; id = 2.0; }
  if (seat < d) { d = seat; id = 3.0; }
  return d;
}

vec3 seatColor(float seat) {
  float h = hash1(seat * 3.7 + 1.0);
  return h < 0.33 ? vec3(0.2, 0.55, 1.0) : h < 0.66 ? vec3(1.0, 0.55, 0.15) : vec3(0.75, 0.3, 1.0);
}

vec3 render(vec3 ro, vec3 rd, vec2 px) {
  vec3 color = space(rd, px);
  vec2 bound = sphereHits(ro, rd, vec3(0.0), 1.5);
  if (bound.y < 0.0) return color;
  float id;
  float t = march(ro, rd, bound.x, bound.y, id);
  if (t < 0.0) return color;
  vec3 p = ro + rd * t;
  vec3 n = normalAt(p);
  float ang = atan(p.z, p.x);
  vec3 base = id == 1.0 ? vec3(0.15, 0.145, 0.155) : vec3(0.09, 0.09, 0.1);
  base *= plates(vec2(ang * (id == 1.0 ? 10.0 : 40.0), p.y * 16.0));
  vec3 lit = hull(n, rd, SUN, base, 0.6, shadowRay(p + n * 0.004, SUN), occlusion(p, n));
  if (id == 1.0) {
    // Bands of windows round the hall, and the great gallery glowing at its waist.
    float band = abs(fract(p.y * 9.0) - 0.5);
    float pane = step(0.62, hash2(floor(vec2(ang * 40.0, p.y * 9.0)))) * step(band, 0.18);
    lit += vec3(1.0, 0.78, 0.5) * pane * 0.9 * step(abs(p.y), 0.42);
    lit += vec3(0.6, 0.75, 1.0) * smoothstep(0.03, 0.0, abs(p.y - 0.05)) * 0.8;
  }
  if (id == 2.0) {
    // Running lights along the ring's upper deck.
    float lights = step(0.96, fract(ang * 48.0 / TAU)) * smoothstep(0.08, 0.12, p.y);
    lit += vec3(0.7, 0.85, 1.0) * lights * (0.5 + 0.5 * sin(u_time * 2.0 - ang * 4.0));
  }
  if (id == 3.0) {
    float seat = floor(mod(ang / TAU * SEATS + 0.5, SEATS));
    bool mine = abs(seat - u_items[0].x) < 0.5;
    if (mine) {
      float pulse = 0.5 + 0.5 * sin(u_time * 2.2);
      float focus = u_focus == 0 ? 1.0 : 0.0;
      float crown = smoothstep(0.4, 0.85, n.y);
      lit += vec3(1.0, 0.3, 0.55) * (0.2 + crown * (1.2 + 2.0 * pulse + 4.0 * focus));
    } else {
      // Delegations come and go: each seat lights for a while in a long cycle.
      float phase = fract(u_time * 0.03 + hash1(seat * 1.9));
      float present = smoothstep(0.0, 0.05, phase) * smoothstep(0.7, 0.62, phase);
      // A seat is a dark dome with a lit crown when its delegation is present.
      float crown = smoothstep(0.5, 0.85, n.y);
      lit += seatColor(seat) * present * (0.15 + crown * 2.2);
    }
  }
  return lit;
}
`,
};
