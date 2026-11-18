/**
 * Canvas painter for the homepage galaxies (browser only).
 * Draws a face-on galaxy with additive blending; rotation and tilt are CSS.
 * Deterministic: the same kind always produces the same picture.
 */
import { type GalaxyKind, galaxyPoint, MOMENT_CLUMPS } from './galaxy';

type Rgb = readonly [number, number, number];

const WARM: Rgb = [255, 241, 196];
const WHITE: Rgb = [255, 255, 255];

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
    ctx.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(x, y, radius * k, 0, Math.PI * 2);
    ctx.fill();
  };
  const glow = (x: number, y: number, radius: number, col: Rgb, alpha: number) => {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${col.join(',')},${alpha})`);
    gradient.addColorStop(1, `rgba(${col.join(',')},0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  };
  const knot = (x: number, y: number, col: Rgb) => {
    glow(x, y, (4 + rnd() * 6) * k, col, 0.35);
    dot(x, y, 1.3, WHITE, 0.85);
  };

  ctx.clearRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';

  if (kind === 'blogs') {
    const arms: [Rgb, Rgb][] = [
      [
        [252, 206, 232],
        [233, 83, 106],
      ],
      [
        [184, 230, 254],
        [57, 162, 219],
      ],
    ];
    glow(c, c, R * 0.5, [255, 220, 230], 0.28);
    for (let i = 0; i < 2600; i++) {
      const r = R * Math.abs(gauss()) * 0.42;
      const a = rnd() * Math.PI * 2;
      dot(c + r * Math.cos(a), c + r * Math.sin(a), 0.6 + rnd() * 0.7, [220, 214, 255], 0.05 + rnd() * 0.1);
    }
    arms.forEach(([inner, outer], arm) => {
      for (let i = 0; i < 4600; i++) {
        const t = rnd() ** 0.8;
        const [px, py] = galaxyPoint('blogs', arm, t);
        const spread = 0.03 + 0.08 * t;
        const angle = Math.atan2(py, px);
        const x = c + (px + gauss() * spread * Math.cos(angle) * 0.9 + gauss() * spread * 0.5) * R;
        const y = c + (py + gauss() * spread * Math.sin(angle) * 0.9 + gauss() * spread * 0.5) * R;
        dot(
          x,
          y,
          0.5 + rnd() * 1.3,
          mix(inner, outer, Math.min(1, t * 1.1 + rnd() * 0.25)),
          (0.22 + rnd() * 0.6) * (1 - t * 0.4),
        );
      }
      for (let i = 0; i < 46; i++) {
        const [px, py] = galaxyPoint('blogs', arm, 0.15 + rnd() * 0.8);
        knot(c + (px + gauss() * 0.03) * R, c + (py + gauss() * 0.03) * R, inner);
      }
    });
    for (let i = 0; i < 2200; i++) dot(c + gauss() * R * 0.085, c + gauss() * R * 0.085, 0.6 + rnd(), WARM, 0.12 + rnd() * 0.3);
    glow(c, c, R * 0.16, WARM, 0.85);
  } else if (kind === 'papers') {
    const gold: Rgb = [255, 210, 122];
    const rose: Rgb = [252, 206, 232];
    glow(c, c, R * 0.55, gold, 0.18);
    for (let i = 0; i < 2600; i++) {
      let g = gauss();
      while (Math.abs(g) > 1.8) g = gauss();
      dot(c + g * R * 0.2, c + gauss() * R * 0.045, 0.6 + rnd() * 0.9, mix(WARM, gold, rnd()), 0.18 + rnd() * 0.45);
    }
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < 2600; i++) {
        const t = rnd();
        const [px, py] = galaxyPoint('papers', arm, t);
        const spread = 0.03 + 0.06 * t;
        dot(
          c + (px + gauss() * spread) * R,
          c + (py + gauss() * spread) * R,
          0.5 + rnd() * 1.2,
          mix(gold, rose, Math.min(1, t * 0.9 + rnd() * 0.2)),
          (0.16 + rnd() * 0.5) * (1 - t * 0.4),
        );
      }
      for (let i = 0; i < 26; i++) {
        const [px, py] = galaxyPoint('papers', arm, rnd());
        knot(c + (px + gauss() * 0.03) * R, c + (py + gauss() * 0.03) * R, gold);
      }
    }
    glow(c, c, R * 0.14, [255, 245, 220], 0.9);
  } else if (kind === 'photos') {
    const amber: Rgb = [254, 243, 198];
    const rose: Rgb = [254, 205, 211];
    for (let i = 0; i < 700; i++) {
      const r = R * (0.12 + rnd() * 0.5);
      const a = rnd() * Math.PI * 2;
      dot(c + r * Math.cos(a), c + r * Math.sin(a), 0.6, [230, 220, 255], 0.04 + rnd() * 0.05);
    }
    for (let i = 0; i < 4200; i++) {
      const a = rnd() * Math.PI * 2;
      const r = R * (0.74 + gauss() * 0.045 + 0.02 * Math.sin(a * 5));
      dot(
        c + r * Math.cos(a),
        c + r * Math.sin(a),
        0.5 + rnd() * 1.2,
        mix(amber, rose, (Math.sin(a * 3) + 1) / 2),
        0.15 + rnd() * 0.55,
      );
    }
    for (let i = 0; i < 30; i++) {
      const a = rnd() * Math.PI * 2;
      knot(c + R * 0.74 * Math.cos(a), c + R * 0.74 * Math.sin(a), amber);
    }
    for (let i = 0; i < 1400; i++) dot(c + gauss() * R * 0.07, c + gauss() * R * 0.07, 0.6 + rnd(), WARM, 0.15 + rnd() * 0.4);
    glow(c, c, R * 0.18, [255, 236, 200], 0.9);
  } else {
    const palette: Rgb[] = [
      [184, 230, 254],
      [221, 214, 255],
      [252, 206, 232],
      [160, 220, 240],
      [255, 241, 196],
    ];
    const sigma = [0.22, 0.26, 0.15, 0.17, 0.12];
    MOMENT_CLUMPS.forEach(([cx, cy], clump) => {
      glow(c + cx * R, c + cy * R, R * sigma[clump] * 1.6, palette[clump], 0.16);
      for (let i = 0; i < 1100; i++) {
        const x = c + (cx + gauss() * sigma[clump] * (0.8 + 0.4 * rnd())) * R;
        const y = c + (cy + gauss() * sigma[clump] * 0.75) * R;
        dot(x, y, 0.5 + rnd() * 1.2, palette[(clump + (rnd() < 0.2 ? 1 : 0)) % palette.length], 0.12 + rnd() * 0.5);
      }
      for (let i = 0; i < 8; i++) {
        knot(c + (cx + gauss() * sigma[clump] * 0.6) * R, c + (cy + gauss() * sigma[clump] * 0.6) * R, palette[clump]);
      }
    });
  }
  ctx.globalCompositeOperation = 'source-over';
}
