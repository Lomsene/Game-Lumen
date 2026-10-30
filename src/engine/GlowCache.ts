/**
 * Pre-rendered radial glow sprites.
 * `ctx.shadowBlur` is a per-draw Gaussian blur and one of the most expensive Canvas2D
 * operations on mobile GPUs. Instead we render each (color, softness) glow once into a
 * small offscreen canvas and stamp it with drawImage, which is nearly free.
 */
const SPRITE_SIZE = 64;
const cache = new Map<string, HTMLCanvasElement>();

function createGlow(color: string, coreAlpha: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = SPRITE_SIZE;
  c.height = SPRITE_SIZE;
  const g = c.getContext('2d')!;
  const half = SPRITE_SIZE / 2;
  const grad = g.createRadialGradient(half, half, 0, half, half, half);
  grad.addColorStop(0, color);
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = coreAlpha;
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  return c;
}

/** Returns a cached glow sprite for a CSS color. */
export function getGlow(color: string, coreAlpha: number = 1): HTMLCanvasElement {
  const key = `${color}|${coreAlpha}`;
  let sprite = cache.get(key);
  if (!sprite) {
    sprite = createGlow(color, coreAlpha);
    cache.set(key, sprite);
  }
  return sprite;
}

/** Draws a soft glow of the given radius centered at (x, y). Respects ctx.globalAlpha. */
export function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, coreAlpha: number = 1) {
  if (radius <= 0.5) return;
  ctx.drawImage(getGlow(color, coreAlpha), x - radius, y - radius, radius * 2, radius * 2);
}

/** Glows are cosmetic: low quality mode can skip them entirely. */
export const glowSettings = { enabled: true };
