/**
 * Shared GLSL for the megastructure scenes: camera rays, noise, a nebula-and-stars sky with the
 * page's home galaxy in it, analytic glows and filmic tone mapping. A scene supplies
 * `vec3 render(vec3 ro, vec3 rd, vec2 px)` returning linear HDR colour.
 */

export const PRELUDE = `#version 300 es
precision highp float;
uniform vec2 u_res;
uniform vec2 u_css;
uniform vec2 u_center;
uniform float u_focal;
uniform vec3 u_eye;
uniform mat3 u_view;
uniform float u_time;
uniform float u_exposure;
uniform int u_count;
uniform int u_focus;
uniform vec4 u_items[32];
uniform vec3 u_colors[32];
uniform vec3 u_nebulaA;
uniform vec3 u_nebulaB;
uniform sampler2D u_galaxy;
uniform vec4 u_galaxyRect;
out vec4 outColor;

const float PI = 3.14159265;
const float TAU = 6.28318531;

float hash1(float n) { return fract(sin(n) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float hash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise3(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise3(p);
    p = p * 2.02 + vec3(1.7, 9.2, 3.1);
    amplitude *= 0.5;
  }
  return value;
}

mat3 rotY(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
}

mat3 rotX(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}

// Nearest and farthest hits of a ray with a sphere; x < 0 when it misses.
vec2 sphereHits(vec3 ro, vec3 rd, vec3 c, float r) {
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float h = b * b - dot(oc, oc) + r * r;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}

// Distance from point p to the ray, and how far along it that closest point is.
vec2 rayPoint(vec3 ro, vec3 rd, vec3 p) {
  float t = max(dot(p - ro, rd), 0.0);
  return vec2(length(ro + rd * t - p), t);
}

// A soft point light seen through a lens: core plus wide halo.
vec3 glowAt(vec3 ro, vec3 rd, vec3 p, vec3 color, float size) {
  float d = rayPoint(ro, rd, p).x;
  return color * (size * size / (d * d + size * size * 0.02) * 0.02 + exp(-d / (size * 6.0)) * 0.12);
}

vec3 stars(vec3 d) {
  vec3 color = vec3(0.0);
  for (int layer = 0; layer < 2; layer++) {
    float scale = layer == 0 ? 160.0 : 380.0;
    vec3 cell = floor(d * scale);
    float h = hash3(cell + float(layer) * 31.0);
    if (h > 0.988) {
      vec3 center = (cell + 0.5 + (vec3(hash3(cell + 1.3), hash3(cell + 2.7), hash3(cell + 5.1)) - 0.5) * 0.6) / scale;
      float dist = length(d - normalize(center)) * scale;
      float twinkle = 0.65 + 0.35 * sin(u_time * (1.0 + h * 3.0) + h * 80.0);
      float bright = pow((h - 0.988) / 0.012, 8.0) * (layer == 0 ? 2.2 : 0.8) + 0.06;
      vec3 tint = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 0.85, 0.7), hash3(cell + 9.1));
      color += tint * bright * twinkle * exp(-dist * dist * 16.0);
    }
  }
  return color;
}

vec3 nebula(vec3 d) {
  vec3 q = d * 1.6 + vec3(0.0, 0.0, u_time * 0.004);
  float cloud = fbm(q + fbm(q * 1.7 + 4.0) * 0.8);
  float dust = fbm(q * 2.6 + 11.0);
  float body = smoothstep(0.4, 0.9, cloud);
  vec3 color = mix(u_nebulaA, u_nebulaB, smoothstep(0.4, 0.75, fbm(q * 0.8 + 3.0)));
  color *= body * body * body * (1.0 - smoothstep(0.45, 0.75, dust) * 0.8);
  return vec3(0.003, 0.004, 0.012) + color * 0.22;
}

vec3 galaxySprite(vec2 px) {
  if (u_galaxyRect.z <= 0.0) return vec3(0.0);
  vec2 uv = (px - u_galaxyRect.xy) / u_galaxyRect.zw;
  if (uv != clamp(uv, 0.0, 1.0)) return vec3(0.0);
  float fade = 1.0 - smoothstep(0.18, 0.5, length(uv - 0.5));
  vec3 c = texture(u_galaxy, uv).rgb;
  return c * c * fade * 0.9;
}

// The sky behind everything along a ray that hits nothing.
vec3 space(vec3 rd, vec2 px) {
  return nebula(rd) + stars(rd) + galaxySprite(px);
}

// A star's surface: limb darkening and slowly boiling granulation.
vec3 starSurface(vec3 n, vec3 rd, vec3 hot, float t) {
  float mu = clamp(dot(n, -rd), 0.0, 1.0);
  float gran = fbm(n * 9.0 + vec3(0.0, t * 0.05, 0.0));
  float spots = smoothstep(0.62, 0.72, fbm(n * 3.0 + 20.0));
  vec3 color = hot * (0.55 + 0.45 * pow(mu, 0.45)) * (0.75 + 0.5 * gran) * (1.0 - spots * 0.5);
  return color * 9.0;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

vec3 render(vec3 ro, vec3 rd, vec2 px);

uniform bool u_direct;

void main() {
  vec2 px = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y) * (u_css.x / u_res.x);
  vec2 d = px - u_center;
  vec3 rd = normalize(u_view * vec3(d.x, -d.y, u_focal));
  vec3 color = max(render(u_eye, rd, px) * u_exposure, 0.0);
  if (!u_direct) {
    // Linear HDR out; the composite pass adds bloom and tone maps.
    outColor = vec4(min(color, vec3(256.0)), 1.0);
    return;
  }
  color = aces(color);
  color = pow(color, vec3(1.0 / 2.2));
  outColor = vec4(color, 1.0);
}
`;

/**
 * Signed-distance helpers for scenes built from solids. A scene that includes this defines
 * `float map(vec3 p, out float id)` in its own frame and marches a ray already turned into it.
 */
export const SDF_KIT = /* glsl */ `
float map(vec3 p, out float id);

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTorus(vec3 p, float major, float minor) {
  return length(vec2(length(p.xz) - major, p.y)) - minor;
}

// Repeat space around the y axis into n sectors; returns the point folded into the first one.
vec3 foldY(vec3 p, float n) {
  float sector = TAU / n;
  float a = mod(atan(p.z, p.x) + sector * 0.5, sector) - sector * 0.5;
  float r = length(p.xz);
  return vec3(cos(a) * r, p.y, sin(a) * r);
}

vec3 normalAt(vec3 p) {
  float id;
  vec2 e = vec2(0.0015, 0.0);
  return normalize(vec3(
    map(p + e.xyy, id) - map(p - e.xyy, id),
    map(p + e.yxy, id) - map(p - e.yxy, id),
    map(p + e.yyx, id) - map(p - e.yyx, id)));
}

// March from t0 to t1; returns the hit distance or -1.
float march(vec3 ro, vec3 rd, float t0, float t1, out float id) {
  float t = max(t0, 0.0);
  for (int i = 0; i < 110; i++) {
    float d = map(ro + rd * t, id);
    if (d < 0.0007 * t + 0.0004) return t;
    t += d * 0.9;
    if (t > t1) break;
  }
  return -1.0;
}

// Soft shadow towards a light, marched in the scene's own frame.
float shadowRay(vec3 p, vec3 l) {
  float res = 1.0;
  float t = 0.012;
  for (int i = 0; i < 28; i++) {
    float id;
    float h = map(p + l * t, id);
    res = min(res, 10.0 * h / t);
    t += clamp(h, 0.01, 0.15);
    if (res < 0.01 || t > 2.5) break;
  }
  return clamp(res, 0.0, 1.0);
}

float occlusion(vec3 p, vec3 n) {
  float occ = 0.0;
  float weight = 1.0;
  for (int i = 1; i <= 4; i++) {
    float h = 0.025 * float(i);
    float id;
    occ += (h - map(p + n * h, id)) * weight;
    weight *= 0.6;
  }
  return clamp(1.0 - occ * 5.0, 0.0, 1.0);
}

// Sunlit hull: diffuse and a tight specular under shadow, sky reflection and fill under occlusion.
vec3 hull(vec3 n, vec3 rd, vec3 sun, vec3 base, float shine, float shadow, float ao) {
  vec3 refl = reflect(rd, n);
  float diffuse = max(dot(n, sun), 0.0) * shadow;
  float spec = pow(max(dot(refl, sun), 0.0), 30.0 + shine * 60.0) * shine * shadow;
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
  vec3 sky = nebula(refl) * (0.25 + fres * 1.2) + vec3(0.012, 0.014, 0.022);
  return base * diffuse * vec3(1.0, 0.94, 0.86) * 1.15 + spec * 1.2 + (sky + base * 0.03) * ao;
}

// Raised hull plating over a surface coordinate in plate units: 0 in the seams, up to 1 on a plate.
float plateRelief(vec2 uv) {
  vec2 cell = floor(uv);
  vec2 f = fract(uv);
  float h = hash2(cell);
  if (h > 0.55) {
    // Some plates are split in two, for a less regular hull.
    vec2 k = h > 0.78 ? vec2(2.0, 1.0) : vec2(1.0, 2.0);
    cell = floor(uv * k) + 17.0;
    f = fract(uv * k);
    h = hash2(cell);
  }
  float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
  return (0.35 + 0.65 * h) * smoothstep(0.0, 0.07, edge);
}

// Plating relief over a torus around y: nu plates around the ring, nv around the tube.
float torusRelief(vec3 p, float major, float nu, float nv) {
  float u = atan(p.z, p.x) / TAU * nu;
  float v = atan(p.y, length(p.xz) - major) / TAU * nv;
  return plateRelief(vec2(u, v));
}

// Panel texture for hull surfaces: plates with seams, by a 2D surface coordinate.
float plates(vec2 uv) {
  vec2 f = abs(fract(uv) - 0.5);
  float seam = smoothstep(0.47, 0.5, max(f.x, f.y));
  return (0.8 + 0.2 * hash2(floor(uv))) * (1.0 - seam * 0.45);
}
`;

/** A planet with air: `rocky` blue world, otherwise banded gas giant. Needs the prelude. */
export const PLANET_KIT = /* glsl */ `
vec3 planetAt(vec3 ro, vec3 rd, vec3 c, float r, vec3 sun, bool rocky, vec3 bg, out float hitT) {
  vec2 hit = sphereHits(ro, rd, c, r);
  vec2 closest = rayPoint(ro, rd, c);
  float rim = exp(-max(closest.x - r, 0.0) * (rocky ? 16.0 : 10.0) / r);
  vec3 limbDir = normalize(ro + rd * closest.y - c);
  vec3 airColor = rocky ? vec3(0.3, 0.55, 1.0) : vec3(0.9, 0.7, 0.5);
  vec3 air = airColor * rim * (0.05 + 0.9 * max(dot(limbDir, sun) + 0.15, 0.0)) * (rocky ? 1.0 : 0.4);
  hitT = hit.x;
  if (hit.x < 0.0) return bg + air * 0.7;
  vec3 n = normalize(ro + rd * hit.x - c);
  float light = max(dot(n, sun), 0.0);
  vec3 albedo;
  float landMask = 0.0;
  float clouds = 0.0;
  if (rocky) {
    vec3 q = n * 3.0;
    float h = fbm(q + fbm(q * 2.0) * 0.6);
    landMask = smoothstep(0.53, 0.56, h);
    vec3 ground = mix(vec3(0.09, 0.12, 0.06), vec3(0.26, 0.21, 0.14), smoothstep(0.6, 0.75, h));
    albedo = mix(vec3(0.01, 0.03, 0.08), ground, landMask);
    clouds = smoothstep(0.52, 0.82, fbm(q * 1.7 + vec3(u_time * 0.01, 0.0, 0.0)));
    albedo = mix(albedo, vec3(0.75), clouds * 0.85);
  } else {
    float lat = n.y * 7.0 + fbm(n * 4.0) * 1.4;
    albedo = mix(vec3(0.55, 0.42, 0.3), vec3(0.85, 0.75, 0.6), 0.5 + 0.5 * sin(lat * 3.0));
    albedo = mix(albedo, vec3(0.45, 0.3, 0.25), smoothstep(0.55, 0.8, fbm(vec3(n.x * 3.0, lat, n.z * 3.0))));
    albedo *= 0.55;
  }
  vec3 color = albedo * light * (rocky ? 1.6 : 0.7);
  float night = smoothstep(0.1, -0.15, dot(n, sun));
  color += vec3(1.0, 0.65, 0.3) * step(0.93, hash3(floor(n * 240.0))) * landMask * night * (1.0 - clouds) * 0.7;
  float fres = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);
  color = mix(color, airColor * (0.05 + light * 1.2), fres * 0.75);
  return color;
}
`;
