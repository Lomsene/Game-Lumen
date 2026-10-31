/**
 * Particle, Shockwave, and Floating Combat Text System for AETHER: ECLIPSE.
 * Uses object pools (no per-frame allocations -> no GC hitches on mobile) and a
 * quality-dependent particle budget.
 */

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  maxLife: number;
  life: number;
  friction: number;
  growth: number;
  isSparkLine: boolean;
}

export interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  width: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  isCrit: boolean;
}

const fontCache = new Map<number, string>();

/** Cached font strings: building one per floating text every frame churns the GC. */
function textFont(size: number): string {
  let f = fontCache.get(size);
  if (!f) {
    f = `800 ${size}px "JetBrains Mono", monospace`;
    fontCache.set(size, f);
  }
  return f;
}

export class ParticleSystem {
  public particles: Particle[] = [];
  public shockwaves: Shockwave[] = [];
  public floatingTexts: FloatingText[] = [];

  private particlePool: Particle[] = [];
  private shockwavePool: Shockwave[] = [];
  private textPool: FloatingText[] = [];

  /** Max live particles; lowered by the renderer on weaker devices. */
  public maxParticles: number = 900;
  /** Multiplier for emitted particle counts (quality setting). */
  public density: number = 1;
  public showDamageNumbers: boolean = true;

  /** Logical viewport size for culling (set by renderer). */
  public viewW: number = window.innerWidth;
  public viewH: number = window.innerHeight;

  public update(dt: number) {
    const step = dt * 60;
    // Swap-and-pop removal (O(1)) with recycling into the pools
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        const last = this.particles.length - 1;
        if (i !== last) this.particles[i] = this.particles[last];
        this.particles.pop();
        this.particlePool.push(p);
        continue;
      }
      const f = Math.pow(p.friction, step);
      p.vx *= f;
      p.vy *= f;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.size += p.growth * step;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life += dt;
      if (sw.life >= sw.maxLife) {
        const last = this.shockwaves.length - 1;
        if (i !== last) this.shockwaves[i] = this.shockwaves[last];
        this.shockwaves.pop();
        this.shockwavePool.push(sw);
        continue;
      }
      const t = sw.life / sw.maxLife;
      // Ease-out expansion
      sw.radius = sw.maxRadius * (1 - (1 - t) * (1 - t));
    }

    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      if (ft.life >= ft.maxLife) {
        const last = this.floatingTexts.length - 1;
        if (i !== last) this.floatingTexts[i] = this.floatingTexts[last];
        this.floatingTexts.pop();
        this.textPool.push(ft);
        continue;
      }
      ft.y += ft.vy * dt;
      ft.vy *= Math.pow(0.92, step);
    }
  }

  /** Shockwaves and particles (part of the lit scene). */
  public renderEffects(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    const viewW = this.viewW;
    const viewH = this.viewH;

    if (this.shockwaves.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const sw of this.shockwaves) {
        const sx = sw.x - cameraX;
        const sy = sw.y - cameraY;
        if (sx + sw.radius < 0 || sx - sw.radius > viewW || sy + sw.radius < 0 || sy - sw.radius > viewH) continue;
        const progress = sw.life / sw.maxLife;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(0.1, sw.radius), 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = 1 - progress;
        ctx.lineWidth = sw.width * (1 - progress * 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (this.particles.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const p of this.particles) {
        const sx = p.x - cameraX;
        const sy = p.y - cameraY;
        if (sx < -20 || sx > viewW + 20 || sy < -20 || sy > viewH + 20) continue;

        ctx.globalAlpha = p.alpha;
        if (p.isSparkLine && (Math.abs(p.vx) > 0.4 || Math.abs(p.vy) > 0.4)) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, p.size * 0.7);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - p.vx * 2.4, sy - p.vy * 2.4);
          ctx.stroke();
        } else {
          // Squares are much cheaper than arcs and look identical at this size
          const s = Math.max(1, p.size);
          ctx.fillStyle = p.color;
          ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
        }
      }
      ctx.restore();
    }

  }

  /** Floating combat text, drawn on the unlit overlay layer so it is never darkened. */
  public renderTexts(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    const viewW = this.viewW;
    const viewH = this.viewH;
    if (this.floatingTexts.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.85)';
      let currentFont = '';
      for (const ft of this.floatingTexts) {
        const sx = ft.x - cameraX;
        const sy = ft.y - cameraY;
        if (sx < -120 || sx > viewW + 120 || sy < -40 || sy > viewH + 40) continue;

        const progress = ft.life / ft.maxLife;
        const alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
        ctx.globalAlpha = Math.max(0, alpha);
        const font = textFont(ft.size);
        if (font !== currentFont) {
          ctx.font = font;
          currentFont = font;
        }
        // Dark outline keeps numbers readable on bright effects
        ctx.strokeText(ft.text, sx, sy);
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, sx, sy);
      }
      ctx.restore();
    }
  }

  // --- SPAWN HELPER FUNCTIONS ---

  private spawnParticle(): Particle | null {
    if (this.particles.length >= this.maxParticles) return null;
    const p = this.particlePool.pop() ?? ({} as Particle);
    this.particles.push(p);
    return p;
  }

  private scaled(count: number): number {
    const n = count * this.density;
    // Keep fractional counts statistically correct
    return Math.floor(n) + (Math.random() < n - Math.floor(n) ? 1 : 0);
  }

  private pushText(x: number, y: number, vy: number, text: string, color: string, size: number, maxLife: number, isCrit: boolean) {
    const ft = this.textPool.pop() ?? ({} as FloatingText);
    ft.x = x;
    ft.y = y;
    ft.vy = vy;
    ft.text = text;
    ft.color = color;
    ft.size = size;
    ft.life = 0;
    ft.maxLife = maxLife;
    ft.isCrit = isCrit;
    this.floatingTexts.push(ft);
  }

  public emitDamageText(x: number, y: number, amount: number, isCrit: boolean = false) {
    if (!this.showDamageNumbers) return;
    if (this.floatingTexts.length > 40) return; // Cap for readability & performance
    const rounded = Math.max(1, Math.round(amount));
    const text = rounded >= 10000 ? `${(rounded / 1000).toFixed(0)}k` : `${rounded}`;
    this.pushText(
      x + (Math.random() - 0.5) * 16,
      y - 12,
      isCrit ? -58 : -42,
      isCrit ? `${text}!` : text,
      isCrit ? '#fbbf24' : '#e2e8f0',
      isCrit ? 14 : 11,
      isCrit ? 0.65 : 0.48,
      isCrit
    );
  }

  public emitBannerText(x: number, y: number, text: string, color: string = '#38bdf8') {
    this.pushText(x, y - 28, -32, text, color, 14, 1.3, true);
  }

  public emitSpark(x: number, y: number, color: string = '#00f3ff', count: number = 8) {
    const n = this.scaled(count);
    for (let i = 0; i < n; i++) {
      const p = this.spawnParticle();
      if (!p) return;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 1.5;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = Math.random() * 2.5 + 1.5;
      p.color = color;
      p.alpha = 1;
      p.life = 0;
      p.maxLife = Math.random() * 0.3 + 0.2;
      p.friction = 0.92;
      p.growth = -0.05;
      p.isSparkLine = true;
    }
  }

  public emitDashTrail(x: number, y: number, color: string = '#00f3ff') {
    const p = this.spawnParticle();
    if (!p) return;
    p.x = x + (Math.random() - 0.5) * 10;
    p.y = y + (Math.random() - 0.5) * 10;
    p.vx = (Math.random() - 0.5) * 0.5;
    p.vy = (Math.random() - 0.5) * 0.5;
    p.size = Math.random() * 5 + 4;
    p.color = color;
    p.alpha = 0.7;
    p.life = 0;
    p.maxLife = 0.28;
    p.friction = 0.9;
    p.growth = -0.1;
    p.isSparkLine = false;
  }

  public emitExplosion(x: number, y: number, color: string = '#ec4899', count: number = 24) {
    const n = this.scaled(count);
    for (let i = 0; i < n; i++) {
      const p = this.spawnParticle();
      if (!p) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6.5 + 2;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed;
      p.size = Math.random() * 4 + 2;
      p.color = color;
      p.alpha = 1;
      p.life = 0;
      p.maxLife = Math.random() * 0.42 + 0.28;
      p.friction = 0.93;
      p.growth = -0.08;
      p.isSparkLine = i % 2 === 0;
    }
    this.emitShockwave(x, y, 65, color, 4, 0.35);
  }

  public emitShockwave(x: number, y: number, maxRadius: number, color: string = '#00f3ff', width: number = 3, maxLife: number = 0.4) {
    if (this.shockwaves.length > 60) return;
    const sw = this.shockwavePool.pop() ?? ({} as Shockwave);
    sw.x = x;
    sw.y = y;
    sw.radius = 0;
    sw.maxRadius = maxRadius;
    sw.color = color;
    sw.width = width;
    sw.life = 0;
    sw.maxLife = maxLife;
    this.shockwaves.push(sw);
  }

  public clear() {
    this.particlePool.push(...this.particles);
    this.shockwavePool.push(...this.shockwaves);
    this.textPool.push(...this.floatingTexts);
    this.particles.length = 0;
    this.shockwaves.length = 0;
    this.floatingTexts.length = 0;
  }
}
