/**
 * Drops in AETHER: ECLIPSE:
 * - 'light': Restores current Light (health/vision/range)
 * - 'shard': Permanent currency for the Forge
 * Each comes in a small and a big variant. Regular enemies occasionally drop big ones,
 * bosses shower the arena with big drops.
 * Drops are drawn as crisp flat crystals (no glow) so they stay readable in busy fights.
 */
import { Balance } from '../engine/Balance';

export type DropType = 'light' | 'shard';
export type DropSize = 'small' | 'big';

export class Drop {
  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;
  public type: DropType;
  public size: DropSize;
  public value: number;
  public radius: number;
  public color: string;
  public life: number = 0;
  public maxLife: number;
  public isCollected: boolean = false;
  private spin: number = Math.random() * Math.PI * 2;

  constructor(x: number, y: number, type: DropType, value: number = 1, size: DropSize = 'small', scatter: number = 16) {
    // Drops burst outward a little so big showers (bosses) spread across the floor
    const a = Math.random() * Math.PI * 2;
    const burst = scatter > 16 ? 60 + Math.random() * scatter * 3 : 0;
    this.x = x + (Math.random() - 0.5) * Math.min(scatter, 16);
    this.y = y + (Math.random() - 0.5) * Math.min(scatter, 16);
    this.vx = Math.cos(a) * burst;
    this.vy = Math.sin(a) * burst;
    this.type = type;
    this.size = size;
    this.value = value;
    this.maxLife = size === 'big' ? 60 : 35;

    if (type === 'light') {
      this.radius = size === 'big' ? 7.5 : 4;
      this.color = size === 'big' ? '#22d3ee' : '#67e8f9';
    } else {
      this.radius = size === 'big' ? 7 : 4;
      this.color = size === 'big' ? '#f59e0b' : '#fbbf24';
    }
  }

  static light(x: number, y: number, size: DropSize, bonusMult: number = 1, scatter?: number): Drop {
    const base = size === 'big' ? Balance.bigLightValue : Balance.smallLightValue + Math.random() * 1.5;
    return new Drop(x, y, 'light', base * bonusMult, size, scatter);
  }

  static shard(x: number, y: number, size: DropSize, scatter?: number): Drop {
    return new Drop(x, y, 'shard', size === 'big' ? Balance.bigShardValue : 1, size, scatter);
  }

  public update(dt: number, playerX: number, playerY: number, magnetRadius: number): boolean {
    this.life += dt;
    this.spin += dt * (this.size === 'big' ? 1.6 : 2.4);
    if (this.life >= this.maxLife) {
      return false; // Despawn
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const distSq = dx * dx + dy * dy;
    const pickup = 18 + this.radius;

    if (distSq < pickup * pickup) {
      this.isCollected = true;
      return false;
    }

    // Big drops are pulled from further away
    const magnet = this.size === 'big' ? magnetRadius * 1.35 : magnetRadius;
    if (distSq < magnet * magnet) {
      const dist = Math.sqrt(distSq);
      const pullSpeed = 380 * (1 - dist / (magnet + 100)) + 140 + this.life * 8;
      this.vx = (dx / dist) * pullSpeed;
      this.vy = (dy / dist) * pullSpeed;
    } else {
      // Burst momentum fades quickly
      const f = Math.pow(0.02, dt);
      this.vx *= f;
      this.vy *= f;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    return true;
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;
    const r = this.radius;

    // Blink before despawning
    const remaining = this.maxLife - this.life;
    if (remaining < 4 && Math.floor(remaining * 6) % 2 === 0) return;

    ctx.save();
    ctx.translate(sx, sy);

    if (this.type === 'light') {
      // Faceted diamond crystal
      ctx.rotate(Math.sin(this.spin) * 0.35);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.35);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r * 1.35);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      this.strokeIfBig(ctx);
      // Darker right facet for a 3D look
      ctx.fillStyle = 'rgba(8, 47, 73, 0.45)';
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.35);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r * 1.35);
      ctx.closePath();
      ctx.fill();
    } else {
      // Hexagonal gold shard
      ctx.rotate(this.spin * 0.5);
      ctx.fillStyle = this.color;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      this.strokeIfBig(ctx);
      ctx.fillStyle = 'rgba(120, 53, 15, 0.4)';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let i = 0; i <= 2; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }

    // Small white highlight + dark outline on big drops for readability
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.35, Math.max(1, r * 0.22), 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private strokeIfBig(ctx: CanvasRenderingContext2D) {
    if (this.size !== 'big') return;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
}
