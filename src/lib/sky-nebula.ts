/**
 * The nebulae behind the inner pages, as SVG markup (pure: same environment, same sky).
 *
 * Every sky is built like a photograph of a star-forming region, the Pillars of Creation in
 * particular: glowing gas in blue, white and pink (with one accent colour per page) and, in front
 * of it, sculpted columns of cold dust. The columns are lit from one side, so they have volume:
 * their outline is torn by displaced noise, their surface is shaded with diffuse lighting over a
 * noise height map, a halo of evaporating gas glows round their edges, and their tips burn
 * bright where young stars are switching on. Each page keeps a signature feature of its own
 * galaxy (planetary rings, cirrus veils, a jet, the Milky Way, a supernova shell, far galaxies).
 *
 * The field is 1600 × 2600 user units, drawn taller than the screen so it can glide as the page
 * scrolls; the columns stand in the side margins, clear of the reading panel.
 */

import { createRandom, type Random } from './galaxy-flight/particles';
import type { SkyEnvironment } from './sky-catalog';

interface Cloud {
  x: number;
  y: number;
  rx: number;
  ry: number;
  color: string;
  /** Noise scale: smaller gives larger wisps. */
  frequency: number;
  strength: number;
  turn?: number;
  /** `filament` keeps only the noise's veins (cirrus, shock fronts); `dust` darkens. */
  kind?: 'haze' | 'filament' | 'dust';
  /** `ring` keeps only a band round the centre (planetary nebulae, supernova shells). */
  shape?: 'ellipse' | 'ring';
}

interface Palette {
  /** Glowing gas, from the base blue, white and pink plus the page's accent. */
  gas: string[];
  /** Colour of the lit edges and halos of the dust columns. */
  rim: string;
  /** The columns' sunlit flank. */
  lit: string;
}

interface Environment {
  palette: Palette;
  /** Signature clouds of the page's own galaxy, drawn between the gas and the columns. */
  features: Cloud[];
  sparkles?: number;
  galaxies?: number;
}

const WHITE = '#eef2ff';
const BLUE = '#60a5fa';
const PINK = '#f472b6';

const cloud = (
  [x, y, rx, ry]: [number, number, number, number],
  color: string,
  frequency: number,
  strength: number,
  extra: Partial<Cloud> = {},
): Cloud => ({ x, y, rx, ry, color, frequency, strength, ...extra });

const ENVIRONMENTS: Record<SkyEnvironment, Environment> = {
  // M51: hydrogen glowing rose, the classic pillar sky.
  rose: { palette: { gas: [PINK, BLUE, WHITE, '#c084fc'], rim: '#ffc2e2', lit: '#f5b8d6' }, features: [] },
  // NGC 1300: blue reflection haze round spiked young stars, a little gold dust.
  gold: {
    palette: { gas: [BLUE, WHITE, PINK, '#fcd34d'], rim: '#ffe7b8', lit: '#e8d2b0' },
    features: [cloud([1480, 1250, 380, 300], '#7dd3fc', 0.0022, 0.7)],
    sparkles: 7,
  },
  // Hoag's Object: planetary nebulae, rings of gas round dying stars.
  ring: {
    palette: { gas: [BLUE, WHITE, PINK, '#2dd4bf'], rim: '#b9f3ff', lit: '#c3d8f5' },
    features: [
      cloud([1450, 1250, 300, 300], '#5eead4', 0.004, 0.9, { shape: 'ring' }),
      cloud([1450, 1250, 200, 200], '#bfdbfe', 0.003, 0.55),
      cloud([150, 2050, 200, 200], '#f9a8d4', 0.005, 0.85, { shape: 'ring' }),
    ],
  },
  // The Small Magellanic Cloud: long cirrus veils between the columns.
  cloud: {
    palette: { gas: [BLUE, WHITE, PINK, '#a78bfa'], rim: '#dcd3ff', lit: '#d6c8f0' },
    features: [
      cloud([170, 1300, 460, 150], '#a5f3fc', 0.006, 0.85, { kind: 'filament', turn: 32 }),
      cloud([1430, 2150, 460, 150], '#f9a8d4', 0.006, 0.8, { kind: 'filament', turn: -28 }),
    ],
  },
  // Sgr A*: the disk's blue and rose, and the jet fired from the hole's pole.
  disk: {
    palette: { gas: [BLUE, PINK, WHITE, '#818cf8'], rim: '#c9dcff', lit: '#cdb8e8' },
    features: [
      cloud([1470, 1300, 60, 560], '#bfdbfe', 0.009, 0.95, { kind: 'filament', turn: 6 }),
      cloud([1470, 1300, 140, 600], '#818cf8', 0.004, 0.5, { turn: 6 }),
    ],
  },
  // The star chart: the Milky Way crossing the sky, split by its dark rift.
  milkyway: {
    palette: { gas: [BLUE, WHITE, PINK, '#fde68a'], rim: '#fff1d6', lit: '#e9dcc8' },
    features: [
      cloud([800, 1300, 1700, 230], '#dbe4ff', 0.004, 0.7, { turn: 62 }),
      cloud([800, 1300, 1500, 110], '#fde68a', 0.0055, 0.45, { turn: 62 }),
      cloud([800, 1300, 1500, 60], '#05040f', 0.007, 0.9, { kind: 'dust', turn: 62 }),
    ],
  },
  // The pulsar: the torn shell of the supernova that made it.
  remnant: {
    palette: { gas: [BLUE, PINK, WHITE, '#f87171'], rim: '#ffc9c9', lit: '#e8b9c2' },
    features: [
      cloud([1450, 1250, 360, 340], '#fb7185', 0.009, 0.9, { kind: 'filament', shape: 'ring' }),
      cloud([1450, 1250, 260, 250], '#5eead4', 0.0035, 0.55),
    ],
  },
  // The Local Group: far galaxies scattered between the columns.
  group: { palette: { gas: [BLUE, WHITE, PINK, '#a78bfa'], rim: '#e4d9ff', lit: '#d4c9ee' }, features: [], galaxies: 22 },
};

const rgb = (hex: string) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255);
const f = (value: number) => value.toFixed(1);

/** Colour matrix turning noise into tinted, thresholded alpha. Filaments keep only the brightest veins. */
function cloudMatrix(item: Cloud): string {
  const [r, g, b] = rgb(item.color);
  const gain = item.kind === 'filament' ? 4.6 : 3.1;
  const cut = item.kind === 'filament' ? 1.95 : 1.0;
  const alpha = `${(gain * item.strength).toFixed(2)} 0 0 0 ${(-cut * item.strength).toFixed(2)}`;
  return `0 0 0 0 ${r.toFixed(3)} 0 0 0 0 ${g.toFixed(3)} 0 0 0 0 ${b.toFixed(3)} ${alpha}`;
}

function cloudSvg(item: Cloud, id: string, seed: number): { defs: string; body: string } {
  const reach = Math.max(item.rx, item.ry);
  const turn = item.turn ? ` transform="rotate(${item.turn} ${item.x} ${item.y})"` : '';
  const type = item.kind === 'filament' ? 'turbulence' : 'fractalNoise';
  return {
    defs:
      `<filter id="${id}-n" x="0" y="0" width="100%" height="100%"><feTurbulence type="${type}" baseFrequency="${item.frequency}" numOctaves="5" seed="${seed}"/>` +
      `<feColorMatrix type="matrix" values="${cloudMatrix(item)}"/></filter>` +
      `<mask id="${id}-m"><ellipse cx="${item.x}" cy="${item.y}" rx="${item.rx}" ry="${item.ry}" fill="url(#sky-shape-${item.shape ?? 'ellipse'})"${turn}/></mask>`,
    body: `<rect x="${item.x - reach}" y="${item.y - reach}" width="${reach * 2}" height="${reach * 2}" filter="url(#${id}-n)" mask="url(#${id}-m)"/>`,
  };
}

interface Column {
  path: string;
  tip: [number, number];
  width: number;
}

/**
 * One dust column rising from (x, base): a wavering spine that leans and tapers, with a lumpy
 * head. The outline is kept smooth here; the filter tears it into ragged edges.
 */
function column(random: Random, x: number, base: number, height: number, width: number, lean: number): Column {
  const phase = random.between(0, Math.PI * 2);
  const steps = 22;
  const left: string[] = [];
  const right: string[] = [];
  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const cx = x + lean * height * t ** 1.3 + Math.sin(t * 4.2 + phase) * width * 0.18;
    const cy = base - height * t;
    const half = (width / 2) * (1.25 - 0.55 * t) * (1 + 0.12 * Math.sin(t * 9 + phase * 1.7));
    left.push(`${f(cx - half)},${f(cy)}`);
    right.unshift(`${f(cx + half)},${f(cy)}`);
  }
  const tipX = x + lean * height + Math.sin(4.2 + phase) * width * 0.18;
  const tipY = base - height;
  const head = width * random.between(0.32, 0.42);
  // Round, slightly lumpy head joining the two flanks.
  const crown = `Q${f(tipX - head * 1.1)},${f(tipY - head * 1.25)} ${f(tipX)},${f(tipY - head * 1.1)} Q${f(tipX + head * 1.2)},${f(tipY - head)} `;
  const path = `M${left.join(' L')} ${crown}${right.join(' L')} Z`;
  return { path, tip: [tipX, tipY - head * 0.5], width };
}

/**
 * A group of two or three columns standing in one margin, like the Pillars of Creation: the
 * tallest in the middle, all leaning a little towards the page, lit from the page's side.
 */
function pillars(random: Random, id: string, side: 'left' | 'right', base: number, palette: Palette, seed: number) {
  const count = random.next() < 0.5 ? 2 : 3;
  const toward = side === 'left' ? 1 : -1;
  const anchor = side === 'left' ? random.between(60, 150) : random.between(1450, 1540);
  const columns: Column[] = [];
  for (let index = 0; index < count; index++) {
    const tall = index === 1 || count === 2 ? 1 : 0.7;
    const height = random.between(520, 760) * tall;
    const width = random.between(85, 140) * (0.75 + 0.25 * tall);
    const x = anchor + toward * (index * random.between(85, 120) - 40);
    columns.push(column(random, x, base + random.between(0, 60), height, width, toward * random.between(0.06, 0.2)));
  }
  const top = Math.min(...columns.map((item) => item.tip[1])) - 160;
  const left = Math.min(...columns.map((item) => item.tip[0])) - 260;
  const box = { x: left, y: top, w: 560, h: base + 100 - top };
  // Light falls from the page's side: the flank facing the reading panel is lit.
  const azimuth = side === 'left' ? -40 : -140;
  const [x1, x2] = side === 'left' ? [0, 1] : [1, 0];
  const defs =
    `<linearGradient id="${id}-fill" x1="${x1}" y1="0" x2="${x2}" y2="0">` +
    `<stop offset="0" stop-color="#0c0816"/><stop offset="0.4" stop-color="#2e1b2e"/><stop offset="0.66" stop-color="#63404f"/>` +
    `<stop offset="0.86" stop-color="#b48aa6"/><stop offset="1" stop-color="${palette.lit}"/></linearGradient>` +
    `<linearGradient id="${id}-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="0.72" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<mask id="${id}-mask" maskUnits="userSpaceOnUse" x="${f(box.x)}" y="${f(box.y)}" width="${box.w}" height="${f(box.h)}"><rect x="${f(box.x)}" y="${f(box.y)}" width="${box.w}" height="${f(box.h)}" fill="url(#${id}-fade)"/></mask>` +
    `<filter id="${id}-filter" filterUnits="userSpaceOnUse" x="${f(box.x)}" y="${f(box.y)}" width="${box.w}" height="${f(box.h)}" color-interpolation-filters="sRGB">` +
    // Tear the smooth outline into ragged, cloudy edges, then fray them finer still and soften:
    // the columns are gas and dust, not rock.
    `<feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="3" seed="${seed}" result="tear"/>` +
    `<feDisplacementMap in="SourceGraphic" in2="tear" scale="52" xChannelSelector="R" yChannelSelector="G" result="torn"/>` +
    `<feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="${seed + 2}" result="fray"/>` +
    `<feDisplacementMap in="torn" in2="fray" scale="14" xChannelSelector="G" yChannelSelector="R" result="frayed"/>` +
    `<feGaussianBlur in="frayed" stdDeviation="2.4" result="shape"/>` +
    // Shade a broad noise height map with a distant light, so the surface reads as billowing volume.
    `<feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="4" seed="${seed + 1}" result="bump"/>` +
    `<feDiffuseLighting in="bump" surfaceScale="3.6" diffuseConstant="1.05" lighting-color="#fff4fb" result="light"><feDistantLight azimuth="${azimuth}" elevation="38"/></feDiffuseLighting>` +
    `<feComposite in="light" in2="shape" operator="arithmetic" k1="0.85" k2="0" k3="0.32" k4="0" result="shaded"/>` +
    `<feComposite in="shaded" in2="shape" operator="in" result="body"/>` +
    // A halo of gas boiling off the lit flank, brightest towards the light.
    `<feGaussianBlur in="shape" stdDeviation="18" result="soft"/>` +
    `<feOffset in="soft" dx="${side === 'left' ? 16 : -16}" dy="-10" result="shifted"/>` +
    `<feFlood flood-color="${palette.rim}" flood-opacity="0.6"/><feComposite in2="shifted" operator="in" result="halo"/>` +
    // A crisp bright rim where the light grazes the lit flank and the tops.
    `<feOffset in="shape" dx="${side === 'left' ? -7 : 7}" dy="6" result="away"/>` +
    `<feComposite in="shape" in2="away" operator="out" result="edge"/>` +
    `<feGaussianBlur in="edge" stdDeviation="1.8" result="edgeSoft"/>` +
    `<feFlood flood-color="#f4f7ff" flood-opacity="0.9"/><feComposite in2="edgeSoft" operator="in" result="rim"/>` +
    `<feMerge><feMergeNode in="halo"/><feMergeNode in="body"/><feMergeNode in="rim"/></feMerge></filter>`;
  const paths = columns.map((item) => `<path d="${item.path}" fill="url(#${id}-fill)"/>`).join('');
  // Bright tips where young stars are switching on, and the gas lit behind each head.
  const tips = columns
    .map(
      (item) =>
        `<ellipse cx="${f(item.tip[0])}" cy="${f(item.tip[1])}" rx="${f(item.width * 0.9)}" ry="${f(item.width * 0.7)}" fill="url(#sky-tip-glow)"/>` +
        `<circle cx="${f(item.tip[0] + random.between(-12, 12))}" cy="${f(item.tip[1] + random.between(-6, 16))}" r="2.2" fill="#fff"/>`,
    )
    .join('');
  return {
    defs,
    glow: { x: (side === 'left' ? left + 260 : left + 300) + toward * 120, y: top + 260 },
    body: `<g class="sky-pillars"><g mask="url(#${id}-mask)"><g filter="url(#${id}-filter)">${paths}</g></g>${tips}</g>`,
  };
}

const SHARED_DEFS =
  '<radialGradient id="sky-shape-ellipse"><stop offset="0" stop-color="#fff"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="sky-shape-ring"><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="0.72" stop-color="#fff"/><stop offset="0.86" stop-color="#fff" stop-opacity="0.5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="sky-far-galaxy"><stop offset="0" stop-color="#fff7e8"/><stop offset="0.3" stop-color="#c7d2fe" stop-opacity="0.6"/><stop offset="1" stop-color="#c7d2fe" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="sky-tip-glow"><stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="0.35" stop-color="#dbe7ff" stop-opacity="0.35"/><stop offset="1" stop-color="#dbe7ff" stop-opacity="0"/></radialGradient>';

/** Where the dust columns stand: alternating margins down the field. */
const PILLAR_BASES: ReadonlyArray<['left' | 'right', number]> = [
  ['left', 1020],
  ['right', 1820],
  ['left', 2600],
];

/** Inner markup of the page's nebula `<svg viewBox="0 0 1600 2600">`. */
export function nebulaSvg(env: SkyEnvironment): string {
  const { palette, features, sparkles = 0, galaxies = 0 } = ENVIRONMENTS[env];
  const random = createRandom(env.length * 977 + palette.rim.charCodeAt(2) * 13);
  const seed = () => Math.floor(random.between(1, 999));
  const defs: string[] = [SHARED_DEFS];
  const body: string[] = [];
  const add = (item: Cloud, id: string) => {
    const svg = cloudSvg(item, id, seed());
    defs.push(svg.defs);
    body.push(svg.body);
  };

  const groups = PILLAR_BASES.map(([side, base], index) => pillars(random, `sky-p${index}`, side, base, palette, seed()));
  // Glowing gas: a haze down both margins, and a bright bloom behind every column group.
  for (let index = 0; index < 8; index++) {
    const color = palette.gas[index % palette.gas.length];
    add(cloud([index % 2 ? 1500 : 100, 160 + index * 320, 470, 360], color, 0.0026, 0.6), `sky-h${index}`);
  }
  groups.forEach((group, index) => {
    add(
      cloud([group.glow.x, group.glow.y, 400, 440], palette.gas[(index + 2) % palette.gas.length], 0.0024, 0.85),
      `sky-b${index}`,
    );
    add(cloud([group.glow.x, group.glow.y - 40, 260, 280], WHITE, 0.003, 0.7), `sky-w${index}`);
  });
  features.forEach((item, index) => {
    add(item, `sky-f${index}`);
  });
  for (let index = 0; index < galaxies; index++) {
    const x = random.next() < 0.5 ? random.between(30, 430) : random.between(1170, 1570);
    const y = random.between(60, 2540);
    const r = random.between(8, 24);
    body.push(
      `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r)}" ry="${f(r * random.between(0.25, 0.7))}" fill="url(#sky-far-galaxy)" transform="rotate(${f(random.between(0, 180))} ${f(x)} ${f(y)})"/>`,
    );
  }
  for (const group of groups) {
    defs.push(group.defs);
    body.push(group.body);
  }
  for (let index = 0; index < sparkles; index++) {
    const x = index % 2 ? random.between(1180, 1560) : random.between(40, 420);
    const y = random.between(150, 2450);
    const size = random.between(26, 60);
    body.push(
      `<g transform="translate(${f(x)} ${f(y)})"><circle r="${f(size * 0.32)}" fill="url(#sky-far-galaxy)"/>` +
        `<ellipse rx="${f(size)}" ry="1.2" fill="#fff8e6" opacity="0.8"/><ellipse rx="1.2" ry="${f(size)}" fill="#fff8e6" opacity="0.8"/><circle r="2.6" fill="#fff"/></g>`,
    );
  }
  return `<defs>${defs.join('')}</defs>${body.join('')}`;
}

/** Three layers of stars as box-shadows, spread deeper than the screen so they can glide on scroll. */
export function starLayers(env: SkyEnvironment): { depth: number; shadow: string }[] {
  const random = createRandom(env.length * 131 + 7);
  const layer = (count: number, size: [number, number], alpha: [number, number], blur: number, depth: number) =>
    Array.from({ length: count }, () => {
      const a = random.between(alpha[0], alpha[1]).toFixed(2);
      const color = random.next() < 0.2 ? `rgb(255 222 190 / ${a})` : `rgb(225 232 255 / ${a})`;
      const at = `${random.between(0, 100).toFixed(2)}vw ${random.between(0, 100 + depth).toFixed(2)}vh`;
      return `${at} ${blur}px ${random.between(size[0], size[1]).toFixed(1)}px ${color}`;
    }).join(',');
  return [
    { depth: 25, shadow: layer(300, [0, 0.4], [0.25, 0.6], 0, 25) },
    { depth: 45, shadow: layer(110, [0.4, 0.9], [0.45, 0.85], 1, 45) },
    { depth: 70, shadow: layer(26, [0.8, 1.4], [0.75, 1], 3, 70) },
  ];
}
