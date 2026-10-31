import { Player } from './Player';
import { ParticleSystem } from '../engine/Particle';
import { Drop } from './Drop';
import { sound } from '../engine/Sound';
import { runStats } from '../meta/RunStats';

export type EnemyType =
  | 'mote'
  | 'stalker'
  | 'charger'
  | 'spitter'
  | 'scatterer'
  | 'sniper'
  | 'mortar'
  | 'vanguard'
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
  isPiercing?: boolean;
}

export interface MortarZone {
  x: number;
  y: number;
  radius: number;
  damage: number;
  timer: number;
  maxTime: number;
}

export interface VoidObelisk {
  x: number;
  y: number;
  radius: number;
  charge: number;
  maxCharge: number;
  animTimer: number;
  spawnGuardTimer: number;
}

export interface ShadowRift {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
  animTimer: number;
}

export interface SolarBurnZone {
  x: number;
  y: number;
  radius: number;
  damagePerSec: number;
  life: number;
  maxLife: number;
  sourceId: string; // Damage attribution for run statistics
}

export class Enemy {
  /** Render detail set by the renderer: 2 = full, 1 = no trails, 0 = no trails & halos. */
  static detail: number = 2;
  /** Body fill while hit-flashing; softened under WebGL bloom so packed swarms don't wash out to white. */
  static flashFill: string = '#ffffff';
  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;
  public type: EnemyType;
  public isElite: boolean = false;

  public hp: number;
  public maxHp: number;
  public speed: number;
  public radius: number;
  public damage: number;
  public color: string;
  public scoreValue: number;
  public xpValue: number;

  // Behavior & Attack timers
  public timer: number = 0;
  public attackCooldown: number = 0;
  public isCharging: boolean = false;
  public chargeWindupTimer: number = 0;
  public chargeDir: { x: number; y: number } = { x: 0, y: 0 };

  // Sniper aim tracking
  public sniperAimTimer: number = 0;
  public isAimingSniper: boolean = false;
  public sniperTargetPos: { x: number; y: number } = { x: 0, y: 0 };

  // Vanguard Shield & Leech Stolen Light
  public hasShield: boolean = false;
  public stolenLight: number = 0;
  public slowTimer: number = 0;

  // Death is resolved once by the game loop (prevents double rewards / explosions)
  public dead: boolean = false;
  // Knockback is kept separate from AI velocity so it is not overwritten every frame
  public knockVx: number = 0;
  public knockVy: number = 0;
  // Continuous damage (beams, auras, burn) is summed up into readable numbers
  private pendingTickDmg: number = 0;
  private tickTextTimer: number = 0;

  // Visuals & Smooth Motion Animation
  public rotation: number = 0;
  public targetRotation: number = 0;
  public isIlluminated: boolean = false;
  public hitFlashTimer: number = 0;
  public floatZ: number = 0;
  public trailHistory: Array<{ x: number; y: number }> = [];
  private trailTick: number = 0;
  public animPhase: number = Math.random() * Math.PI * 2;
  public bankAngle: number = 0;

  constructor(
    x: number,
    y: number,
    type: EnemyType,
    hpScaling: number = 1.0,
    isElite: boolean = false,
    speedScaling: number = 1.0,
    damageScaling: number = 1.0
  ) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.isElite = isElite;

    // Hardcore HP & Damage Balancing: Enemies hit harder and survive longer!
    switch (type) {
      case 'mote':
        this.maxHp = 34 * hpScaling;
        this.speed = 148 * speedScaling;
        this.radius = 12;
        this.damage = 16;
        this.color = '#f43f5e';
        this.scoreValue = 12;
        this.xpValue = 3;
        break;

      case 'splitter':
        this.maxHp = 75 * hpScaling;
        this.speed = 124 * speedScaling;
        this.radius = 15;
        this.damage = 22;
        this.color = '#fb7185';
        this.scoreValue = 24;
        this.xpValue = 6;
        break;

      case 'stalker':
        this.maxHp = 98 * hpScaling;
        this.speed = 122 * speedScaling;
        this.radius = 14;
        this.damage = 25;
        this.color = '#ec4899';
        this.scoreValue = 28;
        this.xpValue = 7;
        break;

      case 'charger':
        this.maxHp = 195 * hpScaling;
        this.speed = 108 * speedScaling;
        this.radius = 17;
        this.damage = 36;
        this.color = '#f97316';
        this.scoreValue = 40;
        this.xpValue = 10;
        break;

      case 'spitter':
        this.maxHp = 88 * hpScaling;
        this.speed = 96 * speedScaling;
        this.radius = 14;
        this.damage = 22;
        this.color = '#a855f7';
        this.scoreValue = 32;
        this.xpValue = 7;
        break;

      case 'scatterer':
        this.maxHp = 120 * hpScaling;
        this.speed = 92 * speedScaling;
        this.radius = 16;
        this.damage = 24;
        this.color = '#d946ef';
        this.scoreValue = 42;
        this.xpValue = 9;
        break;

      case 'sniper':
        this.maxHp = 70 * hpScaling;
        this.speed = 82 * speedScaling;
        this.radius = 13;
        this.damage = 42;
        this.color = '#ef4444';
        this.scoreValue = 48;
        this.xpValue = 10;
        break;

      case 'mortar':
        this.maxHp = 180 * hpScaling;
        this.speed = 74 * speedScaling;
        this.radius = 18;
        this.damage = 40;
        this.color = '#eab308';
        this.scoreValue = 52;
        this.xpValue = 11;
        break;

      case 'vanguard':
        this.maxHp = 320 * hpScaling;
        this.speed = 82 * speedScaling;
        this.radius = 20;
        this.damage = 30;
        this.color = '#06b6d4';
        this.scoreValue = 65;
        this.xpValue = 15;
        this.hasShield = true;
        break;

      case 'phantom':
        this.maxHp = 110 * hpScaling;
        this.speed = 134 * speedScaling;
        this.radius = 15;
        this.damage = 24;
        this.color = '#818cf8';
        this.scoreValue = 40;
        this.xpValue = 9;
        break;

      case 'behemoth':
        this.maxHp = 680 * hpScaling;
        this.speed = 68 * speedScaling;
        this.radius = 28;
        this.damage = 48;
        this.color = '#e11d48';
        this.scoreValue = 95;
        this.xpValue = 24;
        break;

      case 'leech':
        this.maxHp = 62 * hpScaling;
        this.speed = 172 * speedScaling;
        this.radius = 12;
        this.damage = 16;
        this.color = '#c084fc';
        this.scoreValue = 25;
        this.xpValue = 6;
        break;

      case 'eclipseOrb':
        this.maxHp = 140 * hpScaling;
        this.speed = 142 * speedScaling;
        this.radius = 16;
        this.damage = 28;
        this.color = '#6366f1';
        this.scoreValue = 50;
        this.xpValue = 12;
        break;
    }

    // Elite Champion bonuses
    if (this.isElite) {
      this.maxHp *= 3.0;
      this.radius *= 1.35;
      this.damage *= 1.25;
      this.scoreValue *= 3.5;
      this.xpValue *= 3;
    }

    this.damage *= damageScaling;
    this.hp = this.maxHp;
  }

  public applyKnockback(kx: number, ky: number) {
    const resist = this.type === 'behemoth' ? 0.3 : this.isElite ? 0.55 : 1;
    this.knockVx += kx * resist;
    this.knockVy += ky * resist;
  }

  /**
   * Applies damage. Returns true only on the hit that kills the enemy.
   * `isTick` marks continuous damage (beams/auras/burn): no sparks, numbers are batched.
   */
  public takeDamage(
    amount: number,
    particles: ParticleSystem,
    hitOrigin?: { x: number; y: number },
    isCrit: boolean = false,
    isTick: boolean = false
  ): boolean {
    if (this.dead) return false;
    let effectiveDmg = amount;

    // Vanguard frontal shield deflection
    if (this.hasShield && hitOrigin) {
      const hitAngle = Math.atan2(hitOrigin.y - this.y, hitOrigin.x - this.x);
      const angleDiff = Math.abs(Math.atan2(Math.sin(hitAngle - this.rotation), Math.cos(hitAngle - this.rotation)));
      if (angleDiff < Math.PI * 0.45) {
        effectiveDmg *= 0.2; // 80% deflection on frontal hits!
        if (!isTick) particles.emitSpark(this.x, this.y, '#06b6d4', 4);
      }
    }

    runStats.recordDamage(Math.min(effectiveDmg, Math.max(0, this.hp)));
    this.hp -= effectiveDmg;
    this.hitFlashTimer = 0.1;
    if (isTick) {
      this.pendingTickDmg += effectiveDmg;
    } else {
      particles.emitSpark(this.x, this.y, isCrit ? '#fbbf24' : '#ffffff', isCrit ? 5 : 3);
      if (effectiveDmg >= 2) {
        particles.emitDamageText(this.x, this.y - this.radius, effectiveDmg, isCrit);
      }
    }

    return this.checkDeath(particles);
  }

  /** Marks the enemy dead once HP hits zero. Returns true exactly once. */
  public checkDeath(particles: ParticleSystem): boolean {
    if (this.dead || this.hp > 0) return false;
    this.dead = true;
    sound.playEnemyDeath();
    particles.emitExplosion(this.x, this.y, this.color, this.isElite ? 28 : 12);
    return true;
  }

  public update(
    dt: number,
    player: Player,
    projectiles: EnemyProjectile[],
    mortarZones: MortarZone[],
    particles: ParticleSystem,
    projectileSpeedBonus: number = 1.0,
    lightRadius: number = player.getLightRadius()
  ): void {
    this.timer += dt;
    this.floatZ = Math.sin(this.timer * 4.5 + this.x * 0.05) * 2.8;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

    // Flush batched tick damage as one readable number
    this.tickTextTimer += dt;
    if (this.tickTextTimer >= 0.35) {
      if (this.pendingTickDmg >= 1) {
        particles.emitDamageText(this.x, this.y - this.radius, this.pendingTickDmg, false);
      }
      this.pendingTickDmg = 0;
      this.tickTextTimer = 0;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 0.001;

    // Light illumination check (inside light = weapon range & illuminated bloom)
    this.isIlluminated = dist <= lightRadius + 15;

    // Phosphor Coat burn (scales with weapon damage multiplier so it stays relevant)
    const phosphorLvl = player.passives.get('phosphorCoat') ?? 0;
    if (this.isIlluminated && phosphorLvl > 0) {
      this.takeDamage(phosphorLvl * 6 * dt * player.getDamageMultiplier(), particles, undefined, false, true);
    }

    // AI logic by archetype
    switch (this.type) {
      case 'mote':
      case 'splitter':
      case 'leech':
        if (dist > 5) {
          this.vx = (dx / dist) * this.speed;
          this.vy = (dy / dist) * this.speed;
          this.rotation = Math.atan2(dy, dx);
        }
        break;

      case 'stalker':
        if (this.isIlluminated) {
          const lungeSpeed = this.speed * 1.7;
          this.vx = (dx / dist) * lungeSpeed;
          this.vy = (dy / dist) * lungeSpeed;
        } else {
          const angle = Math.atan2(dy, dx) + 0.035;
          const targetDist = lightRadius + 30;
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
        if (this.chargeWindupTimer > 0) {
          this.chargeWindupTimer -= dt;
          this.vx = 0;
          this.vy = 0;
          if (this.chargeWindupTimer <= 0) {
            this.isCharging = true;
            this.attackCooldown = 0;
            particles.emitSpark(this.x, this.y, '#f97316', 12);
          }
        } else if (!this.isCharging) {
          this.vx = (dx / dist) * (this.speed * 0.6);
          this.vy = (dy / dist) * (this.speed * 0.6);
          this.rotation = Math.atan2(dy, dx);

          this.attackCooldown += dt;
          if (this.attackCooldown >= 3.2 && dist < 340) {
            this.chargeWindupTimer = 0.45;
            this.chargeDir = { x: dx / dist, y: dy / dist };
            this.rotation = Math.atan2(dy, dx);
          }
        } else {
          this.vx = this.chargeDir.x * (this.speed * 2.8);
          this.vy = this.chargeDir.y * (this.speed * 2.8);
          this.attackCooldown += dt;
          if (this.attackCooldown > 0.8) {
            this.isCharging = false;
            this.attackCooldown = 0;
          }
        }
        break;

      case 'spitter':
        this.handleKiting(dx, dy, dist, 180, 270);
        this.rotation = Math.atan2(dy, dx);
        this.attackCooldown += dt;
        if (this.attackCooldown >= 2.0 && dist < 400) {
          this.attackCooldown = 0;
          const pSpeed = 195 * projectileSpeedBonus;
          // Predictive lead aiming based on player's velocity!
          const leadTime = Math.min(0.85, dist / pSpeed) * 0.65;
          const aimX = player.x + player.vx * leadTime - this.x;
          const aimY = player.y + player.vy * leadTime - this.y;
          const aimLen = Math.hypot(aimX, aimY) || 1;
          projectiles.push({
            x: this.x,
            y: this.y,
            vx: (aimX / aimLen) * pSpeed,
            vy: (aimY / aimLen) * pSpeed,
            radius: this.isElite ? 7 : 5.5,
            damage: this.damage,
            color: '#a855f7',
            life: 0,
            maxLife: 4.2
          });
          particles.emitSpark(this.x, this.y, '#a855f7', 6);
          sound.playShoot(400, 0.08);
        }
        break;

      case 'scatterer':
        this.handleKiting(dx, dy, dist, 190, 280);
        this.rotation = Math.atan2(dy, dx);
        this.attackCooldown += dt;
        if (this.attackCooldown >= 2.8 && dist < 380) {
          this.attackCooldown = 0;
          const baseAngle = Math.atan2(dy, dx);
          const pSpeed = 160 * projectileSpeedBonus;
          const spreadAngles = this.isElite ? [-0.4, -0.2, 0, 0.2, 0.4] : [-0.25, 0, 0.25];

          for (const sa of spreadAngles) {
            const a = baseAngle + sa;
            projectiles.push({
              x: this.x,
              y: this.y,
              vx: Math.cos(a) * pSpeed,
              vy: Math.sin(a) * pSpeed,
              radius: 5,
              damage: this.damage,
              color: '#d946ef',
              life: 0,
              maxLife: 3.8
            });
          }
          particles.emitSpark(this.x, this.y, '#d946ef', 10);
          sound.playShoot(550, 0.1);
        }
        break;

      case 'sniper':
        this.handleKiting(dx, dy, dist, 280, 420);
        this.rotation = Math.atan2(dy, dx);
        this.attackCooldown += dt;

        if (!this.isAimingSniper && this.attackCooldown >= 3.6 && dist < 500) {
          this.isAimingSniper = true;
          this.sniperAimTimer = 1.1;
          this.sniperTargetPos = { x: player.x, y: player.y };
        }

        if (this.isAimingSniper) {
          this.sniperAimTimer -= dt;
          if (this.sniperAimTimer > 0.3) {
            this.sniperTargetPos = { x: player.x, y: player.y };
          }
          if (this.sniperAimTimer <= 0) {
            this.isAimingSniper = false;
            this.attackCooldown = 0;

            const tdx = this.sniperTargetPos.x - this.x;
            const tdy = this.sniperTargetPos.y - this.y;
            const tlen = Math.hypot(tdx, tdy) || 1;
            const pSpeed = 620 * projectileSpeedBonus;

            projectiles.push({
              x: this.x,
              y: this.y,
              vx: (tdx / tlen) * pSpeed,
              vy: (tdy / tlen) * pSpeed,
              radius: 6,
              damage: this.damage,
              color: '#ef4444',
              life: 0,
              maxLife: 2.5,
              isPiercing: true
            });
            particles.emitShockwave(this.x, this.y, 40, '#ef4444', 3);
            sound.playShoot(950, 0.15);
          }
        }
        break;

      case 'mortar':
        this.handleKiting(dx, dy, dist, 220, 340);
        this.rotation = Math.atan2(dy, dx);
        this.attackCooldown += dt;
        if (this.attackCooldown >= 4.0 && dist < 420) {
          this.attackCooldown = 0;
          mortarZones.push({
            x: player.x,
            y: player.y,
            radius: this.isElite ? 75 : 55,
            damage: this.damage,
            timer: 0,
            maxTime: 1.3
          });
          particles.emitSpark(this.x, this.y, '#eab308', 8);
          sound.playShoot(320, 0.2);
        }
        break;

      case 'vanguard':
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.rotation = Math.atan2(dy, dx);
        break;

      case 'phantom':
        const wave = Math.sin(this.timer * 4) * 0.5;
        const pAngle = Math.atan2(dy, dx) + wave;
        this.vx = Math.cos(pAngle) * this.speed;
        this.vy = Math.sin(pAngle) * this.speed;
        this.rotation = pAngle;
        break;

      case 'behemoth':
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.rotation = Math.atan2(dy, dx);
        break;

      case 'eclipseOrb':
        const orbAngle = this.timer * 1.5;
        const orbRadius = lightRadius * 0.8;
        const ox = player.x + Math.cos(orbAngle) * orbRadius;
        const oy = player.y + Math.sin(orbAngle) * orbRadius;
        this.vx = (ox - this.x) * 3;
        this.vy = (oy - this.y) * 3;
        this.rotation = orbAngle;
        break;
    }

    const moveMult = this.slowTimer > 0 ? 0.62 : 1.0;
    if (this.slowTimer > 0) this.slowTimer -= dt;

    this.x += (this.vx * moveMult + this.knockVx) * dt;
    this.y += (this.vy * moveMult + this.knockVy) * dt;
    const knockDecay = Math.pow(0.002, dt);
    this.knockVx *= knockDecay;
    this.knockVy *= knockDecay;

    // Smooth angular rotation & banking animation
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 8 && this.type !== 'eclipseOrb') {
      const desiredRot = Math.atan2(this.vy, this.vx);
      const rotDiff = Math.atan2(Math.sin(desiredRot - this.rotation), Math.cos(desiredRot - this.rotation));
      this.rotation += rotDiff * Math.min(1, dt * 10);
      this.bankAngle += (rotDiff * 0.45 - this.bankAngle) * Math.min(1, dt * 8);
    }

    // Add gentle weaving oscillation perpendicular to movement for natural fluid motion
    if (speed > 20 && !this.isCharging && !this.isAimingSniper) {
      const perpX = -this.vy / speed;
      const perpY = this.vx / speed;
      const weave = Math.cos(this.timer * 5.5 + this.animPhase) * 18;
      this.x += perpX * weave * dt;
      this.y += perpY * weave * dt;
    }

    // Record motion trail history every 2nd tick to halve allocations
    this.trailTick = (this.trailTick + 1) & 1;
    if (this.trailTick === 0) {
      if (this.trailHistory.length < 5) {
        this.trailHistory.unshift({ x: this.x, y: this.y });
      } else {
        const reused = this.trailHistory.pop()!;
        reused.x = this.x;
        reused.y = this.y;
        this.trailHistory.unshift(reused);
      }
    }

    // Clamp strictly within circular arena
    const distCenter = Math.hypot(this.x, this.y);
    const maxBound = Player.ARENA_RADIUS - this.radius;
    if (distCenter > maxBound) {
      const a = Math.atan2(this.y, this.x);
      this.x = Math.cos(a) * maxBound;
      this.y = Math.sin(a) * maxBound;
    }
  }

  private handleKiting(dx: number, dy: number, dist: number, minDist: number, maxDist: number) {
    if (dist < minDist) {
      this.vx = -(dx / dist) * this.speed;
      this.vy = -(dy / dist) * this.speed;
    } else if (dist > maxDist) {
      this.vx = (dx / dist) * this.speed;
      this.vy = (dy / dist) * this.speed;
    } else {
      this.vx *= 0.85;
      this.vy *= 0.85;
    }
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY;

    // 1. Sniper Aim Laser Telegraph
    if (this.isAimingSniper) {
      ctx.save();
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = this.sniperAimTimer < 0.3 ? 2.5 : 1.2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(this.sniperTargetPos.x - cameraX, this.sniperTargetPos.y - cameraY);
      ctx.stroke();
      ctx.restore();
    }

    // 2. Charger Rush Arrow Telegraph
    if (this.chargeWindupTimer > 0) {
      ctx.save();
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2.5;
      const arrowLen = 140;
      ctx.beginPath();
      ctx.moveTo(screenX, screenY);
      ctx.lineTo(screenX + this.chargeDir.x * arrowLen, screenY + this.chargeDir.y * arrowLen);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Motion Afterimage Trail
    if (Enemy.detail >= 2 && this.trailHistory.length > 2) {
      ctx.save();
      for (let i = 1; i < this.trailHistory.length; i++) {
        const pt = this.trailHistory[i];
        const alpha = (1 - i / this.trailHistory.length) * (this.isIlluminated ? 0.22 : 0.1);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(pt.x - cameraX, pt.y - cameraY, this.radius * 0.35 * (1 - i / this.trailHistory.length), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 4. Render Entity floating at screenY - floatZ
    ctx.save();
    ctx.translate(screenX, screenY - this.floatZ * 0.4);

    // Elite Champion Aura (fast additive double-ring without expensive shadowBlur!)
    if (this.isElite) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      const pulse = 1 + Math.sin(this.timer * 6) * 0.12;
      ctx.beginPath();
      ctx.arc(0, 0, (this.radius + 7) * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const sway = Math.sin(this.timer * 6.5 + this.animPhase) * 0.07;
    ctx.rotate(this.rotation + sway);

    // Dynamic stretch & wing breathe
    const stretch = 1 + Math.sin(this.timer * 8 + this.animPhase) * 0.05;
    const bankScale = 1 - Math.min(0.22, Math.abs(this.bankAngle));
    ctx.scale(stretch, bankScale / stretch);

    const isLit = this.isIlluminated;
    const isFlashing = this.hitFlashTimer > 0;

    this.drawDistinctGeometry(ctx, isLit, isFlashing);

    // Vanguard Frontal Shield Arc
    if (this.hasShield) {
      ctx.save();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();

    // 5. Mini Enemy HP Bar (Rendered when damaged or if Elite)
    if (this.hp < this.maxHp || this.isElite) {
      const barW = Math.max(26, this.radius * 2.0);
      const barH = 4;
      const barX = screenX - barW / 2;
      const barY = screenY - this.floatZ * 0.4 - this.radius - 10;
      const hpRatio = Math.max(0, Math.min(1, this.hp / this.maxHp));

      ctx.save();
      ctx.fillStyle = 'rgba(7, 13, 29, 0.88)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

      ctx.strokeStyle = this.isElite ? '#fbbf24' : 'rgba(56, 189, 248, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX - 1, barY - 1, barW + 2, barH + 2);

      let fillColor = '#10b981';
      if (hpRatio < 0.3) {
        fillColor = '#ef4444';
      } else if (hpRatio < 0.6) {
        fillColor = '#f59e0b';
      }

      ctx.fillStyle = fillColor;
      ctx.fillRect(barX, barY, barW * hpRatio, barH);
      ctx.restore();
    }
  }

  /**
   * Renders unique, distinctive geometric shapes for all 13 enemy types
   * using ultra-fast additive glow strokes instead of per-entity Gaussian shadowBlur!
   */
  private drawDistinctGeometry(ctx: CanvasRenderingContext2D, isLit: boolean, isFlashing: boolean) {
    const r = this.radius;
    const baseColor = isFlashing ? '#ffffff' : this.color;

    ctx.save();

    // Fast outer halo glow circle (skipped on low quality)
    if (Enemy.detail >= 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = baseColor;
      ctx.globalAlpha = isLit ? 0.16 : 0.08;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    if (isLit) {
      ctx.fillStyle = isFlashing ? Enemy.flashFill : 'rgba(244, 63, 94, 0.22)';
      ctx.strokeStyle = isFlashing ? '#ffffff' : baseColor;
      ctx.lineWidth = 2.0;
    } else {
      // In darkness: glowing wireframe silhouette with inner core dot matching screenshot 2!
      ctx.fillStyle = 'rgba(15, 10, 28, 0.55)';
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = 0.75;
    }

    switch (this.type) {
      // 1. MOTE: Sleek Dart / Arrowhead with central glowing core dot (exact match to screenshot 2!)
      case 'mote': {
        const wingFlap = Math.sin(this.timer * 10 + this.animPhase) * 0.08;
        ctx.beginPath();
        ctx.moveTo(r * 1.25, 0); // Sharp nose
        ctx.lineTo(-r * 0.85, -r * (0.85 + wingFlap)); // Top swept wingtip
        ctx.lineTo(-r * 0.38, 0); // Rear notch
        ctx.lineTo(-r * 0.85, r * (0.85 + wingFlap)); // Bottom swept wingtip
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Central glowing core dot
        ctx.fillStyle = isFlashing ? '#ffffff' : baseColor;
        ctx.beginPath();
        ctx.arc(-r * 0.05, 0, 2.2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      // 2. SPLITTER: Segmented Pentagon with dual splitting seam
      case 'splitter': {
        const sides = 5;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Split seam
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(0, r);
        ctx.stroke();
        break;
      }

      // 3. STALKER: Curved stealth crescent / boomerang with dual forward fangs
      case 'stalker': {
        ctx.beginPath();
        ctx.moveTo(r * 1.1, 0);
        ctx.lineTo(-r * 0.5, -r * 0.9);
        ctx.lineTo(-r * 0.2, -r * 0.3);
        ctx.lineTo(-r * 0.7, 0);
        ctx.lineTo(-r * 0.2, r * 0.3);
        ctx.lineTo(-r * 0.5, r * 0.9);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      // 4. CHARGER: Heavy Wedge / Ram with layered 3D beveled plates
      case 'charger': {
        ctx.beginPath();
        ctx.moveTo(r * 1.25, 0);
        ctx.lineTo(-r * 0.9, -r * 0.85);
        ctx.lineTo(-r * 0.45, 0);
        ctx.lineTo(-r * 0.9, r * 0.85);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner armor ridge
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(r * 0.6, 0);
        ctx.lineTo(-r * 0.4, -r * 0.4);
        ctx.moveTo(r * 0.6, 0);
        ctx.lineTo(-r * 0.4, r * 0.4);
        ctx.stroke();
        break;
      }

      // 5. SPITTER: 3D Faceted Octahedron Crystal with center eye
      case 'spitter': {
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(0, -r * 0.8);
        ctx.lineTo(-r, 0);
        ctx.lineTo(0, r * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Diagonal facet lines for 3D crystal look
        ctx.strokeStyle = isLit ? 'rgba(255, 255, 255, 0.8)' : baseColor;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(r, 0);
        ctx.lineTo(-r, 0);
        ctx.moveTo(0, -r * 0.8);
        ctx.lineTo(0, r * 0.8);
        ctx.stroke();
        break;
      }

      // 6. SCATTERER: 4-Pointed Shuriken Star with faceted wings
      case 'scatterer': {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const rad = i % 2 === 0 ? r * 1.15 : r * 0.45;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      // 7. SNIPER: Elongated needle/dart with stabilizer fins
      case 'sniper': {
        ctx.beginPath();
        ctx.moveTo(r * 1.6, 0); // Long nose
        ctx.lineTo(-r * 0.7, -r * 0.5);
        ctx.lineTo(-r * 0.4, 0);
        ctx.lineTo(-r * 0.7, r * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glowing targeting scope dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(r * 0.8, 0, 2.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      // 8. MORTAR: Heavy Octagonal Turret Fortress with cannon mouth
      case 'mortar': {
        const sides = 8;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Cannon hole
        ctx.fillStyle = '#030712';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      // 9. VANGUARD: Heavy trapezoidal shield fortress
      case 'vanguard': {
        ctx.beginPath();
        ctx.moveTo(r * 0.6, -r * 0.9);
        ctx.lineTo(r * 0.6, r * 0.9);
        ctx.lineTo(-r * 0.8, r * 0.6);
        ctx.lineTo(-r * 0.8, -r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }

      // 10. PHANTOM: Floating double-rhombus with spectral inner diamond
      case 'phantom': {
        ctx.save();
        ctx.globalAlpha = isLit ? 0.9 : 0.6;
        ctx.beginPath();
        ctx.moveTo(r * 1.2, 0);
        ctx.lineTo(0, -r * 0.7);
        ctx.lineTo(-r * 1.2, 0);
        ctx.lineTo(0, r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }

      // 11. BEHEMOTH: 12-sided Dodecagonal Fortress with multi-layer armor plates
      case 'behemoth': {
        const sides = 12;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
          const a = (i / sides) * Math.PI * 2;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner armor ring
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      // 12. LEECH: Tri-hook spinning turbine
      case 'leech': {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2);
          ctx.lineTo(Math.cos(a + 0.5) * r * 0.6, Math.sin(a + 0.5) * r * 0.6);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
        break;
      }

      // 13. ECLIPSE ORB: Shaded sphere with orbital perimeter ring
      default: {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-r * 0.9, -r * 0.9, r * 1.8, r * 1.8);
        break;
      }
    }

    ctx.restore();
  }
}
