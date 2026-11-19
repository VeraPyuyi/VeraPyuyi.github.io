/** Small drawing helpers shared by the megastructure scenes: glowing line art on deep space. */

export const PALETTE = {
  pink: '#f7a8c8',
  sky: '#b8e6fe',
  gold: '#ffd27a',
  amber: '#ffb35c',
  white: '#f4f2ff',
  violet: '#b9a6ff',
  hull: '#10132f',
} as const;

export function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

/** A soft round light. */
export function glow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, alpha = 1) {
  if (radius <= 0 || alpha <= 0) return;
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, rgba(color, alpha));
  gradient.addColorStop(0.35, rgba(color, alpha * 0.35));
  gradient.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

/** Stroke the current path twice, wide and faint then thin and bright, for a neon line. */
export function neon(ctx: CanvasRenderingContext2D, color: string, alpha = 1, width = 1.2) {
  ctx.strokeStyle = rgba(color, alpha * 0.22);
  ctx.lineWidth = width * 4;
  ctx.stroke();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = width;
  ctx.stroke();
}

export function ellipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  rotation = 0,
  start = 0,
  end = Math.PI * 2,
) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rotation, start, end);
}

/** A thin pointer line and a small caption for a highlighted item. */
export function tag(ctx: CanvasRenderingContext2D, x: number, y: number, text: string, color: string, toLeft = false) {
  const dx = toLeft ? -28 : 28;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dx * 0.6, y - 18);
  ctx.lineTo(x + dx * 1.6, y - 18);
  neon(ctx, color, 0.8, 0.8);
  ctx.globalCompositeOperation = 'source-over';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textAlign = toLeft ? 'right' : 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(PALETTE.white, 0.92);
  const label = text.length > 22 ? `${text.slice(0, 21)}…` : text;
  ctx.fillText(label, x + dx * 1.6 + (toLeft ? -6 : 6), y - 18);
  ctx.globalCompositeOperation = 'lighter';
}

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Points recorded during a draw so scenes can answer hit tests. */
export class HitList {
  private points: { x: number; y: number; r: number; index: number }[] = [];
  reset() {
    this.points = [];
  }
  add(index: number, x: number, y: number, r: number) {
    this.points.push({ x, y, r, index });
  }
  find(x: number, y: number): number {
    let best = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const point of this.points) {
      const distance = Math.hypot(point.x - x, point.y - y);
      if (distance <= point.r && distance < bestDistance) {
        best = point.index;
        bestDistance = distance;
      }
    }
    return best;
  }
}
