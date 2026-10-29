import { Player } from './Player';
import { ParticleSystem } from '../engine/Particle';
import { EnemyProjectile } from './Enemy';
import { Drop } from './Drop';
import { sound } from '../engine/Sound';

export class Boss {
  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;

  public id: number; // 1 = First Dark, 2 = Eclipse, 3 = Void Sovereign
  public name: string;
  public hp: number;
  public maxHp: number;
  public phase: number = 1;
  public maxPhases: number;
  public radius: number = 44;
  public color: string = '#ec4899';

  public timer: number = 0;
  public attackTimer: number = 0;
  public hitFlashTimer: number = 0;
  public invulnerableTimer: number = 0;
  public isDefeated: boolean = false;

  constructor(id: number, spawnX: number, spawnY: number) {
    this.id = id;
    this.x = spawnX;
    this.y = spawnY;

    // Balanced, exciting boss HP so the first boss is intense but fair!
    if (id === 1) {
      this.name = 'THE FIRST DARK';
      this.maxHp = 2200; // Tuned down from 3800 for a fair 2:00 fight
      this.maxPhases = 2;
      this.radius = 45;
      this.color = '#ec4899';
    } else if (id === 2) {
      this.name = 'THE ECLIPSE';
      this.maxHp = 5200; // Tuned down from 8500
      this.maxPhases = 2;
      this.radius = 52;
      this.color = '#8b5cf6';
    } else {
      this.name = 'THE VOID SOVEREIGN';
      this.maxHp = 11500; // Tuned down from 18000
      this.maxPhases = 3;
      this.radius = 60;
      this.color = '#f43f5e';
    }

    this.hp = this.maxHp;
    sound.playBossAlarm();
  }

  public takeDamage(amount: number, particles: ParticleSystem, isCrit: boolean = false): boolean {
    if (this.invulnerableTimer > 0) {
      particles.emitSpark(this.x, this.y, '#ffffff', 2);
      return false;
    }

    this.hp -= amount;
    this.hitFlashTimer = 0.08;
    particles.emitSpark(this.x, this.y, isCrit ? '#fbbf24' : '#ffffff', isCrit ? 8 : 5);
    if (amount >= 2) {
      particles.emitDamageText(this.x, this.y - this.radius * 0.6, amount, isCrit);
    }

    // Epic Phase transitions with 1.5s invulnerability and massive shockwave
    if (this.id === 1 && this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.invulnerableTimer = 1.5;
      particles.emitShockwave(this.x, this.y, 350, this.color, 8);
      particles.emitExplosion(this.x, this.y, this.color, 40);
      sound.playBossAlarm();
    } else if (this.id === 2 && this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      this.invulnerableTimer = 1.5;
      particles.emitShockwave(this.x, this.y, 400, this.color, 8);
      particles.emitExplosion(this.x, this.y, this.color, 45);
      sound.playBossAlarm();
    } else if (this.id === 3) {
      if (this.phase === 1 && this.hp <= this.maxHp * 0.66) {
        this.phase = 2;
        this.invulnerableTimer = 1.5;
        particles.emitShockwave(this.x, this.y, 450, this.color, 8);
        sound.playBossAlarm();
      } else if (this.phase === 2 && this.hp <= this.maxHp * 0.33) {
        this.phase = 3;
        this.invulnerableTimer = 1.5;
        particles.emitShockwave(this.x, this.y, 500, '#ffffff', 10);
        sound.playBossAlarm();
      }
    }

    if (this.hp <= 0) {
      this.isDefeated = true;
      particles.emitExplosion(this.x, this.y, this.color, 70);
      particles.emitShockwave(this.x, this.y, 600, '#00f3ff', 10);
      sound.playEnemyDeath();
      return true;
    }
    return false;
  }

  public update(
    dt: number,
    player: Player,
    projectiles: EnemyProjectile[],
    particles: ParticleSystem,
    drops: Drop[]
  ) {
    this.timer += dt;
    this.attackTimer += dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Movement: boss tracks player steadily
    const baseSpeed = this.id === 1 ? 65 : this.id === 2 ? 80 : 95;
    const speed = this.phase > 1 ? baseSpeed * 1.3 : baseSpeed;

    if (dist > 80) {
      this.vx = (dx / dist) * speed;
      this.vy = (dy / dist) * speed;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    // Boss Arena Clamping
    const distCenter = Math.hypot(this.x, this.y);
    const maxBound = Player.ARENA_RADIUS - this.radius;
    if (distCenter > maxBound) {
      const a = Math.atan2(this.y, this.x);
      this.x = Math.cos(a) * maxBound;
      this.y = Math.sin(a) * maxBound;
    }

    // Boss Attacks
    if (this.id === 1) {
      // The First Dark: Fires rings of shadow orbs + minion summons in phase 2
      const interval = this.phase === 1 ? 2.4 : 1.6;
      if (this.attackTimer >= interval) {
        this.attackTimer = 0;
        const count = this.phase === 1 ? 10 : 16;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + this.timer;
          projectiles.push({
            x: this.x,
            y: this.y,
            vx: Math.cos(angle) * 155,
            vy: Math.sin(angle) * 155,
            radius: 8,
            damage: 20,
            color: '#ec4899',
            life: 0,
            maxLife: 4.5
          });
        }
        particles.emitShockwave(this.x, this.y, 110, '#ec4899', 4);
      }
    } else if (this.id === 2) {
      // The Eclipse: Spawns spiral bullets and laser pulses
      if (this.attackTimer >= 1.4) {
        this.attackTimer = 0;
        const count = 14;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + this.timer * 2;
          projectiles.push({
            x: this.x,
            y: this.y,
            vx: Math.cos(angle) * 180,
            vy: Math.sin(angle) * 180,
            radius: 8,
            damage: 24,
            color: '#8b5cf6',
            life: 0,
            maxLife: 4.5
          });
        }
      }
    } else if (this.id === 3) {
      // The Void Sovereign: Fast multi-directional streams
      const interval = this.phase === 3 ? 0.75 : 1.1;
      if (this.attackTimer >= interval) {
        this.attackTimer = 0;
        const count = this.phase === 3 ? 20 : 14;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + Math.sin(this.timer);
          projectiles.push({
            x: this.x,
            y: this.y,
            vx: Math.cos(angle) * 200,
            vy: Math.sin(angle) * 200,
            radius: 8,
            damage: 28,
            color: '#f43f5e',
            life: 0,
            maxLife: 5.0
          });
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY;

    // 1. 3D Floor Shadow
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 16, this.radius * 1.15, this.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Floating bob
    const floatZ = Math.sin(this.timer * 3) * 4;

    ctx.save();
    ctx.translate(screenX, screenY - floatZ);

    // Glowing aura
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 35;

    const pulse = 1 + Math.sin(this.timer * 5) * 0.08;
    const r = this.radius * pulse;

    // Outer rotating faceted geometric rings
    ctx.strokeStyle = this.invulnerableTimer > 0 ? '#ffffff' : this.color;
    ctx.lineWidth = 3.5;
    ctx.save();
    ctx.rotate(this.timer * 0.8);
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();

    ctx.save();
    ctx.rotate(-this.timer * 1.2);
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = Math.cos(a) * (r * 1.15);
      const py = Math.sin(a) * (r * 1.15);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();

    // Inner core with 3D gradient
    ctx.fillStyle = this.hitFlashTimer > 0 ? '#ffffff' : this.color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.fill();

    // Dark void center
    ctx.fillStyle = '#030712';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Inner glowing demonic eye
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  public dropRewards(drops: Drop[]) {
    const shardCount = this.id === 1 ? 35 : this.id === 2 ? 75 : 150;
    for (let i = 0; i < shardCount; i++) {
      drops.push(new Drop(this.x, this.y, 'shard', 1));
    }
    for (let i = 0; i < 20; i++) {
      drops.push(new Drop(this.x, this.y, 'light', 15));
    }
  }
}
