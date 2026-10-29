/**
 * Particle and Visual Effects System for LUMEN.
 * Highly optimized, supports additive blending and custom shapes.
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

export class ParticleSystem {
  public particles: Particle[] = [];
  public shockwaves: Shockwave[] = [];

  public update(dt: number) {
    // Update regular particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx * dt * 60;
      p.y += p.vy * dt * 60;
      p.size += p.growth * dt * 60;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    }

    // Update shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life += dt;
      if (sw.life >= sw.maxLife) {
        this.shockwaves.splice(i, 1);
        continue;
      }
      const progress = sw.life / sw.maxLife;
      sw.radius = sw.maxRadius * Math.sin((progress * Math.PI) / 2);
    }
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    // Render shockwaves
    for (const sw of this.shockwaves) {
      const progress = sw.life / sw.maxLife;
      const alpha = 1 - progress;
      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x - cameraX, sw.y - cameraY, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = sw.width * (1 - progress * 0.5);
      ctx.stroke();
      ctx.restore();
    }

    // Render particles
    ctx.save();
    for (const p of this.particles) {
      if (p.isAdditive) {
        ctx.globalCompositeOperation = 'lighter';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - cameraX, p.y - cameraY, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- SPAWN HELPER FUNCTIONS ---

  public emitSpark(x: number, y: number, color: string = '#00f3ff', count: number = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1.5;
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
        isAdditive: true
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
      const speed = Math.random() * 6 + 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color,
        alpha: 1,
        life: 0,
        maxLife: Math.random() * 0.4 + 0.3,
        friction: 0.94,
        growth: -0.08,
        isAdditive: true
      });
    }

    this.shockwaves.push({
      x,
      y,
      radius: 0,
      maxRadius: 60,
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
  }
}
