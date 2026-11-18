/**
 * Canvas painters for the homepage galaxies (browser only).
 *
 * `paintGalaxy` draws the slow, rigid "pattern" of a galaxy once (arms, bar, ring,
 * dust lanes, bulge, glow). `createFieldStars` + `drawFieldStars` animate a light
 * layer of disk stars on top that orbit differentially — inner stars faster than
 * outer ones — so the galaxy shears and twinkles like a real one.
 * Everything is seeded, so the same kind always produces the same picture.
 */
import { type GalaxyKind, galaxyPoint, MOMENT_CLUMPS } from './galaxy';

type Rgb = readonly [number, number, number];

const WARM: Rgb = [255, 236, 200];
const OLD_STARS: Rgb = [255, 214, 160];
const YOUNG_STARS: Rgb = [214, 232, 255];
const HII_PINK: Rgb = [255, 150, 186];
const WHITE: Rgb = [255, 255, 255];
const DUST = 'rgba(9, 8, 22, ';

function seeded(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mix(a: Rgb, b: Rgb, f: number): Rgb {
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

function rgba(col: Rgb, alpha: number): string {
  return `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${alpha.toFixed(3)})`;
}

function supportsCanvasFilter(ctx: CanvasRenderingContext2D): boolean {
  if (!('filter' in ctx)) return false;
  ctx.filter = 'blur(1px)';
  const supported = ctx.filter === 'blur(1px)';
  ctx.filter = 'none';
  return supported;
}

/** Adds a soft bloom by laying a blurred copy of the picture over itself. */
function bloom(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, radius: number, strength: number) {
  if (!supportsCanvasFilter(ctx)) return;
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext('2d')?.drawImage(canvas, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = strength;
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(copy, 0, 0);
  ctx.restore();
}

export function paintGalaxy(canvas: HTMLCanvasElement, kind: GalaxyKind): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = canvas.width;
  const c = size / 2;
  const R = size * 0.46;
  const k = size / 600;
  const rnd = seeded(1234567 + kind.length * 97);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

  const dot = (x: number, y: number, radius: number, col: Rgb, alpha: number) => {
    ctx.fillStyle = rgba(col, alpha);
    ctx.beginPath();
    ctx.arc(x, y, radius * k, 0, Math.PI * 2);
    ctx.fill();
  };
  const glow = (x: number, y: number, radius: number, col: Rgb, alpha: number) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, rgba(col, alpha));
    gradient.addColorStop(0.35, rgba(col, alpha * 0.45));
    gradient.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  const knot = (x: number, y: number, col: Rgb) => {
    glow(x, y, (3 + rnd() * 6) * k, col, 0.5);
    dot(x, y, 0.9 + rnd() * 0.6, WHITE, 0.9);
  };
  const dust = (x: number, y: number, radius: number, alpha: number) => {
    ctx.fillStyle = `${DUST}${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, radius * k, 0, Math.PI * 2);
    ctx.fill();
  };
  /** Old, smooth exponential disk underneath everything. */
  const disk = (count: number, scale: number, col: Rgb, alpha: number) => {
    for (let i = 0; i < count; i++) {
      const r = -Math.log(1 - rnd() * 0.98) * scale * R;
      const a = rnd() * Math.PI * 2;
      dot(c + r * Math.cos(a), c + r * Math.sin(a), 0.4 + rnd() * 0.6, mix(col, WHITE, rnd() * 0.4), alpha * (0.4 + rnd()));
    }
  };

  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';

  if (kind === 'blogs' || kind === 'papers') {
    const spiral = kind === 'blogs';
    const arms: [Rgb, Rgb][] = spiral
      ? [
          [
            [255, 214, 232],
            [233, 83, 106],
          ],
          [
            [200, 232, 255],
            [57, 140, 219],
          ],
        ]
      : [
          [
            [255, 226, 170],
            [233, 150, 120],
          ],
          [
            [255, 226, 170],
            [210, 160, 200],
          ],
        ];
    glow(c, c, R * 0.75, spiral ? [190, 170, 230] : [230, 200, 150], 0.12);
    disk(spiral ? 9000 : 6500, 0.28, spiral ? [210, 205, 245] : [240, 220, 190], 0.07);

    if (!spiral) {
      // The bar: an elongated, old, yellowish structure.
      for (let i = 0; i < 4200; i++) {
        let g = gauss();
        while (Math.abs(g) > 1.9) g = gauss();
        const x = c + g * R * 0.2;
        const y = c + gauss() * R * (0.04 + 0.02 * (1 - Math.abs(g) / 1.9));
        dot(x, y, 0.4 + rnd() * 0.8, mix(WARM, OLD_STARS, rnd()), 0.1 + rnd() * 0.35);
      }
    }

    arms.forEach(([inner, outer], arm) => {
      const count = spiral ? 7000 : 5200;
      for (let i = 0; i < count; i++) {
        const t = rnd() ** 0.75;
        const [px, py] = galaxyPoint(kind, arm, t);
        const spread = (spiral ? 0.028 : 0.032) + 0.075 * t;
        const angle = Math.atan2(py, px);
        const along = gauss() * spread;
        const across = gauss() * spread * 0.45;
        const x = c + (px + along * Math.cos(angle) - across * Math.sin(angle)) * R;
        const y = c + (py + along * Math.sin(angle) + across * Math.cos(angle)) * R;
        // Young blue-white stars sit on the arm's ridge, older reddish ones drift off it.
        const ridge = Math.exp(-((along / spread) ** 2));
        const col = mix(mix(inner, outer, Math.min(1, t * 1.05 + rnd() * 0.2)), YOUNG_STARS, ridge * 0.45);
        dot(x, y, 0.35 + rnd() * 1.05, col, (0.16 + rnd() * 0.55) * (1 - t * 0.35));
      }
    });

    // Dust lanes along the inner, trailing edge of each arm.
    ctx.globalCompositeOperation = 'source-over';
    arms.forEach((_, arm) => {
      for (let i = 0; i < (spiral ? 2600 : 1600); i++) {
        const t = 0.06 + rnd() * 0.8;
        const [px, py] = galaxyPoint(kind, arm, t);
        const shrink = 0.92 - 0.04 * rnd();
        dust(
          c + (px * shrink + gauss() * 0.012) * R,
          c + (py * shrink + gauss() * 0.012) * R,
          1.2 + rnd() * 2.4,
          0.025 + rnd() * 0.055,
        );
      }
    });
    ctx.globalCompositeOperation = 'lighter';

    // Star-forming knots: pink HII regions strung along the arms.
    arms.forEach(([inner], arm) => {
      for (let i = 0; i < (spiral ? 70 : 40); i++) {
        const [px, py] = galaxyPoint(kind, arm, 0.12 + rnd() * 0.85);
        knot(c + (px + gauss() * 0.025) * R, c + (py + gauss() * 0.025) * R, rnd() < 0.6 ? HII_PINK : inner);
      }
    });

    // Bulge of old stars, brightest at the core.
    const bulge = spiral ? 0.075 : 0.06;
    for (let i = 0; i < 4000; i++) {
      dot(
        c + gauss() * R * bulge,
        c + gauss() * R * bulge,
        0.4 + rnd() * 0.8,
        mix(OLD_STARS, WARM, rnd()),
        0.06 + rnd() * 0.22,
      );
    }
    glow(c, c, R * (spiral ? 0.2 : 0.16), WARM, 0.62);
    glow(c, c, R * 0.045, WHITE, 0.7);
  } else if (kind === 'photos') {
    const amber: Rgb = [255, 232, 190];
    const rose: Rgb = [255, 190, 205];
    disk(1600, 0.2, [220, 210, 255], 0.03);
    for (let i = 0; i < 7000; i++) {
      const a = rnd() * Math.PI * 2;
      const r = R * (0.74 + gauss() * 0.04 + 0.018 * Math.sin(a * 5) + 0.01 * Math.sin(a * 11));
      const col = mix(mix(amber, rose, (Math.sin(a * 3) + 1) / 2), YOUNG_STARS, rnd() * 0.5);
      dot(c + r * Math.cos(a), c + r * Math.sin(a), 0.35 + rnd() * 1.05, col, 0.12 + rnd() * 0.5);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 900; i++) {
      const a = rnd() * Math.PI * 2;
      const r = R * (0.7 + gauss() * 0.012);
      dust(c + r * Math.cos(a), c + r * Math.sin(a), 1.2 + rnd() * 1.6, 0.06 + rnd() * 0.06);
    }
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 46; i++) {
      const a = rnd() * Math.PI * 2;
      knot(c + R * 0.75 * Math.cos(a), c + R * 0.75 * Math.sin(a), rnd() < 0.5 ? HII_PINK : YOUNG_STARS);
    }
    for (let i = 0; i < 2600; i++) {
      dot(c + gauss() * R * 0.065, c + gauss() * R * 0.065, 0.4 + rnd() * 0.8, OLD_STARS, 0.1 + rnd() * 0.35);
    }
    glow(c, c, R * 0.19, WARM, 0.7);
    glow(c, c, R * 0.04, WHITE, 0.7);
  } else {
    const palette: Rgb[] = [
      [196, 226, 255],
      [221, 214, 255],
      [255, 196, 222],
      [170, 220, 240],
      [255, 236, 200],
    ];
    const sigma = [0.22, 0.26, 0.15, 0.17, 0.12];
    disk(1400, 0.32, [210, 220, 245], 0.035);
    MOMENT_CLUMPS.forEach(([cx, cy], clump) => {
      glow(c + cx * R, c + cy * R, R * sigma[clump] * 1.8, palette[clump], 0.13);
      for (let i = 0; i < 1900; i++) {
        const x = c + (cx + gauss() * sigma[clump] * (0.8 + 0.4 * rnd())) * R;
        const y = c + (cy + gauss() * sigma[clump] * 0.75) * R;
        const col = mix(palette[(clump + (rnd() < 0.2 ? 1 : 0)) % palette.length], YOUNG_STARS, rnd() * 0.4);
        dot(x, y, 0.35 + rnd() * 1.05, col, 0.1 + rnd() * 0.5);
      }
      for (let i = 0; i < 12; i++) {
        knot(
          c + (cx + gauss() * sigma[clump] * 0.6) * R,
          c + (cy + gauss() * sigma[clump] * 0.6) * R,
          rnd() < 0.5 ? HII_PINK : palette[clump],
        );
      }
    });
  }
  ctx.globalCompositeOperation = 'source-over';
  bloom(canvas, ctx, 5 * k, 0.55);
}

export interface FieldStar {
  /** Distance from the centre, in units of the galaxy radius. */
  r: number;
  /** Angle at time 0, radians. */
  a: number;
  size: number;
  color: string;
  phase: number;
  twinkle: number;
}

/** A seeded set of disk stars spread like the galaxy's own light. */
export function createFieldStars(kind: GalaxyKind, count: number): FieldStar[] {
  const rnd = seeded(987654 + kind.length * 31);
  const tints = ['#ffffff', '#dbe9ff', '#ffe3c2', '#ffd1e3', '#cfe9ff'];
  return Array.from({ length: count }, () => {
    let r: number;
    if (kind === 'photos') r = rnd() < 0.7 ? 0.74 + (rnd() - 0.5) * 0.14 : rnd() * 0.25;
    else if (kind === 'moments') r = Math.sqrt(rnd()) * 0.62;
    else r = Math.min(0.98, -Math.log(1 - rnd() * 0.95) * 0.3 + 0.04);
    return {
      r,
      a: rnd() * Math.PI * 2,
      size: 0.5 + rnd() * rnd() * 1.6,
      color: tints[Math.floor(rnd() * tints.length)],
      phase: rnd() * Math.PI * 2,
      twinkle: 0.6 + rnd() * 2.2,
    };
  });
}

/**
 * Angle of a field star relative to the rigid pattern after `time` seconds of
 * "galaxy time". A flat rotation curve (ω ∝ 1/r) lets the inner disk overtake
 * the arms while the outer disk lags behind them.
 */
export function fieldStarAngle(star: FieldStar, time: number, patternSpeed: number): number {
  const orbital = (patternSpeed * 0.62) / Math.max(0.12, star.r);
  return star.a + (orbital - patternSpeed) * time;
}

export function drawFieldStars(
  canvas: HTMLCanvasElement,
  stars: readonly FieldStar[],
  time: number,
  twinkleTime: number,
  patternSpeed: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = canvas.width;
  const c = size / 2;
  const R = size * 0.46;
  const k = size / 600;
  ctx.clearRect(0, 0, size, size);
  for (const star of stars) {
    const angle = fieldStarAngle(star, time, patternSpeed);
    const x = c + star.r * R * Math.cos(angle);
    const y = c + star.r * R * Math.sin(angle);
    const alpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(twinkleTime * star.twinkle + star.phase)) ** 2;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = star.color;
    const s = star.size * k;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    if (star.size > 1.6 && alpha > 0.8) {
      // Faint diffraction spikes on the brightest, most "in focus" stars.
      ctx.globalAlpha = (alpha - 0.8) * 1.5;
      ctx.fillRect(x - s * 3, y - 0.25 * k, s * 6, 0.5 * k);
      ctx.fillRect(x - 0.25 * k, y - s * 3, 0.5 * k, s * 6);
    }
  }
  ctx.globalAlpha = 1;
}
