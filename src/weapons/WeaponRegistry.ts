import { Weapon, PlayerProjectile } from './Weapon';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { ParticleSystem } from '../engine/Particle';
import { sound } from '../engine/Sound';

// ============================================================================
// 1. PULSE (Start weapon) -> SUPERNOVA
// Strictly bound to the dashed light perimeter line!
// ============================================================================
export class PulseWeapon extends Weapon {
  private novaRingTimer: number = 0;

  constructor() {
    super(
      'pulse',
      'PULSE',
      'SUPERNOVA',
      1.75,
      36,
      '◎',
      'A shockwave bursts from you to the exact edge of your light.',
      'Supernova ignites a persistent burning plasma ring along your light edge.'
    );
  }

  public update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    particles: ParticleSystem
  ) {
    this.timer += dt;
    const cd = this.getEffectiveCooldown(player);
    const radius = player.getLightRadius();

    if (this.timer >= cd) {
      this.timer = 0;
      const dmg = this.getEffectiveDamage(player);

      sound.playPulse();
      particles.emitShockwave(player.x, player.y, radius, '#00f3ff', this.isEvolved ? 6 : 3.5);

      if (this.isEvolved) {
        this.novaRingTimer = 1.6;
      }

      // Hit enemies strictly within the dashed light radius
      for (const enemy of enemies) {
        const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (dist <= radius + enemy.radius) {
          enemy.takeDamage(dmg, particles, { x: player.x, y: player.y });
          // Knockback scales with weapon level
          if (dist > 5) {
            const kb = 135 + this.level * 22;
            enemy.vx += ((enemy.x - player.x) / dist) * kb;
            enemy.vy += ((enemy.y - player.y) / dist) * kb;
          }
        }
      }

      if (boss && Math.hypot(boss.x - player.x, boss.y - player.y) <= radius + boss.radius) {
        boss.takeDamage(dmg, particles);
      }
    }

    // Supernova evolved persistent burning perimeter ring along the dashed line
    if (this.novaRingTimer > 0) {
      this.novaRingTimer -= dt;
      const ringDmg = this.getEffectiveDamage(player) * 0.55 * dt;
      for (const enemy of enemies) {
        const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (Math.abs(d - radius) < 28) {
          enemy.takeDamage(ringDmg, particles);
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number, player?: Player) {
    if (this.novaRingTimer > 0 && player) {
      const r = player.getLightRadius();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 4 * (this.novaRingTimer / 1.6);
      ctx.beginPath();
      ctx.arc(player.x - cameraX, player.y - cameraY, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// ============================================================================
// 2. LANCE -> PRISMATIC BEAM
// Strictly bound to the dashed light perimeter line!
// ============================================================================
export class LanceWeapon extends Weapon {
  private activeBeams: Array<{ x1: number; y1: number; x2: number; y2: number; life: number }> = [];

  constructor() {
    super(
      'lance',
      'LANCE',
      'PRISMATIC BEAM',
      1.45,
      46,
      '↗',
      'Fires a piercing beam at the nearest foe inside your light (+15% dmg per pierce).',
      'Piercing beam refracts into 3 splitting laser streams up to your light edge.'
    );
  }

  public update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    particles: ParticleSystem
  ) {
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      this.activeBeams[i].life -= dt;
      if (this.activeBeams[i].life <= 0) this.activeBeams.splice(i, 1);
    }

    this.timer += dt;
    const cd = this.getEffectiveCooldown(player);
    const lightRadius = player.getLightRadius();

    if (this.timer >= cd) {
      // Find nearest enemy strictly within the dashed light radius!
      const target = this.findNearestTarget(player.x, player.y, enemies, boss, lightRadius);

      if (target) {
        this.timer = 0;
        const baseDmg = this.getEffectiveDamage(player);
        const angle = Math.atan2(target.y - player.y, target.x - player.x);
        // Beam terminates exactly at the dashed light perimeter line!
        const beamLen = lightRadius;

        const angles = this.isEvolved ? [angle - 0.22, angle, angle + 0.22] : [angle];
        sound.playShoot(750, 0.16);

        for (const a of angles) {
          const x2 = player.x + Math.cos(a) * beamLen;
          const y2 = player.y + Math.sin(a) * beamLen;
          this.activeBeams.push({ x1: player.x, y1: player.y, x2, y2, life: 0.2 });

          // Damage all enemies intersecting line (+15% damage amplification per pierced foe!)
          let pierceCount = 0;
          for (const enemy of enemies) {
            const distFromPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
            if (
              distFromPlayer <= lightRadius + enemy.radius &&
              this.distToSegment(enemy.x, enemy.y, player.x, player.y, x2, y2) < enemy.radius + 14
            ) {
              const ampDmg = baseDmg * (1 + pierceCount * 0.15);
              enemy.takeDamage(ampDmg, particles, { x: player.x, y: player.y }, pierceCount > 0);
              pierceCount++;
            }
          }
          if (
            boss &&
            Math.hypot(boss.x - player.x, boss.y - player.y) <= lightRadius + boss.radius &&
            this.distToSegment(boss.x, boss.y, player.x, player.y, x2, y2) < boss.radius + 14
          ) {
            boss.takeDamage(baseDmg * (1 + pierceCount * 0.15), particles, pierceCount > 0);
          }
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    for (const b of this.activeBeams) {
      const alpha = Math.max(0, b.life / 0.2);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 16;
      ctx.lineWidth = this.isEvolved ? 5.5 : 3.8;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(b.x1 - cameraX, b.y1 - cameraY);
      ctx.lineTo(b.x2 - cameraX, b.y2 - cameraY);
      ctx.stroke();

      // White inner core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }
}

// ============================================================================
// 3. SPARKS -> STELLAR SWARM
// The ONLY weapon that flies freely beyond the dashed light line to hunt foes!
// ============================================================================
export class SparksWeapon extends Weapon {
  constructor() {
    super(
      'sparks',
      'SPARKS',
      'STELLAR SWARM',
      1.25,
      21,
      '✦',
      'Homing motes of light fly beyond your light to seek out enemies.',
      'Swarm motes chain-bounce between enemies and trigger explosions.'
    );
  }

  public update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    particles: ParticleSystem,
    projectiles: PlayerProjectile[]
  ) {
    this.timer += dt;
    const cd = this.getEffectiveCooldown(player);

    if (this.timer >= cd) {
      // Sparks can target enemies anywhere on screen (beyond the dashed light line!)
      const nearest = this.findNearestTarget(player.x, player.y, enemies, boss, 950);
      if (nearest) {
        this.timer = 0;
        const count = this.isEvolved ? 7 : 2 + this.level;
        const dmg = this.getEffectiveDamage(player);
        const baseAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);

        sound.playShoot(900, 0.08);

        for (let i = 0; i < count; i++) {
          const spreadOffset = (i - (count - 1) / 2) * 0.34;
          const launchAngle = baseAngle + spreadOffset;
          const initialSpeed = 290;
          projectiles.push({
            x: player.x + Math.cos(launchAngle) * 14,
            y: player.y + Math.sin(launchAngle) * 14,
            vx: Math.cos(launchAngle) * initialSpeed,
            vy: Math.sin(launchAngle) * initialSpeed,
            radius: this.isEvolved ? 6 : 4,
            damage: dmg,
            color: '#34d399',
            life: 0,
            maxLife: 2.9,
            pierce: this.isEvolved ? 3 : 1,
            isHoming: true,
            homingSpeed: 390,
            onHitExplode: this.isEvolved,
            boundToLightRadius: false, // Sparks are NOT bound to the dashed line!
            chainBouncesLeft: this.isEvolved ? 2 : 1
          });
        }
      }
    }
  }
}

// ============================================================================
// 4. ORBITERS -> SOLAR CORONA
// Bound inside the dashed light radius + destroys enemy projectiles on contact!
// ============================================================================
export class OrbitersWeapon extends Weapon {
  private angle: number = 0;
  private shootTimer: number = 0;
  public currentOrbPositions: Array<{ x: number; y: number }> = [];

  constructor() {
    super(
      'orbiters',
      'ORBITERS',
      'SOLAR CORONA',
      0.0,
      16,
      '🪐',
      'Luminous orbs circle inside your light, blocking enemy shots and firing at foes.',
      'Blazing corona destroys enemy projectiles and fires rapid homing bolts.'
    );
  }

  public update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    particles: ParticleSystem,
    projectiles: PlayerProjectile[]
  ) {
    const orbCount = this.isEvolved ? 6 : 2 + Math.floor(this.level * 0.8);
    const rotSpeed = this.isEvolved ? 4.6 : 2.6;
    this.angle += rotSpeed * dt;

    const lightRadius = player.getLightRadius();
    // Orbiters breathe dynamically between 45% and 78% of the player's light radius!
    const breathe = 0.62 + Math.sin(this.angle * 0.7) * 0.14;
    const orbDist = Math.min(lightRadius - 10, Math.max(48, lightRadius * breathe));
    const dmg = this.getEffectiveDamage(player) * dt * 4.2;

    // Shift orbit slightly towards the nearest enemy inside the light radius
    let shiftX = 0;
    let shiftY = 0;
    const nearest = this.findNearestTarget(player.x, player.y, enemies, boss, lightRadius);
    if (nearest) {
      const a = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      shiftX = Math.cos(a) * Math.min(18, lightRadius * 0.1);
      shiftY = Math.sin(a) * Math.min(18, lightRadius * 0.1);
    }

    this.currentOrbPositions = [];
    for (let i = 0; i < orbCount; i++) {
      const a = this.angle + (i / orbCount) * Math.PI * 2;
      const ox = player.x + shiftX + Math.cos(a) * orbDist;
      const oy = player.y + shiftY + Math.sin(a) * orbDist;
      this.currentOrbPositions.push({ x: ox, y: oy });

      for (const enemy of enemies) {
        if (Math.hypot(enemy.x - ox, enemy.y - oy) < enemy.radius + 14) {
          enemy.takeDamage(dmg, particles, { x: ox, y: oy });
        }
      }
      if (boss && Math.hypot(boss.x - ox, boss.y - oy) < boss.radius + 14) {
        boss.takeDamage(dmg, particles);
      }
    }

    // Fire an orb bolt at the nearest enemy inside the light radius!
    this.shootTimer += dt;
    const shootCd = (this.isEvolved ? 0.65 : 1.15) * player.getCooldownMultiplier();
    if (this.shootTimer >= shootCd && nearest) {
      this.shootTimer = 0;
      const a = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      const spd = 350;
      projectiles.push({
        x: player.x + Math.cos(a) * (orbDist * 0.7),
        y: player.y + Math.sin(a) * (orbDist * 0.7),
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        radius: 4.5,
        damage: this.getEffectiveDamage(player) * 0.85,
        color: this.isEvolved ? '#f59e0b' : '#38bdf8',
        life: 0,
        maxLife: 1.4,
        pierce: 1,
        isHoming: true,
        homingSpeed: 350,
        boundToLightRadius: true
      });
    }
  }
}

// ============================================================================
// 5. FLARE -> DAYBREAK
// Bound to the dashed light radius: detonates on impact or at the light border,
// leaving a burning Solar Field that slows and scorches enemies!
// ============================================================================
export class FlareWeapon extends Weapon {
  constructor() {
    super(
      'flare',
      'FLARE',
      'DAYBREAK',
      2.4,
      52,
      '💥',
      'Hurls explosive shells at the nearest foe in your light, leaving a burning solar field.',
      'Detonations create massive solar fields that slow and incinerate all enemies.'
    );
  }

  public update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    particles: ParticleSystem,
    projectiles: PlayerProjectile[]
  ) {
    this.timer += dt;
    const cd = this.getEffectiveCooldown(player);
    const lightRadius = player.getLightRadius();

    if (this.timer >= cd) {
      const nearest = this.findNearestTarget(player.x, player.y, enemies, boss, lightRadius);
      if (!nearest) return;

      this.timer = 0;
      const dmg = this.getEffectiveDamage(player);
      const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      const speed = 290;

      sound.playShoot(400, 0.2);

      projectiles.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: this.isEvolved ? 10 : 8,
        damage: dmg,
        color: '#f97316',
        life: 0,
        maxLife: 1.5,
        pierce: 1,
        isHoming: true,
        homingSpeed: 290,
        onHitExplode: true,
        boundToLightRadius: true,
        spawnsSolarZone: true
      });
    }
  }
}

// ============================================================================
// 6. RADIANCE -> TWIN SUN
// Strictly bound to the exact dashed light line!
// Features Thermal Focus: locking onto the same target ramps damage up to +100%!
// ============================================================================
export class RadianceWeapon extends Weapon {
  private beamAngle: number = 0;
  private lockedTarget: Enemy | Boss | null = null;
  public thermalCharge: number = 0; // 0.0 to 1.0 (up to +100% damage and wider beam)

  constructor() {
    super(
      'radiance',
      'RADIANCE',
      'TWIN SUN',
      0.0,
      25,
      '🔆',
      'A continuous beam to the edge of your light locks onto the nearest foe (+100% heat ramp).',
      'Opposing dual death beams lock and superheat enemies within your light.'
    );
  }

  public update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    particles: ParticleSystem
  ) {
    const lightRadius = player.getLightRadius();
    const nearest = this.findNearestTarget(player.x, player.y, enemies, boss, lightRadius);

    if (nearest) {
      if (this.lockedTarget === nearest) {
        this.thermalCharge = Math.min(1.0, this.thermalCharge + dt * 0.45);
      } else {
        this.lockedTarget = nearest;
        this.thermalCharge = Math.max(0, this.thermalCharge - dt * 0.5);
      }
      const desiredAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      const diff = Math.atan2(Math.sin(desiredAngle - this.beamAngle), Math.cos(desiredAngle - this.beamAngle));
      const trackSpeed = this.isEvolved ? 8.5 : 5.5;
      this.beamAngle += diff * Math.min(1, dt * trackSpeed);
    } else {
      this.lockedTarget = null;
      this.thermalCharge = Math.max(0, this.thermalCharge - dt * 0.8);
      const rotSpeed = this.isEvolved ? 3.0 : 1.8;
      this.beamAngle += rotSpeed * dt;
    }

    // Strictly bound to the dashed light perimeter line!
    const len = lightRadius;
    const heatMultiplier = 1 + this.thermalCharge * 1.0; // Up to 2x damage!
    const dmg = this.getEffectiveDamage(player) * heatMultiplier * dt * 3.8;

    const beamAngles = this.isEvolved ? [this.beamAngle, this.beamAngle + Math.PI] : [this.beamAngle];

    for (const a of beamAngles) {
      const bx = player.x + Math.cos(a) * len;
      const by = player.y + Math.sin(a) * len;

      for (const enemy of enemies) {
        const distFromPlayer = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (distFromPlayer <= len + enemy.radius) {
          const d = this.distToSegment(enemy.x, enemy.y, player.x, player.y, bx, by);
          if (d < enemy.radius + 12 + this.thermalCharge * 6) {
            enemy.takeDamage(dmg, particles, { x: player.x, y: player.y }, this.thermalCharge > 0.75);
          }
        }
      }
      if (boss && Math.hypot(boss.x - player.x, boss.y - player.y) <= len + boss.radius) {
        const d = this.distToSegment(boss.x, boss.y, player.x, player.y, bx, by);
        if (d < boss.radius + 12 + this.thermalCharge * 6) {
          boss.takeDamage(dmg, particles, this.thermalCharge > 0.75);
        }
      }
    }
  }

  public getAngles(): number[] {
    return this.isEvolved ? [this.beamAngle, this.beamAngle + Math.PI] : [this.beamAngle];
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }
}

// ============================================================================
// 7. NEEDLES -> STARLIGHT BARRAGE
// Bound to the dashed light line! Every 4th volley fires a golden shield-piercing Crit Needle!
// ============================================================================
export class NeedlesWeapon extends Weapon {
  private volleyCounter: number = 0;

  constructor() {
    super(
      'needles',
      'NEEDLES',
      'STARLIGHT BARRAGE',
      0.34,
      15,
      '⇶',
      'Rapidly shoots needles at the nearest foe in your light (every 4th shot is a shield-piercing crit).',
      'Gatling needle bursts with high piercing and golden stagger needles.'
    );
  }

  public update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    particles: ParticleSystem,
    projectiles: PlayerProjectile[]
  ) {
    this.timer += dt;
    const cd = this.getEffectiveCooldown(player);
    const lightRadius = player.getLightRadius();

    if (this.timer >= cd) {
      const nearest = this.findNearestTarget(player.x, player.y, enemies, boss, lightRadius);
      if (!nearest) return;

      this.timer = 0;
      this.volleyCounter += 1;
      const isFourthCrit = this.volleyCounter % 4 === 0;

      const dmg = this.getEffectiveDamage(player) * (isFourthCrit ? 1.85 : 1.0);
      const angle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
      const count = this.isEvolved ? 4 : 1 + Math.floor(this.level * 0.4);

      sound.playShoot(isFourthCrit ? 1350 : 1100, 0.05);

      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) / 2) * 0.1;
        const shootAngle = angle + spread;
        const speed = 520;

        projectiles.push({
          x: player.x,
          y: player.y,
          vx: Math.cos(shootAngle) * speed,
          vy: Math.sin(shootAngle) * speed,
          radius: isFourthCrit ? 4.8 : 3.5,
          damage: dmg,
          color: isFourthCrit ? '#fbbf24' : '#38bdf8',
          life: 0,
          maxLife: 1.5,
          pierce: this.isEvolved ? 4 : 2,
          isHoming: true,
          homingSpeed: 520,
          boundToLightRadius: true,
          bypassesShield: isFourthCrit,
          staggerStrength: isFourthCrit ? 95 : 0
        });
      }
    }
  }
}

// ============================================================================
// 8. BEACON -> CONSTELLATION
// Bound inside the dashed light radius + forms laser links between pillars even at Lv 1!
// ============================================================================
export interface BeaconPillar {
  x: number;
  y: number;
  life: number;
  maxLife: number;
  shootTimer: number;
}

export class BeaconWeapon extends Weapon {
  public beacons: BeaconPillar[] = [];

  constructor() {
    super(
      'beacon',
      'BEACON',
      'CONSTELLATION',
      3.0,
      28,
      '🏛️',
      'Deploys light pillars inside your light that interlink with laser tripwires and fire at foes.',
      'Up to 6 beacons form a lethal constellation laser grid inside your light.'
    );
  }

  public update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    particles: ParticleSystem,
    projectiles: PlayerProjectile[]
  ) {
    const lightRadius = player.getLightRadius();

    for (let i = this.beacons.length - 1; i >= 0; i--) {
      const b = this.beacons[i];
      b.life -= dt;
      // Keep beacons tethered inside the player's dashed light perimeter!
      const distFromPlayer = Math.hypot(b.x - player.x, b.y - player.y);
      if (distFromPlayer > lightRadius - 12) {
        const a = Math.atan2(b.y - player.y, b.x - player.x);
        b.x = player.x + Math.cos(a) * (lightRadius - 12);
        b.y = player.y + Math.sin(a) * (lightRadius - 12);
      }
      if (b.life <= 0) {
        this.beacons.splice(i, 1);
      }
    }

    this.timer += dt;
    const cd = this.getEffectiveCooldown(player);

    if (this.timer >= cd) {
      this.timer = 0;
      const maxBeacons = this.isEvolved ? 6 : 3 + Math.floor(this.level / 3);
      if (this.beacons.length >= maxBeacons) {
        this.beacons.shift();
      }
      const nearest = this.findNearestTarget(player.x, player.y, enemies, boss, lightRadius);
      const deployDist = Math.min(lightRadius * 0.65, 85);
      const a = nearest
        ? Math.atan2(nearest.y - player.y, nearest.x - player.x) + (Math.random() - 0.5) * 0.8
        : Math.random() * Math.PI * 2;
      const bx = player.x + Math.cos(a) * deployDist;
      const by = player.y + Math.sin(a) * deployDist;

      this.beacons.push({
        x: bx,
        y: by,
        life: 14,
        maxLife: 14,
        shootTimer: 0
      });
      particles.emitShockwave(bx, by, 70, '#fbbf24', 3);
      sound.playPulse();
    }

    const dmg = this.getEffectiveDamage(player) * dt * 3.2;
    const turretDamage = this.getEffectiveDamage(player) * 0.72;

    for (const b of this.beacons) {
      for (const enemy of enemies) {
        if (Math.hypot(enemy.x - b.x, enemy.y - b.y) < enemy.radius + 35) {
          enemy.takeDamage(dmg, particles, { x: b.x, y: b.y });
        }
      }
      if (boss && Math.hypot(boss.x - b.x, boss.y - b.y) < boss.radius + 35) {
        boss.takeDamage(dmg, particles);
      }

      // Beacon turret fires at nearest enemy inside the player's light radius!
      b.shootTimer += dt;
      if (b.shootTimer >= (this.isEvolved ? 0.75 : 1.25)) {
        const target = this.findNearestTarget(b.x, b.y, enemies, boss, lightRadius);
        if (target && Math.hypot(target.x - player.x, target.y - player.y) <= lightRadius + 15) {
          b.shootTimer = 0;
          const a = Math.atan2(target.y - b.y, target.x - b.x);
          const spd = 380;
          projectiles.push({
            x: b.x,
            y: b.y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            radius: 4,
            damage: turretDamage,
            color: '#fbbf24',
            life: 0,
            maxLife: 1.4,
            pierce: 1,
            isHoming: true,
            homingSpeed: 380,
            boundToLightRadius: true
          });
        }
      }
    }

    // Laser tripwire links between active beacons (active from Level 1!)
    if (this.beacons.length >= 2) {
      const linkMult = this.isEvolved ? 1.7 : 1.0;
      for (let i = 0; i < this.beacons.length; i++) {
        for (let j = i + 1; j < this.beacons.length; j++) {
          const b1 = this.beacons[i];
          const b2 = this.beacons[j];
          for (const enemy of enemies) {
            if (this.distToSegment(enemy.x, enemy.y, b1.x, b1.y, b2.x, b2.y) < enemy.radius + 12) {
              enemy.takeDamage(dmg * linkMult, particles);
            }
          }
          if (boss && this.distToSegment(boss.x, boss.y, b1.x, b1.y, b2.x, b2.y) < boss.radius + 12) {
            boss.takeDamage(dmg * linkMult, particles);
          }
        }
      }
    }
  }

  private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }
}
