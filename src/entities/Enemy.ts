import { Player } from './Player';
import { ParticleSystem } from '../engine/Particle';
import { Drop } from './Drop';
import { sound } from '../engine/Sound';

export type EnemyType =
  | 'mote'
  | 'stalker'
  | 'charger'
  | 'spitter'
  | 'phantom'
  | 'behemoth'
  | 'splitter'
  | 'leech'
  | 'eclipseOrb';

export interface EnemyProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  color: string;
  life: number;
  maxLife: number;
}

export class Enemy {
  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;
  public type: EnemyType;

  public hp: number;
  public maxHp: number;
  public speed: number;
  public radius: number;
  public damage: number;
  public color: string;
  public scoreValue: number;
  public xpValue: number;

  // Behavior timers
  public timer: number = 0;
  public isCharging: boolean = false;
  public chargeDir: { x: number; y: number } = { x: 0, y: 0 };
  public attackCooldown: number = 0;

  // Visuals
  public rotation: number = 0;
  public isIlluminated: boolean = false;
  public hitFlashTimer: number = 0;

  constructor(x: number, y: number, type: EnemyType, timeScaling: number = 1.0) {
    this.x = x;
    this.y = y;
    this.type = type;

    // Base stats per type
    switch (type) {
      case 'mote':
        this.maxHp = 18 * timeScaling;
        this.speed = 130;
        this.radius = 12;
        this.damage = 12;
        this.color = '#f43f5e'; // Pink/red geometric arrowhead
        this.scoreValue = 10;
        this.xpValue = 3;
        break;

      case 'stalker':
        this.maxHp = 30 * timeScaling;
        this.speed = 100;
        this.radius = 14;
        this.damage = 18;
        this.color = '#ec4899';
        this.scoreValue = 20;
        this.xpValue = 5;
        break;

      case 'charger':
        this.maxHp = 45 * timeScaling;
        this.speed = 90;
        this.radius = 16;
        this.damage = 25;
        this.color = '#f97316';
        this.scoreValue = 30;
        this.xpValue = 8;
        break;

      case 'spitter':
        this.maxHp = 25 * timeScaling;
        this.speed = 80;
        this.radius = 13;
        this.damage = 14;
        this.color = '#a855f7';
        this.scoreValue = 25;
        this.xpValue = 6;
        break;

      case 'phantom':
        this.maxHp = 35 * timeScaling;
        this.speed = 110;
        this.radius = 15;
        this.damage = 16;
        this.color = '#818cf8';
        this.scoreValue = 35;
        this.xpValue = 9;
        break;

      case 'behemoth':
        this.maxHp = 180 * timeScaling;
        this.speed = 55;
        this.radius = 26;
        this.damage = 35;
        this.color = '#e11d48';
        this.scoreValue = 60;
        this.xpValue = 20;
        break;

      case 'splitter':
        this.maxHp = 28 * timeScaling;
        this.speed = 105;
        this.radius = 14;
        this.damage = 15;
        this.color = '#fb7185';
        this.scoreValue = 22;
        this.xpValue = 6;
        break;

      case 'leech':
        this.maxHp = 22 * timeScaling;
        this.speed = 145;
        this.radius = 11;
        this.damage = 10;
        this.color = '#c084fc';
        this.scoreValue = 18;
        this.xpValue = 4;
        break;

      case 'eclipseOrb':
        this.maxHp = 50 * timeScaling;
        this.speed = 120;
        this.radius = 15;
        this.damage = 20;
        this.color = '#6366f1';
        this.scoreValue = 40;
        this.xpValue = 10;
        break;
    }

    this.hp = this.maxHp;
  }

  public takeDamage(amount: number, particles: ParticleSystem): boolean {
    this.hp -= amount;
    this.hitFlashTimer = 0.1;
    particles.emitSpark(this.x, this.y, '#ffffff', 4);

    if (this.hp <= 0) {
      sound.playEnemyDeath();
      particles.emitExplosion(this.x, this.y, this.color, 16);
      return true; // Defeated
    }
    return false;
  }

  public update(
    dt: number,
    player: Player,
    projectiles: EnemyProjectile[],
    particles: ParticleSystem
  ): void {
    this.timer += dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);

    // Check if within player's light radius
    const lightRadius = player.getLightRadius();
    this.isIlluminated = dist <= lightRadius + 20;

    // Phosphor Coat passive: burn illuminated enemies
    const phosphorLvl = player.passives.get('phosphorCoat') ?? 0;
    if (this.isIlluminated && phosphorLvl > 0) {
      this.hp -= phosphorLvl * 6 * dt;
    }

    // AI movement logic per type
    switch (this.type) {
      case 'mote':
      case 'splitter':
      case 'leech':
        // Direct swarm towards player
        if (dist > 5) {
          this.vx = (dx / dist) * this.speed;
          this.vy = (dy / dist) * this.speed;
          this.rotation = Math.atan2(dy, dx);
        }
        break;

      case 'stalker':
        // Lurk outside light, charge when illuminated!
        if (this.isIlluminated) {
          const lungeSpeed = this.speed * 1.8;
          this.vx = (dx / dist) * lungeSpeed;
          this.vy = (dy / dist) * lungeSpeed;
        } else {
          // Circle at boundary
          const angle = Math.atan2(dy, dx) + 0.03;
          const targetDist = lightRadius + 15;
          const tx = player.x - Math.cos(angle) * targetDist;
          const ty = player.y - Math.sin(angle) * targetDist;
          const tdx = tx - this.x;
          const tdy = ty - this.y;
          const tlen = Math.hypot(tdx, tdy);
          if (tlen > 5) {
            this.vx = (tdx / tlen) * this.speed;
            this.vy = (tdy / tlen) * this.speed;
          }
        }
        this.rotation = Math.atan2(dy, dx);
        break;

      case 'charger':
        if (!this.isCharging) {
          // Slowly track player
          this.vx = (dx / dist) * (this.speed * 0.5);
          this.vy = (dy / dist) * (this.speed * 0.5);
          this.rotation = Math.atan2(dy, dx);

          // Trigger charge every 3.5s
          this.attackCooldown += dt;
          if (this.attackCooldown >= 3.0 && dist < 320) {
            this.isCharging = true;
            this.attackCooldown = 0;
            this.chargeDir = { x: dx / dist, y: dy / dist };
            particles.emitSpark(this.x, this.y, '#f97316', 8);
          }
        } else {
          // Dash in charged direction
          this.vx = this.chargeDir.x * (this.speed * 2.6);
          this.vy = this.chargeDir.y * (this.speed * 2.6);
          this.attackCooldown += dt;
          if (this.attackCooldown > 0.8) {
            this.isCharging = false;
            this.attackCooldown = 0;
          }
        }
        break;

      case 'spitter':
        // Keep distance and shoot void bolts
        if (dist < 180) {
          // Retreat
          this.vx = -(dx / dist) * this.speed;
          this.vy = -(dy / dist) * this.speed;
        } else if (dist > 260) {
          // Approach
          this.vx = (dx / dist) * this.speed;
          this.vy = (dy / dist) * this.speed;
        } else {
          this.vx *= 0.8;
          this.vy *= 0.8;
        }
        this.rotation = Math.atan2(dy, dx);

        this.attackCooldown += dt;
        if (this.attackCooldown >= 2.4 && dist < 360) {
          this.attackCooldown = 0;
          // Shoot projectile
          const pSpeed = 160;
          projectiles.push({
            x: this.x,
            y: this.y,
            vx: (dx / dist) * pSpeed,
            vy: (dy / dist) * pSpeed,
            radius: 5,
            damage: this.damage,
            color: '#a855f7',
            life: 0,
            maxLife: 4.0
          });
          particles.emitSpark(this.x, this.y, '#a855f7', 6);
        }
        break;

      case 'phantom':
        // Sinuous undulating approach
        const wave = Math.sin(this.timer * 4) * 0.5;
        const pAngle = Math.atan2(dy, dx) + wave;
        this.vx = Math.cos(pAngle) * this.speed;
        this.vy = Math.sin(pAngle) * this.speed;
        this.rotation = pAngle;
        break;

      case 'behemoth':
        // Unstoppable slow advance
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.rotation = Math.atan2(dy, dx);
        break;

      case 'eclipseOrb':
        // Orbit around the player
        const orbAngle = this.timer * 1.5;
        const orbRadius = lightRadius * 0.8;
        const ox = player.x + Math.cos(orbAngle) * orbRadius;
        const oy = player.y + Math.sin(orbAngle) * orbRadius;
        this.vx = (ox - this.x) * 3;
        this.vy = (oy - this.y) * 3;
        this.rotation = orbAngle;
        break;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY;

    ctx.save();
    ctx.translate(screenX, screenY);
    ctx.rotate(this.rotation);

    // If outside light, render faint sinister outline/silhouette
    if (!this.isIlluminated) {
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1.5;
      this.drawShape(ctx, true);
      ctx.restore();
      return;
    }

    // Inside light: full vibrant sleek geometric rendering matching screenshots
    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 10;
    } else {
      ctx.fillStyle = this.color;
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 12;
    }

    this.drawShape(ctx, false);
    ctx.restore();
  }

  private drawShape(ctx: CanvasRenderingContext2D, outlineOnly: boolean) {
    const r = this.radius;

    ctx.beginPath();
    // Sleek arrowhead/triangle as seen in screenshots
    ctx.moveTo(r, 0);
    ctx.lineTo(-r * 0.8, -r * 0.7);
    ctx.lineTo(-r * 0.4, 0);
    ctx.lineTo(-r * 0.8, r * 0.7);
    ctx.closePath();

    if (outlineOnly) {
      ctx.stroke();
    } else {
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Central eye / core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-r * 0.1, 0, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
