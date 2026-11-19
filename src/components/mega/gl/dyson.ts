/**
 * Blogs — a Dyson sphere after the Stellaris design: a truncated icosahedron of armoured panels
 * (12 pentagons, 20 hexagons) around a blue-white star. Every panel has a heavy raised frame,
 * inset concentric rings, spokes to its corners, a hub, and greebles and running lights across
 * it. Each post is one of the pentagonal panels, its hub burning in the post's colour; a few
 * hexagons are still open, and the star blazes through them.
 */

import { SDF_KIT } from './prelude';
import type { Mega3D, ShipPose, Vec3 } from './types';

const PHI = (1 + Math.sqrt(5)) / 2;
const TILT = 0.38;
const SPIN = 0.025;
/** Distance of the pentagonal faces when the hexagonal ones sit at 1 (a true truncated icosahedron). */
const PENT_D = 1.02651;
/** Hexagonal faces left open: the panels still missing. */
const OPEN = [12, 15, 17, 22, 25, 29, 31];

const normalize = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};

/** Face normals: 12 pentagons (icosahedron vertices), then 20 hexagons (dodecahedron vertices). */
function faceNormals(): Vec3[] {
  const faces: Vec3[] = [];
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      faces.push([0, a, b * PHI], [a, b * PHI, 0], [b * PHI, 0, a]);
    }
  }
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) faces.push([a, b, c]);
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      // Centres of the icosahedron's faces (the dodecahedron of matching chirality).
      faces.push([0, a * PHI, b / PHI], [a / PHI, 0, b * PHI], [a * PHI, b / PHI, 0]);
    }
  }
  return faces.map(normalize);
}

const FACES = faceNormals();
const glslVec = (v: Vec3) => `vec3(${v.map((x) => x.toFixed(6)).join(', ')})`;

const rotX = (v: Vec3, a: number): Vec3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [v[0], c * v[1] - s * v[2], s * v[1] + c * v[2]];
};
const rotYv = (v: Vec3, a: number): Vec3 => {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c * v[0] - s * v[2], v[1], s * v[0] + c * v[2]];
};
const toWorld = (v: Vec3, time: number) => rotX(rotYv(v, time * SPIN), TILT);

/** Posts take the pentagons first, then closed hexagons. */
function itemFace(index: number): number {
  if (index < 12) return index;
  const closed = FACES.map((_, face) => face).filter((face) => face >= 12 && !OPEN.includes(face));
  return closed[(index - 12) % closed.length];
}

export const dyson3d: Mega3D = {
  camera: { distance: 4.3, pitch: 0.12, yaw: 0.4, extent: 1.25, sway: 0.1 },
  nebula: [
    [0.22, 0.42, 0.95],
    [0.42, 0.3, 0.9],
  ],
  bloom: 0.32,
  itemData: (index) => [itemFace(index), 0, 0, 0],
  marker(index, _count, time, camera) {
    const face = itemFace(index);
    const normal = toWorld(FACES[face], time);
    const d = (face < 12 ? PENT_D : 1) + 0.03;
    const at: Vec3 = [normal[0] * d, normal[1] * d, normal[2] * d];
    const view: Vec3 = [camera.eye[0] - at[0], camera.eye[1] - at[1], camera.eye[2] - at[2]];
    return normal[0] * view[0] + normal[1] * view[1] + normal[2] * view[2] > 0.8 ? at : null;
  },
  ships(time) {
    const ships: ShipPose[] = [];
    for (let k = 0; k < 2; k++) {
      const t = ((time + k * 13) % 26) / 18;
      if (t > 1) continue;
      const face = OPEN[(k * 3 + Math.floor((time + k * 13) / 26)) % OPEN.length];
      const normal = toWorld(FACES[face], time);
      const target: Vec3 = [normal[0] * 1.12, normal[1] * 1.12, normal[2] * 1.12];
      const from: Vec3 = k ? [2.8, -0.7, 2.0] : [-2.5, 1.1, 2.2];
      const e = 1 - (1 - t) ** 2;
      ships.push({
        kind: 'constructor',
        position: [
          from[0] + (target[0] - from[0]) * e,
          from[1] + (target[1] - from[1]) * e,
          from[2] + (target[2] - from[2]) * e,
        ],
        heading: [target[0] - from[0], target[1] - from[1], target[2] - from[2]],
        length: 0.07,
        color: '#b8e6fe',
        alpha: Math.min(1, t * 8, (1 - t) * 8),
      });
    }
    return ships;
  },
  fragment: /* glsl */ `
${SDF_KIT}
const vec3 FN[32] = vec3[32](${FACES.map(glslVec).join(',\n  ')});
const float PENT_D = ${PENT_D};
const float STAR_R = 0.56;
const vec3 STAR = vec3(0.45, 0.68, 1.0);
const vec3 KEY = normalize(vec3(-0.6, 0.65, 0.5));
const float SHELL = 0.04;

mat3 toLocal() { return rotY(-u_time * ${SPIN}) * rotX(-${TILT}); }

float faceD(int i) { return i < 12 ? PENT_D : 1.0; }
float apothem(int i) { return i < 12 ? 0.3035 : 0.382; }

bool isOpen(int i) {
  return ${OPEN.map((face) => `i == ${face}`).join(' || ')};
}

int itemOf(int face) {
  for (int k = 0; k < 32; k++) {
    if (k >= u_count) break;
    if (int(u_items[k].x + 0.5) == face) return k;
  }
  return -1;
}

// Which face a point belongs to, how far it lies off that face's plane (g), its distance to the
// nearest edge (edge) and how close it is to a spoke running out to a corner (gap).
void faceOf(vec3 p, out int id, out float g, out float edge, out float gap) {
  float gs[32];
  g = -1e9;
  id = 0;
  for (int i = 0; i < 32; i++) {
    gs[i] = dot(p, FN[i]) - faceD(i);
    if (gs[i] > g) {
      g = gs[i];
      id = i;
    }
  }
  float e1 = 1e9;
  float e2 = 1e9;
  vec3 n = FN[id];
  for (int j = 0; j < 32; j++) {
    if (j == id) continue;
    float c = dot(n, FN[j]);
    if (c < 0.6) continue;
    float e = (g - gs[j]) / sqrt(1.0 - c * c);
    if (e < e1) {
      e2 = e1;
      e1 = e;
    } else if (e < e2) {
      e2 = e;
    }
  }
  edge = e1;
  gap = e2 - e1;
}

// A line of half-width w at distance d, antialiased over one pixel of size px.
float aaLine(float d, float w, float px) {
  return clamp(1.0 - (d - w) / px, 0.0, 1.0) * min(1.0, (2.0 * w + 0.25 * px) / px);
}

vec2 faceCoords(vec3 p, vec3 n) {
  vec3 t1 = normalize(cross(n, abs(n.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(n, t1);
  return vec2(dot(p, t1), dot(p, t2));
}

// Height of the panel surface above its base plane, by where on the panel we are.
float relief(vec3 p, int id, float edge, float gap) {
  float u = edge / apothem(id);
  float h = 0.022 * (1.0 - smoothstep(0.075, 0.1, u));
  h += 0.008 * (1.0 - smoothstep(0.1, 0.13, u));
  h += 0.006 * (smoothstep(0.24, 0.255, u) - smoothstep(0.29, 0.305, u));
  h -= 0.006 * (smoothstep(0.47, 0.485, u) - smoothstep(0.53, 0.545, u));
  h -= 0.012 * smoothstep(0.62, 0.64, u);
  float spoke = 1.0 - smoothstep(0.006, 0.011, gap);
  h += 0.007 * spoke * smoothstep(0.1, 0.12, u) * (1.0 - smoothstep(0.6, 0.62, u));
  vec2 c = faceCoords(p, FN[id]);
  float rad = length(c - faceCoords(FN[id] * faceD(id), FN[id]));
  h += 0.024 * (1.0 - smoothstep(0.045, 0.052, rad)) - 0.01 * (smoothstep(0.052, 0.058, rad) - smoothstep(0.075, 0.082, rad));
  // Greebles: small boxes scattered over the panel bands.
  vec2 cell = floor(c * 70.0);
  vec2 f = fract(c * 70.0);
  // Smooth-edged so the surface stays continuous and its normals stay sane.
  float box = step(0.72, hash2(cell + float(id) * 13.0)) * smoothstep(0.08, 0.22, f.x) * smoothstep(0.92, 0.78, f.x)
    * smoothstep(0.08, 0.22, f.y) * smoothstep(0.92, 0.78, f.y);
  h += 0.003 * box * smoothstep(0.13, 0.15, u) * (1.0 - smoothstep(0.6, 0.62, u));
  return h;
}

// id: 1 shell, 4 star
float map(vec3 p, out float id) {
  float r = length(p);
  float star = r - STAR_R;
  id = 4.0;
  if (r > 1.2) return min(star, r - 1.12);
  int face;
  float g;
  float edge;
  float gap;
  faceOf(p, face, g, edge, gap);
  float shell = max(g - relief(p, face, edge, gap), -(g + SHELL));
  if (isOpen(face)) shell = max(shell, edge - apothem(face) * 0.1);
  if (shell < star) {
    id = 1.0;
    return shell;
  }
  return star;
}

float starVisibility(vec3 p) {
  vec3 l = -normalize(p);
  float t = 0.01;
  float res = 1.0;
  float limit = length(p) - STAR_R - 0.02;
  for (int i = 0; i < 20; i++) {
    float id;
    float h = map(p + l * t, id);
    if (id == 4.0) break;
    res = min(res, 10.0 * h / t);
    t += clamp(h, 0.008, 0.1);
    if (res < 0.02 || t > limit) break;
  }
  return clamp(res, 0.0, 1.0);
}

vec3 shadePanel(vec3 p, vec3 n, vec3 rd, mat3 M) {
  int face;
  float g;
  float edge;
  float gap;
  faceOf(p, face, g, edge, gap);
  float ap = apothem(face);
  float u = edge / ap;
  vec3 fn = FN[face];
  vec2 c = faceCoords(p, fn);
  float rad = length(c - faceCoords(fn * faceD(face), fn));
  bool inner = g < -SHELL * 0.6;
  float ao = occlusion(p, n);
  vec3 refl = reflect(rd, n);
  // Dark gunmetal, varied cell by cell; the frames a shade lighter.
  vec3 base = vec3(0.07, 0.075, 0.09) * (0.75 + 0.5 * hash2(floor(c * 70.0) + float(face)));
  base = mix(base, vec3(0.13, 0.13, 0.15), 1.0 - smoothstep(0.08, 0.1, u));
  // The cold light of the nebula from one side.
  vec3 key = M * KEY;
  float diffuse = max(dot(n, key), 0.0);
  float spec = pow(max(dot(refl, key), 0.0), 50.0);
  vec3 color = base * (vec3(0.6, 0.7, 1.0) * diffuse * 0.9 + 0.03 * ao) + vec3(0.7, 0.8, 1.0) * spec * 0.6 * diffuse;
  color += nebula(refl) * 0.6 * ao;
  // Starlight on everything that faces the star through an opening.
  float toStar = max(dot(n, -normalize(p)), 0.0);
  if (toStar > 0.0) color += base * STAR * 5.0 * toStar * starVisibility(p + n * 0.004) / dot(p, p);
  if (inner) return color;
  // Running lights: thin dashed strips along the frame and the rings, and fine tech lines between.
  // Lines thinner than a pixel fade by coverage instead of breaking up into speckles.
  float px = clamp(fwidth(edge), 0.0006, 0.01);
  vec2 cc = c - faceCoords(fn * faceD(face), fn);
  float ang = atan(cc.y, cc.x) / TAU;
  float seed = hash1(float(face) * 3.1);
  float strip = aaLine(abs(u - 0.102) * ap, 0.0012, px) * step(0.3, fract(ang * 30.0 + seed));
  float ring = aaLine(abs(u - 0.31) * ap, 0.001, px) * step(0.45, fract(ang * 24.0 + seed * 2.0));
  float ring2 = aaLine(abs(u - 0.6) * ap, 0.001, px) * step(0.25, fract(ang * 12.0 + 0.3));
  float band = floor(u * 18.0);
  float lines = aaLine(abs(fract(u * 18.0) - 0.5) / 18.0 * ap, 0.0007, px) * smoothstep(0.33, 0.35, u)
    * (1.0 - smoothstep(0.45, 0.47, u)) * step(0.55, fract(ang * 20.0 + hash1(band + seed * 9.0)));
  float frameEdge = aaLine(abs(u - 0.075) * ap, 0.0012, px);
  vec3 cold = vec3(0.8, 0.9, 1.0);
  color += cold * (strip * 2.0 + ring * 1.8 + ring2 * 1.5 + lines * 1.2 + frameEdge * 0.6);
  // Tiny lamps among the greebles.
  vec2 cell = floor(c * 140.0);
  float lamp = step(0.985, hash2(cell + 7.0 + float(face))) * smoothstep(0.13, 0.15, u) * (1.0 - smoothstep(0.6, 0.62, u));
  color += vec3(0.75, 0.88, 1.0) * lamp * 3.0 * step(0.3, fract(u_time * 0.2 + hash2(cell)));
  // Pentagons glow violet in their grooves.
  if (face < 12) color += vec3(0.55, 0.3, 1.0) * (smoothstep(0.47, 0.49, u) - smoothstep(0.52, 0.54, u)) * 1.4;
  // The hub: the post's colour, brighter when its link is in focus.
  int item = itemOf(face);
  float hub = 1.0 - smoothstep(0.03, 0.045, rad);
  float hubRing = smoothstep(0.05, 0.056, rad) * (1.0 - smoothstep(0.07, 0.078, rad));
  if (item >= 0) {
    float focus = item == u_focus ? 1.0 : 0.0;
    float pulse = 0.8 + 0.2 * sin(u_time * 1.6 + float(item));
    color += u_colors[item] * (hub * (3.0 + 8.0 * focus) * pulse + hubRing * (0.6 + 4.0 * focus));
    color += u_colors[item] * focus * 0.6 * strip;
  } else {
    color += (face < 12 ? vec3(0.6, 0.35, 1.0) : vec3(0.4, 0.7, 1.0)) * hub * 1.2;
  }
  return color;
}

vec3 render(vec3 ro, vec3 rd, vec2 px) {
  mat3 M = toLocal();
  vec3 lro = M * ro;
  vec3 lrd = M * rd;
  vec3 bg = space(rd, px);
  vec2 cp = rayPoint(lro, lrd, vec3(0.0));
  float dc = cp.x;
  // Light scattered round the sphere from its openings.
  vec3 haze = STAR * (0.06 * exp(-max(dc - 1.0, 0.0) * 3.0) + 0.012 * exp(-max(dc - 1.0, 0.0) * 0.8));
  vec2 bound = sphereHits(lro, lrd, vec3(0.0), 1.1);
  if (bound.y < 0.0) return bg + haze;
  float id;
  float t = march(lro, lrd, bound.x, bound.y, id);
  if (t < 0.0) return bg + haze;
  vec3 lp = lro + lrd * t;
  if (id == 4.0) {
    vec3 sn = normalize(lp);
    float mu = max(dot(sn, -lrd), 0.0);
    float cells = fbm(sn * 7.0 + vec3(0.0, u_time * 0.04, 0.0));
    float veins = smoothstep(0.45, 0.5, fbm(sn * 4.0 - vec3(u_time * 0.02)));
    return STAR * (2.5 + 5.0 * cells * cells + 5.0 * veins) * (0.45 + 0.55 * pow(mu, 0.4));
  }
  vec3 color = shadePanel(lp, normalAt(lp), lrd, M);
  // Glare of the star across an opening, in front of the frame behind it.
  // Seen through an opening the inside is full of the star's light.
  if (cp.y < t && dc < 1.0) {
    float x = max(dc - STAR_R, 0.0);
    color += STAR * (3.5 * exp(-x * 7.0) + 1.1 * exp(-x * 2.0));
  }
  return color + haze * 0.3;
}
`,
};
