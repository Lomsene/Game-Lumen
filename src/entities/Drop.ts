/**
 * Drops in LUMEN:
 * - 'light': Restores current Light (health/vision/range)
 * - 'shard': Permanent currency for the Forge
 */

export type DropType = 'light' | 'shard';

export class Drop {
  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;
  public type: DropType;
  public value: number;
  public radius: number;
  public color: string;
  public life: number = 0;
  public maxLife: number = 40; // Despawns after 40s if not picked up
  public isCollected: boolean = false;

  constructor(x: number, y: number, type: DropType, value: number = 1) {
    this.x = x + (Math.random() - 0.5) * 16;
    this.y = y + (Math.random() - 0.5) * 16;
    this.type = type;
    this.value = value;

    if (type === 'light') {
      this.radius = 4 + Math.min(value * 0.2, 3);
      this.color = '#00f3ff';
    } else {
      this.radius = 4.5;
      this.color = '#fbbf24';
    }
  }

  public update(dt: number, playerX: number, playerY: number, magnetRadius: number): boolean {
    this.life += dt;
    if (this.life >= this.maxLife) {
      return false; // Despawn
    }

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);

    // Pickup check
    if (dist < 18) {
      this.isCollected = true;
      return false;
    }

    // Magnet attraction
    if (dist < magnetRadius) {
      const pullSpeed = 380 * (1 - dist / (magnetRadius + 100)) + 120;
      this.vx = (dx / dist) * pullSpeed;
      this.vy = (dy / dist) * pullSpeed;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    } else {
      // Gentle friction drift
      this.vx *= 0.92;
      this.vy *= 0.92;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    return true;
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY;

    // Bobbing / pulsation
    const pulse = 1 + Math.sin(this.life * 6) * 0.16;
    const r = this.radius * pulse;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Soft outer halo glow
    const grad = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, r * 2.8);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, this.color);
    grad.addColorStop(1, 'transparent');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(screenX, screenY, r * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(screenX, screenY, r * 0.55, 0, Math.PI * 2);
    ctx.fill();

    // Floating value number above light motes (matching screenshot 2!)
    if (this.type === 'light' && this.value >= 1) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.font = '600 10px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.72)';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(this.value)}`, screenX, screenY - r * 2.6 - 5);
    }

    ctx.restore();
  }
}
