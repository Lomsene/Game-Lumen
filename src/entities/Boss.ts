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
  public isDefeated: boolean = false;

  constructor(id: number, spawnX: number, spawnY: number) {
    this.id = id;
    this.x = spawnX;
    this.y = spawnY;

    if (id === 1) {
      this.name = 'THE FIRST DARK';
      this.maxHp = 650;
      this.maxPhases = 2;
      this.radius = 42;
      this.color = '#ec4899';
    } else if (id === 2) {
      this.name = 'THE ECLIPSE';
      this.maxHp = 1400;
      this.maxPhases = 2;
      this.radius = 50;
      this.color = '#8b5cf6';
    } else {
      this.name = 'THE VOID SOVEREIGN';
      this.maxHp = 2800;
      this.maxPhases = 3;
      this.radius = 58;
      this.color = '#f43f5e';
    }

    this.hp = this.maxHp;
    sound.playBossAlarm();
  }

  public takeDamage(amount: number, particles: ParticleSystem): boolean {
    this.hp -= amount;
    this.hitFlashTimer = 0.1;
    particles.emitSpark(this.x, this.y, '#ffffff', 5);

    // Phase transitions
    if (this.id === 1 && this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      particles.emitShockwave(this.x, this.y, 200, this.color, 6);
      sound.playBossAlarm();
    } else if (this.id === 2 && this.phase === 1 && this.hp <= this.maxHp * 0.5) {
      this.phase = 2;
      particles.emitShockwave(this.x, this.y, 250, this.color, 6);
      sound.playBossAlarm();
    } else if (this.id === 3) {
      if (this.phase === 1 && this.hp <= this.maxHp * 0.66) {
        this.phase = 2;
        particles.emitShockwave(this.x, this.y, 300, this.color, 6);
        sound.playBossAlarm();
      } else if (this.phase === 2 && this.hp <= this.maxHp * 0.33) {
        this.phase = 3;
        particles.emitShockwave(this.x, this.y, 350, '#ffffff', 8);
        sound.playBossAlarm();
      }
    }

    if (this.hp <= 0) {
      this.isDefeated = true;
      particles.emitExplosion(this.x, this.y, this.color, 50);
      particles.emitShockwave(this.x, this.y, 400, '#00f3ff', 8);
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

    // Boss Attacks
    if (this.id === 1) {
      // The First Dark: Fires rings of shadow orbs
      const interval = this.phase === 1 ? 2.5 : 1.8;
      if (this.attackTimer >= interval) {
        this.attackTimer = 0;
        const count = this.phase === 1 ? 8 : 14;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + this.timer;
          projectiles.push({
            x: this.x,
            y: this.y,
            vx: Math.cos(angle) * 140,
            vy: Math.sin(angle) * 140,
            radius: 7,
            damage: 18,
            color: '#ec4899',
            life: 0,
            maxLife: 4.5
          });
        }
        particles.emitShockwave(this.x, this.y, 100, '#ec4899', 4);
      }
    } else if (this.id === 2) {
      // The Eclipse: Spawns spiral bullets and laser pulses
      if (this.attackTimer >= 1.5) {
        this.attackTimer = 0;
        const count = 12;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + this.timer * 2;
          projectiles.push({
            x: this.x,
            y: this.y,
            vx: Math.cos(angle) * 170,
            vy: Math.sin(angle) * 170,
            radius: 8,
            damage: 22,
            color: '#8b5cf6',
            life: 0,
            maxLife: 4.5
          });
        }
      }
    } else if (this.id === 3) {
      // The Void Sovereign: Fast multi-directional streams
      const interval = this.phase === 3 ? 0.8 : 1.2;
      if (this.attackTimer >= interval) {
        this.attackTimer = 0;
        const count = this.phase === 3 ? 18 : 12;
        for (let i = 0; i < count; i++) {
          const angle = (i / count) * Math.PI * 2 + Math.sin(this.timer);
          projectiles.push({
            x: this.x,
            y: this.y,
            vx: Math.cos(angle) * 190,
            vy: Math.sin(angle) * 190,
            radius: 8,
            damage: 26,
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

    ctx.save();
    ctx.translate(screenX, screenY);

    // Glowing aura
    ctx.globalCompositeOperation = 'lighter';
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 30;

    const pulse = 1 + Math.sin(this.timer * 5) * 0.1;
    const r = this.radius * pulse;

    // Outer rotating spikes
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.save();
    ctx.rotate(this.timer);
    ctx.strokeRect(-r, -r, r * 2, r * 2);
    ctx.restore();

    // Inner core
    ctx.fillStyle = this.hitFlashTimer > 0 ? '#ffffff' : this.color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // Dark void center
    ctx.fillStyle = '#030712';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  public dropRewards(drops: Drop[]) {
    // Generous reward on boss defeat!
    const shardCount = this.id === 1 ? 30 : this.id === 2 ? 60 : 120;
    for (let i = 0; i < shardCount; i++) {
      drops.push(new Drop(this.x, this.y, 'shard', 1));
    }
    for (let i = 0; i < 15; i++) {
      drops.push(new Drop(this.x, this.y, 'light', 10));
    }
  }
}
