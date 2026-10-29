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
    const pulse = 1 + Math.sin(this.life * 6) * 0.2;
    const r = this.radius * pulse;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = this.color;

    ctx.beginPath();
    ctx.arc(screenX, screenY, r, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(screenX, screenY, r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
