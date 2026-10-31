import { Player } from './Player';
import { ParticleSystem } from '../engine/Particle';
import { EnemyProjectile, MortarZone } from './Enemy';
import { Drop } from './Drop';
import { sound } from '../engine/Sound';
import { runStats } from '../meta/RunStats';
import { Balance } from '../engine/Balance';
import { drawGlow } from '../engine/GlowCache';

/**
 * Endless boss chain.
 * Boss #n has Balance.bossHp(n) HP (x2.5 per boss), more phases and a growing,
 * rotating set of abilities, so every boss fights differently from the one before.
 */
export type BossAbility = 'ring' | 'spiral' | 'fan' | 'summon' | 'charge' | 'mortar' | 'rift' | 'cross';

interface BossArchetype {
  name: string;
  color: string;
  shape: 'square' | 'hex' | 'star' | 'tri';
  abilities: BossAbility[];
}

const ARCHETYPES: BossArchetype[] = [
  { name: 'THE FIRST DARK', color: '#ec4899', shape: 'square', abilities: ['ring', 'summon'] },
  { name: 'THE ECLIPSE', color: '#8b5cf6', shape: 'hex', abilities: ['spiral', 'fan', 'charge'] },
  { name: 'THE VOID SOVEREIGN', color: '#f43f5e', shape: 'star', abilities: ['ring', 'mortar', 'cross', 'summon'] },
  { name: 'THE HOLLOW STAR', color: '#f97316', shape: 'tri', abilities: ['fan', 'charge', 'rift', 'spiral'] },
  { name: 'THE NIGHT WEAVER', color: '#22d3ee', shape: 'hex', abilities: ['cross', 'spiral', 'mortar', 'summon'] },
  { name: 'THE LIGHT EATER', color: '#a3e635', shape: 'star', abilities: ['ring', 'charge', 'rift', 'fan', 'mortar'] }
];

const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];

/** Spawn requests the boss hands back to the game (minions, rifts). */
export interface BossSpawnRequests {
  minions: Array<{ x: number; y: number }>;
  rifts: Array<{ x: number; y: number }>;
}

export class Boss {
  public x: number;
  public y: number;
  public vx: number = 0;
  public vy: number = 0;

  public bossNumber: number;
  public name: string;
  public hp: number;
  public maxHp: number;
  public phase: number = 1;
  public maxPhases: number;
  public radius: number;
  public color: string;
  private shape: BossArchetype['shape'];
  private abilities: BossAbility[];
  private abilityIndex: number = 0;
  private dmgScale: number;
  private baseSpeed: number;

  public timer: number = 0;
  public attackTimer: number = 0;
  public hitFlashTimer: number = 0;
  public invulnerableTimer: number = 0;
  public isDefeated: boolean = false;

  // Charge ability state
  private chargeWindup: number = 0;
  private chargeTime: number = 0;
  private chargeDir: { x: number; y: number } = { x: 0, y: 0 };
  public isCharging: boolean = false;

  // Accumulated tick damage for readable damage numbers
  private pendingTickDmg: number = 0;
  private tickTextTimer: number = 0;

  constructor(bossNumber: number, spawnX: number, spawnY: number) {
    this.bossNumber = bossNumber;
    this.x = spawnX;
    this.y = spawnY;

    const archetypeIdx = (bossNumber - 1) % ARCHETYPES.length;
    const cycle = Math.floor((bossNumber - 1) / ARCHETYPES.length) + 1;
    const arch = ARCHETYPES[archetypeIdx];

    this.name = arch.name + (ROMAN[cycle] ?? ` ${cycle}`);
    this.color = arch.color;
    this.shape = arch.shape;
    // Later cycles add the abilities of the next archetype on top
    const extra = cycle > 1 ? ARCHETYPES[(archetypeIdx + 1) % ARCHETYPES.length].abilities : [];
    this.abilities = Array.from(new Set([...arch.abilities, ...extra]));

    this.maxHp = Balance.bossHp(bossNumber);
    this.hp = this.maxHp;
    this.maxPhases = Math.min(4, 2 + Math.floor((bossNumber - 1) / 2));
    this.radius = Math.min(72, 44 + bossNumber * 3);
    this.dmgScale = Balance.bossDamageScale(bossNumber);
    this.baseSpeed = Math.min(120, 62 + bossNumber * 7);

    sound.playBossAlarm();
  }

  public takeDamage(amount: number, particles: ParticleSystem, isCrit: boolean = false, isTick: boolean = false): boolean {
    if (this.isDefeated) return false;
    if (this.invulnerableTimer > 0) {
      if (!isTick) particles.emitSpark(this.x, this.y, '#ffffff', 2);
      return false;
    }

    runStats.recordDamage(Math.min(amount, Math.max(0, this.hp)));
    this.hp -= amount;
    this.hitFlashTimer = 0.08;
    if (isTick) {
      this.pendingTickDmg += amount;
    } else {
      particles.emitSpark(this.x, this.y, isCrit ? '#fbbf24' : '#ffffff', isCrit ? 6 : 3);
      if (amount >= 2) particles.emitDamageText(this.x, this.y - this.radius * 0.6, amount, isCrit);
    }

    // Phase transitions at equal HP slices with a short invulnerability window
    const nextPhaseThreshold = 1 - this.phase / this.maxPhases;
    if (this.phase < this.maxPhases && this.hp > 0 && this.hp <= this.maxHp * nextPhaseThreshold) {
      this.phase += 1;
      this.invulnerableTimer = 1.4;
      this.attackTimer = -0.6;
      particles.emitShockwave(this.x, this.y, 350 + this.phase * 50, this.color, 8);
      particles.emitExplosion(this.x, this.y, this.color, 30);
      particles.emitBannerText(this.x, this.y - this.radius, `PHASE ${this.phase}`, this.color);
      sound.playBossAlarm();
    }

    if (this.hp <= 0) {
      this.isDefeated = true;
      particles.emitExplosion(this.x, this.y, this.color, 60);
      particles.emitShockwave(this.x, this.y, 600, '#00f3ff', 10);
      sound.playEnemyDeath();
      return true;
    }
    return false;
  }

  /** Time between ability casts - faster with each phase and each boss. */
  private getAttackInterval(): number {
    const base = Math.max(1.0, 2.5 - this.bossNumber * 0.08);
    return base * Math.pow(0.82, this.phase - 1);
  }

  public update(
    dt: number,
    player: Player,
    projectiles: EnemyProjectile[],
    mortarZones: MortarZone[],
    particles: ParticleSystem,
    spawns: BossSpawnRequests
  ) {
    this.timer += dt;
    this.attackTimer += dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    if (this.invulnerableTimer > 0) this.invulnerableTimer -= dt;

    this.tickTextTimer += dt;
    if (this.tickTextTimer >= 0.3 && this.pendingTickDmg >= 1) {
      particles.emitDamageText(this.x, this.y - this.radius * 0.6, this.pendingTickDmg, false);
      this.pendingTickDmg = 0;
      this.tickTextTimer = 0;
    }

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy) || 1;

    // --- Movement (charge overrides normal tracking) ---
    if (this.chargeWindup > 0) {
      this.chargeWindup -= dt;
      this.vx = 0;
      this.vy = 0;
      if (this.chargeWindup <= 0) {
        this.isCharging = true;
        this.chargeTime = 0.9;
      }
    } else if (this.isCharging) {
      this.chargeTime -= dt;
      const spd = this.baseSpeed * 5.2;
      this.vx = this.chargeDir.x * spd;
      this.vy = this.chargeDir.y * spd;
      if (this.timer % 0.05 < dt) particles.emitDashTrail(this.x, this.y, this.color);
      if (this.chargeTime <= 0) this.isCharging = false;
    } else {
      const speed = this.baseSpeed * (1 + (this.phase - 1) * 0.15);
      if (dist > 90) {
        this.vx = (dx / dist) * speed;
        this.vy = (dy / dist) * speed;
      } else {
        this.vx *= 0.9;
        this.vy *= 0.9;
      }
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Arena clamping
    const distCenter = Math.hypot(this.x, this.y);
    const maxBound = Player.ARENA_RADIUS - this.radius;
    if (distCenter > maxBound) {
      const a = Math.atan2(this.y, this.x);
      this.x = Math.cos(a) * maxBound;
      this.y = Math.sin(a) * maxBound;
      this.isCharging = false;
    }

    // --- Abilities: cycle through the boss's ability list ---
    if (this.invulnerableTimer > 0 || this.chargeWindup > 0 || this.isCharging) return;
    if (this.attackTimer < this.getAttackInterval()) return;
    this.attackTimer = 0;

    // From phase 2 on, bosses sometimes chain two abilities back to back
    const casts = this.phase >= 3 && Math.random() < 0.35 ? 2 : 1;
    for (let c = 0; c < casts; c++) {
      const ability = this.abilities[this.abilityIndex % this.abilities.length];
      this.abilityIndex += 1;
      this.cast(ability, player, dx, dy, dist, projectiles, mortarZones, particles, spawns);
    }
  }

  private shoot(projectiles: EnemyProjectile[], angle: number, speed: number, radius: number = 8, life: number = 4.5) {
    projectiles.push({
      x: this.x,
      y: this.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius,
      damage: 18 * this.dmgScale,
      color: this.color,
      life: 0,
      maxLife: life
    });
  }

  private cast(
    ability: BossAbility,
    player: Player,
    dx: number,
    dy: number,
    dist: number,
    projectiles: EnemyProjectile[],
    mortarZones: MortarZone[],
    particles: ParticleSystem,
    spawns: BossSpawnRequests
  ) {
    const aimAngle = Math.atan2(dy, dx);
    const p = this.phase;

    switch (ability) {
      case 'ring': {
        const count = 10 + p * 3;
        const offset = this.timer;
        for (let i = 0; i < count; i++) this.shoot(projectiles, (i / count) * Math.PI * 2 + offset, 150 + p * 12);
        particles.emitShockwave(this.x, this.y, 110, this.color, 4);
        break;
      }
      case 'spiral': {
        // Two interleaved arms, more arms per phase
        const arms = 2 + p;
        for (let arm = 0; arm < arms; arm++) {
          for (let k = 0; k < 4; k++) {
            const a = this.timer * 2 + (arm / arms) * Math.PI * 2 + k * 0.16;
            this.shoot(projectiles, a, 140 + k * 22, 7);
          }
        }
        break;
      }
      case 'fan': {
        // Aimed shotgun volley with predictive lead
        const lead = Math.min(0.6, dist / 260) * 0.6;
        const aim = Math.atan2(player.y + player.vy * lead - this.y, player.x + player.vx * lead - this.x);
        const count = 5 + p * 2;
        const spread = 0.12;
        for (let i = 0; i < count; i++) this.shoot(projectiles, aim + (i - (count - 1) / 2) * spread, 230 + p * 15, 7, 3.5);
        sound.playShoot(300, 0.15);
        break;
      }
      case 'summon': {
        const count = 3 + p + Math.floor(this.bossNumber / 2);
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          spawns.minions.push({ x: this.x + Math.cos(a) * (this.radius + 30), y: this.y + Math.sin(a) * (this.radius + 30) });
        }
        particles.emitShockwave(this.x, this.y, 160, '#a855f7', 5);
        break;
      }
      case 'charge': {
        // Telegraphed rush (see render) - dodge sideways or dash through
        this.chargeWindup = Math.max(0.55, 0.95 - p * 0.1);
        this.chargeDir = { x: dx / dist, y: dy / dist };
        particles.emitBannerText(this.x, this.y - this.radius, '!', '#f97316');
        break;
      }
      case 'mortar': {
        const count = 2 + p;
        for (let i = 0; i < count; i++) {
          const off = i === 0 ? 0 : 60 + Math.random() * 90;
          const a = Math.random() * Math.PI * 2;
          mortarZones.push({
            x: player.x + Math.cos(a) * off,
            y: player.y + Math.sin(a) * off,
            radius: 62,
            damage: 26 * this.dmgScale,
            timer: 0,
            maxTime: 1.35
          });
        }
        sound.playShoot(260, 0.2);
        break;
      }
      case 'rift': {
        const a = aimAngle + (Math.random() - 0.5) * 1.2;
        spawns.rifts.push({ x: player.x + Math.cos(a) * 140, y: player.y + Math.sin(a) * 140 });
        // Plus a slow ring so the rift pull is dangerous
        for (let i = 0; i < 8; i++) this.shoot(projectiles, (i / 8) * Math.PI * 2 + this.timer, 110, 9, 6);
        break;
      }
      case 'cross': {
        // Rotating cross of dense streams
        const arms = p >= 3 ? 6 : 4;
        const rot = this.timer * 0.9;
        for (let arm = 0; arm < arms; arm++) {
          const a = rot + (arm / arms) * Math.PI * 2;
          for (let k = 0; k < 3; k++) this.shoot(projectiles, a, 170 + k * 40, 7);
        }
        break;
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    const screenX = this.x - cameraX;
    const screenY = this.y - cameraY;

    // Charge telegraph: wide arrow lane in front of the boss
    if (this.chargeWindup > 0) {
      ctx.save();
      const len = this.baseSpeed * 5.2 * 0.9;
      ctx.translate(screenX, screenY);
      ctx.rotate(Math.atan2(this.chargeDir.y, this.chargeDir.x));
      ctx.fillStyle = 'rgba(249, 115, 22, 0.16)';
      ctx.fillRect(0, -this.radius, len, this.radius * 2);
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 8]);
      ctx.strokeRect(0, -this.radius, len, this.radius * 2);
      ctx.restore();
    }

    // Floor shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    ctx.ellipse(screenX, screenY + 16, this.radius * 1.15, this.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const floatZ = Math.sin(this.timer * 3) * 4;
    const pulse = 1 + Math.sin(this.timer * 5) * 0.08;
    const r = this.radius * pulse;

    ctx.save();
    ctx.translate(screenX, screenY - floatZ);
    ctx.globalCompositeOperation = 'lighter';

    // Aura glow sprite (replaces shadowBlur 35)
    ctx.globalAlpha = 0.55;
    drawGlow(ctx, 0, 0, r * 2.1, this.color);
    ctx.globalAlpha = 1;

    ctx.strokeStyle = this.invulnerableTimer > 0 ? '#ffffff' : this.color;
    ctx.lineWidth = 3.5;

    // Outer rotating geometry depends on archetype
    ctx.save();
    ctx.rotate(this.timer * 0.8);
    this.traceShape(ctx, r);
    ctx.stroke();
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

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = this.hitFlashTimer > 0 ? '#ffffff' : this.color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#030712';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.chargeWindup > 0 ? '#f97316' : '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private traceShape(ctx: CanvasRenderingContext2D, r: number) {
    ctx.beginPath();
    switch (this.shape) {
      case 'square':
        ctx.rect(-r, -r, r * 2, r * 2);
        break;
      case 'tri':
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
          if (i === 0) ctx.moveTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3);
          else ctx.lineTo(Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3);
        }
        ctx.closePath();
        break;
      case 'star':
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          const rr = i % 2 === 0 ? r * 1.35 : r * 0.85;
          if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        ctx.closePath();
        break;
      default:
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
    }
  }

  /** Bosses shower the arena with big drops (scaled with boss number). */
  public dropRewards(drops: Drop[]) {
    const n = this.bossNumber;
    const bigShards = 6 + n * 3;
    const bigLights = 8 + n * 2;
    for (let i = 0; i < bigShards; i++) drops.push(Drop.shard(this.x, this.y, 'big', 60));
    for (let i = 0; i < bigLights; i++) drops.push(Drop.light(this.x, this.y, 'big', 1, 60));
    for (let i = 0; i < 12; i++) drops.push(Drop.shard(this.x, this.y, 'small', 60));
  }
}
