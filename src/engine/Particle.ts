/**
 * Particle, Shockwave, and Floating Combat Text System for AETHER: ECLIPSE.
 * Highly optimized, supports additive blending, custom shapes, and crisp damage numbers.
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
  isAdditive?: boolean;
  isSparkLine?: boolean;
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
  isCrit?: boolean;
}

export class ParticleSystem {
  public particles: Particle[] = [];
  public shockwaves: Shockwave[] = [];
  public floatingTexts: FloatingText[] = [];

  public update(dt: number) {
    // Update regular particles (using O(1) swap-and-pop removal instead of O(N) splice!)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        const last = this.particles.length - 1;
        if (i !== last) this.particles[i] = this.particles[last];
        this.particles.pop();
        continue;
      }
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.size += p.growth * dt * 60;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    }

    // Update shockwaves (swap-and-pop)
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life += dt;
      if (sw.life >= sw.maxLife) {
        const last = this.shockwaves.length - 1;
        if (i !== last) this.shockwaves[i] = this.shockwaves[last];
        this.shockwaves.pop();
        continue;
      }
      const progress = sw.life / sw.maxLife;
      sw.radius = sw.maxRadius * Math.sin((progress * Math.PI) / 2);
    }

    // Update floating combat text (swap-and-pop)
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.life += dt;
      if (ft.life >= ft.maxLife) {
        const last = this.floatingTexts.length - 1;
        if (i !== last) this.floatingTexts[i] = this.floatingTexts[last];
        this.floatingTexts.pop();
        continue;
      }
      ft.y += ft.vy * dt;
      ft.vy *= 0.92;
    }
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    const viewW = ctx.canvas.width;
    const viewH = ctx.canvas.height;

    // Render shockwaves (additive blending without expensive shadowBlur!)
    if (this.shockwaves.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const sw of this.shockwaves) {
        const sx = sw.x - cameraX;
        const sy = sw.y - cameraY;
        if (sx + sw.radius < 0 || sx - sw.radius > viewW || sy + sw.radius < 0 || sy - sw.radius > viewH) continue;

        const progress = sw.life / sw.maxLife;
        const alpha = 1 - progress;
        ctx.beginPath();
        ctx.arc(sx, sy, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = alpha;
        ctx.lineWidth = sw.width * (1 - progress * 0.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Render particles with frustum culling
    if (this.particles.length > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of this.particles) {
        const sx = p.x - cameraX;
        const sy = p.y - cameraY;
        if (sx < -20 || sx > viewW + 20 || sy < -20 || sy > viewH + 20) continue;

        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;

        if (p.isSparkLine && (Math.abs(p.vx) > 0.4 || Math.abs(p.vy) > 0.4)) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, p.size * 0.7);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx - p.vx * 2.4, sy - p.vy * 2.4);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(sx, sy, Math.max(0.5, p.size), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    // Render floating combat text (without per-text shadowBlur!)
    if (this.floatingTexts.length > 0) {
      ctx.save();
      ctx.textAlign = 'center';
      for (const ft of this.floatingTexts) {
        const sx = ft.x - cameraX;
        const sy = ft.y - cameraY;
        if (sx < -40 || sx > viewW + 40 || sy < -40 || sy > viewH + 40) continue;

        const progress = ft.life / ft.maxLife;
        const alpha = progress < 0.7 ? 1 : 1 - (progress - 0.7) / 0.3;
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.font = `800 ${ft.size}px "JetBrains Mono", monospace`;
        ctx.fillStyle = ft.color;
        ctx.fillText(ft.text, sx, sy);
      }
      ctx.restore();
    }
  }

  // --- SPAWN HELPER FUNCTIONS ---

  public emitDamageText(x: number, y: number, amount: number, isCrit: boolean = false) {
    if (this.floatingTexts.length > 45) return; // Cap for clean performance
    const rounded = Math.max(1, Math.round(amount));
    this.floatingTexts.push({
      x: x + (Math.random() - 0.5) * 16,
      y: y - 12,
      vy: isCrit ? -58 : -42,
      text: isCrit ? `${rounded}!` : `${rounded}`,
      color: isCrit ? '#fbbf24' : '#e2e8f0',
      size: isCrit ? 14 : 11,
      life: 0,
      maxLife: isCrit ? 0.65 : 0.48,
      isCrit
    });
  }

  public emitBannerText(x: number, y: number, text: string, color: string = '#38bdf8') {
    this.floatingTexts.push({
      x,
      y: y - 28,
      vy: -32,
      text,
      color,
      size: 14,
      life: 0,
      maxLife: 1.1,
      isCrit: true
    });
  }

  public emitSpark(x: number, y: number, color: string = '#00f3ff', count: number = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4.5 + 1.5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 2.5 + 1.5,
        color,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 0.3 + 0.2,
        friction: 0.92,
        growth: -0.05,
        isAdditive: true,
        isSparkLine: true
      });
    }
  }

  public emitDashTrail(x: number, y: number, color: string = '#00f3ff') {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 5 + 4,
      color,
      alpha: 0.7,
      life: 0,
      maxLife: 0.28,
      friction: 0.9,
      growth: -0.1,
      isAdditive: true
    });
  }

  public emitExplosion(x: number, y: number, color: string = '#ec4899', count: number = 24) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6.5 + 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 0.42 + 0.28,
        friction: 0.93,
        growth: -0.08,
        isAdditive: true,
        isSparkLine: i % 2 === 0
      });
    }

    this.shockwaves.push({
      x,
      y,
      radius: 0,
      maxRadius: 65,
      color,
      width: 4,
      life: 0,
      maxLife: 0.35
    });
  }

  public emitShockwave(x: number, y: number, maxRadius: number, color: string = '#00f3ff', width: number = 3) {
    this.shockwaves.push({
      x,
      y,
      radius: 0,
      maxRadius,
      color,
      width,
      life: 0,
      maxLife: 0.4
    });
  }

  public clear() {
    this.particles = [];
    this.shockwaves = [];
    this.floatingTexts = [];
  }
}
