import { Weapon, PlayerProjectile } from './Weapon';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { ParticleSystem } from '../engine/Particle';
import { sound } from '../engine/Sound';

// ============================================================================
// 1. PULSE (Start weapon) -> SUPERNOVA
// ============================================================================
export class PulseWeapon extends Weapon {
  constructor() {
    super(
      'pulse',
      'PULSE',
      'SUPERNOVA',
      2.0,
      32,
      '◎',
      'A shockwave bursts from you to the edge of your light.',
      'Massive supernova burns all foes and leaves a persistent ring of fire.'
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
      this.timer = 0;
      const radius = player.getLightRadius();
      const dmg = this.getEffectiveDamage(player);

      sound.playPulse();
      particles.emitShockwave(player.x, player.y, radius, '#00f3ff', this.isEvolved ? 6 : 3.5);

      // Hit enemies within light radius
      for (const enemy of enemies) {
        const dist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (dist <= radius + enemy.radius) {
          enemy.takeDamage(dmg, particles);
          // Knockback
          if (dist > 5) {
            enemy.vx += ((enemy.x - player.x) / dist) * 150;
            enemy.vy += ((enemy.y - player.y) / dist) * 150;
          }
        }
      }

      if (boss && Math.hypot(boss.x - player.x, boss.y - player.y) <= radius + boss.radius) {
        boss.takeDamage(dmg * 0.7, particles);
      }
    }
  }
}

// ============================================================================
// 2. LANCE -> PRISMATIC BEAM
// ============================================================================
export class LanceWeapon extends Weapon {
  private activeBeams: Array<{ x1: number; y1: number; x2: number; y2: number; life: number }> = [];

  constructor() {
    super(
      'lance',
      'LANCE',
      'PRISMATIC BEAM',
      1.5,
      48,
      '↗',
      'Fires a piercing beam at the nearest foe.',
      'Piercing beam refracts into 3 splitting laser streams.'
    );
  }

  public update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    particles: ParticleSystem
  ) {
    // Fade visual beams
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      this.activeBeams[i].life -= dt;
      if (this.activeBeams[i].life <= 0) this.activeBeams.splice(i, 1);
    }

    this.timer += dt;
    const cd = this.getEffectiveCooldown(player);

    if (this.timer >= cd) {
      // Find nearest enemy in range
      let target: Enemy | Boss | null = null;
      let minDist = player.getLightRadius() + 100;

      for (const enemy of enemies) {
        const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (d < minDist) {
          minDist = d;
          target = enemy;
        }
      }
      if (boss) {
        const d = Math.hypot(boss.x - player.x, boss.y - player.y);
        if (d < minDist) {
          minDist = d;
          target = boss;
        }
      }

      if (target) {
        this.timer = 0;
        const dmg = this.getEffectiveDamage(player);
        const angle = Math.atan2(target.y - player.y, target.x - player.x);
        const beamLen = player.getLightRadius() * 1.5;

        const angles = this.isEvolved ? [angle - 0.22, angle, angle + 0.22] : [angle];
        sound.playShoot(750, 0.18);

        for (const a of angles) {
          const x2 = player.x + Math.cos(a) * beamLen;
          const y2 = player.y + Math.sin(a) * beamLen;
          this.activeBeams.push({ x1: player.x, y1: player.y, x2, y2, life: 0.15 });

          // Damage all enemies intersecting line
          for (const enemy of enemies) {
            if (this.distToSegment(enemy.x, enemy.y, player.x, player.y, x2, y2) < enemy.radius + 14) {
              enemy.takeDamage(dmg, particles);
            }
          }
          if (boss && this.distToSegment(boss.x, boss.y, player.x, player.y, x2, y2) < boss.radius + 14) {
            boss.takeDamage(dmg, particles);
          }
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    for (const b of this.activeBeams) {
      const alpha = Math.max(0, b.life / 0.15);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#fbbf24';
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 15;
      ctx.lineWidth = this.isEvolved ? 5 : 3.5;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(b.x1 - cameraX, b.y1 - cameraY);
      ctx.lineTo(b.x2 - cameraX, b.y2 - cameraY);
      ctx.stroke();

      // White inner core
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
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
// ============================================================================
export class SparksWeapon extends Weapon {
  constructor() {
    super(
      'sparks',
      'SPARKS',
      'STELLAR SWARM',
      1.2,
      22,
      '✦',
      'Homing motes of light seek out enemies.',
      'Double motes ignite explosive chain reactions.'
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

    if (this.timer >= cd && (enemies.length > 0 || boss)) {
      this.timer = 0;
      const count = this.isEvolved ? 8 : 2 + this.level;
      const dmg = this.getEffectiveDamage(player);

      sound.playShoot(900, 0.08);

      for (let i = 0; i < count; i++) {
        const spreadAngle = (i / count) * Math.PI * 2;
        const initialSpeed = 180;
        projectiles.push({
          x: player.x + Math.cos(spreadAngle) * 15,
          y: player.y + Math.sin(spreadAngle) * 15,
          vx: Math.cos(spreadAngle) * initialSpeed,
          vy: Math.sin(spreadAngle) * initialSpeed,
          radius: this.isEvolved ? 6 : 4,
          damage: dmg,
          color: '#34d399',
          life: 0,
          maxLife: 2.8,
          pierce: this.isEvolved ? 2 : 1,
          isHoming: true,
          homingSpeed: 360,
          onHitExplode: this.isEvolved
        });
      }
    }
  }
}

// ============================================================================
// 4. ORBITERS -> SOLAR CORONA
// ============================================================================
export class OrbitersWeapon extends Weapon {
  private angle: number = 0;

  constructor() {
    super(
      'orbiters',
      'ORBITERS',
      'SOLAR CORONA',
      0.0, // Continuous
      16,
      '🪐',
      'Luminous orbs circle you, cutting down foes on contact.',
      'Blazing corona with high rotation speed and contact incineration.'
    );
  }

  public update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    particles: ParticleSystem
  ) {
    const orbCount = this.isEvolved ? 6 : 2 + Math.floor(this.level * 0.8);
    const rotSpeed = this.isEvolved ? 4.5 : 2.5;
    this.angle += rotSpeed * dt;
    const orbDist = 55 + (this.level - 1) * 6;
    const dmg = this.getEffectiveDamage(player) * dt * 4;

    for (let i = 0; i < orbCount; i++) {
      const a = this.angle + (i / orbCount) * Math.PI * 2;
      const ox = player.x + Math.cos(a) * orbDist;
      const oy = player.y + Math.sin(a) * orbDist;

      // Contact hit
      for (const enemy of enemies) {
        if (Math.hypot(enemy.x - ox, enemy.y - oy) < enemy.radius + 12) {
          enemy.takeDamage(dmg, particles);
        }
      }
      if (boss && Math.hypot(boss.x - ox, boss.y - oy) < boss.radius + 12) {
        boss.takeDamage(dmg, particles);
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    // Rendered together with player
  }
}

// ============================================================================
// 5. FLARE -> DAYBREAK
// ============================================================================
export class FlareWeapon extends Weapon {
  constructor() {
    super(
      'flare',
      'FLARE',
      'DAYBREAK',
      2.6,
      55,
      '💥',
      'Hurls explosive light shells into the darkness.',
      'Detonations produce a blinding flash that scorches all enemies.'
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
      this.timer = 0;
      const dmg = this.getEffectiveDamage(player);
      const angle = Math.random() * Math.PI * 2;
      const speed = 260;

      sound.playShoot(400, 0.2);

      projectiles.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 8,
        damage: dmg,
        color: '#f97316',
        life: 0,
        maxLife: 1.1,
        pierce: 1,
        onHitExplode: true
      });
    }
  }
}

// ============================================================================
// 6. RADIANCE -> TWIN SUN
// ============================================================================
export class RadianceWeapon extends Weapon {
  private beamAngle: number = 0;

  constructor() {
    super(
      'radiance',
      'RADIANCE',
      'TWIN SUN',
      0.0,
      24,
      '🔆',
      'A continuous focused beam rotates around you.',
      'Opposing dual death beams sweep with high rotational power.'
    );
  }

  public update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    particles: ParticleSystem
  ) {
    const rotSpeed = this.isEvolved ? 3.0 : 1.8;
    this.beamAngle += rotSpeed * dt;
    const len = player.getLightRadius();
    const dmg = this.getEffectiveDamage(player) * dt * 3.5;

    const beamAngles = this.isEvolved ? [this.beamAngle, this.beamAngle + Math.PI] : [this.beamAngle];

    for (const a of beamAngles) {
      const bx = player.x + Math.cos(a) * len;
      const by = player.y + Math.sin(a) * len;

      for (const enemy of enemies) {
        const d = this.distToSegment(enemy.x, enemy.y, player.x, player.y, bx, by);
        if (d < enemy.radius + 10) {
          enemy.takeDamage(dmg, particles);
        }
      }
      if (boss) {
        const d = this.distToSegment(boss.x, boss.y, player.x, player.y, bx, by);
        if (d < boss.radius + 10) {
          boss.takeDamage(dmg, particles);
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
    // Will be rendered in Renderer.ts
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
// ============================================================================
export class NeedlesWeapon extends Weapon {
  constructor() {
    super(
      'needles',
      'NEEDLES',
      'STARLIGHT BARRAGE',
      0.35,
      14,
      '⇶',
      'Rapidly shoots starlight needles in your movement direction.',
      'Gatling needle bursts with high piercing and critical hits.'
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
      this.timer = 0;
      const dmg = this.getEffectiveDamage(player);
      const angle = player.rotation;
      const count = this.isEvolved ? 4 : 1 + Math.floor(this.level * 0.4);

      sound.playShoot(1100, 0.05);

      for (let i = 0; i < count; i++) {
        const spread = (i - (count - 1) / 2) * 0.12;
        const shootAngle = angle + spread;
        const speed = 480;

        projectiles.push({
          x: player.x,
          y: player.y,
          vx: Math.cos(shootAngle) * speed,
          vy: Math.sin(shootAngle) * speed,
          radius: 3,
          damage: dmg,
          color: '#38bdf8',
          life: 0,
          maxLife: 1.4,
          pierce: this.isEvolved ? 4 : 2
        });
      }
    }
  }
}

// ============================================================================
// 8. BEACON -> CONSTELLATION
// ============================================================================
export interface BeaconPillar {
  x: number;
  y: number;
  life: number;
  maxLife: number;
}

export class BeaconWeapon extends Weapon {
  public beacons: BeaconPillar[] = [];

  constructor() {
    super(
      'beacon',
      'BEACON',
      'CONSTELLATION',
      3.2,
      28,
      '🏛️',
      'Deploys stationary light pillars that ward off the dark.',
      'Beacons interlink with lethal laser grids.'
    );
  }

  public update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    particles: ParticleSystem
  ) {
    // Update beacons
    for (let i = this.beacons.length - 1; i >= 0; i--) {
      this.beacons[i].life -= dt;
      if (this.beacons[i].life <= 0) {
        this.beacons.splice(i, 1);
      }
    }

    this.timer += dt;
    const cd = this.getEffectiveCooldown(player);

    if (this.timer >= cd) {
      this.timer = 0;
      const maxBeacons = this.isEvolved ? 6 : 3;
      if (this.beacons.length >= maxBeacons) {
        this.beacons.shift();
      }
      this.beacons.push({
        x: player.x,
        y: player.y,
        life: 14,
        maxLife: 14
      });
      particles.emitShockwave(player.x, player.y, 80, '#fbbf24', 3);
      sound.playPulse();
    }

    // Damage enemies near beacons or laser links
    const dmg = this.getEffectiveDamage(player) * dt * 3;
    for (const b of this.beacons) {
      for (const enemy of enemies) {
        if (Math.hypot(enemy.x - b.x, enemy.y - b.y) < enemy.radius + 30) {
          enemy.takeDamage(dmg, particles);
        }
      }
      if (boss && Math.hypot(boss.x - b.x, boss.y - b.y) < boss.radius + 30) {
        boss.takeDamage(dmg, particles);
      }
    }

    // Constellation laser grid if evolved!
    if (this.isEvolved && this.beacons.length >= 2) {
      for (let i = 0; i < this.beacons.length; i++) {
        for (let j = i + 1; j < this.beacons.length; j++) {
          const b1 = this.beacons[i];
          const b2 = this.beacons[j];
          for (const enemy of enemies) {
            if (this.distToSegment(enemy.x, enemy.y, b1.x, b1.y, b2.x, b2.y) < enemy.radius + 12) {
              enemy.takeDamage(dmg * 1.5, particles);
            }
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
