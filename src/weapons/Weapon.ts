import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { ParticleSystem } from '../engine/Particle';
import { sound } from '../engine/Sound';
import { t } from '../meta/i18n';

export interface PlayerProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  color: string;
  life: number;
  maxLife: number;
  pierce: number;
  isHoming?: boolean;
  target?: Enemy | Boss | null;
  homingSpeed?: number;
  onHitExplode?: boolean;
  boundToLightRadius?: boolean; // Clamps projectile strictly inside the dashed light line!
  chainBouncesLeft?: number; // For Sparks chain-bounce
  spawnsSolarZone?: boolean; // For Flare solar burn zone on hit/expiry
  bypassesShield?: boolean; // For Needles 4th-shot crit needle
  staggerStrength?: number;
  /** Visual style: 'orb' (default), 'star' (Sparks), 'needle', 'shell' (Flare). */
  shape?: 'orb' | 'star' | 'needle' | 'shell';
  sourceId?: string; // Weapon id for damage statistics (set by Game when spawned)
  spin?: number;
}

export abstract class Weapon {
  public id: string;
  public name: string;
  public evolvedName: string;
  public level: number = 1;
  public maxLevel: number = 5;
  public isEvolved: boolean = false;
  public cooldown: number;
  public timer: number = 0;
  public baseDamage: number;
  public icon: string;
  public description: string;
  public evolvedDescription: string;

  constructor(
    id: string,
    name: string,
    evolvedName: string,
    cooldown: number,
    baseDamage: number,
    icon: string,
    description: string,
    evolvedDescription: string
  ) {
    this.id = id;
    this.name = name;
    this.evolvedName = evolvedName;
    this.cooldown = cooldown;
    this.baseDamage = baseDamage;
    this.icon = icon;
    this.description = description;
    this.evolvedDescription = evolvedDescription;
  }

  public upgrade() {
    if (this.level < this.maxLevel) {
      this.level += 1;
    } else if (!this.isEvolved) {
      this.isEvolved = true;
    }
  }

  public getDisplayName(): string {
    const key = `weapon_${this.id}_${this.isEvolved ? 'evo' : 'name'}`;
    const localized = t(key);
    if (localized !== key) return localized;
    return this.isEvolved ? this.evolvedName : this.name;
  }

  public getEffectiveDamage(player: Player): number {
    const lvlBonus = 1 + (this.level - 1) * 0.25;
    const evoBonus = this.isEvolved ? 1.6 : 1.0;
    return this.baseDamage * lvlBonus * evoBonus * player.getDamageMultiplier();
  }

  public getEffectiveCooldown(player: Player): number {
    const lvlCdReduction = 1 - (this.level - 1) * 0.05;
    return Math.max(0.15, this.cooldown * lvlCdReduction * player.getCooldownMultiplier());
  }

  /**
   * Helper: Finds the nearest enemy or boss to the given origin (x, y) within maxRange.
   */
  public findNearestTarget(
    originX: number,
    originY: number,
    enemies: Enemy[],
    boss: Boss | null,
    maxRange: number = 950
  ): Enemy | Boss | null {
    let nearest: Enemy | Boss | null = null;
    let minDist = maxRange;

    for (const enemy of enemies) {
      const d = Math.hypot(enemy.x - originX, enemy.y - originY);
      if (d < minDist) {
        minDist = d;
        nearest = enemy;
      }
    }
    if (boss && !boss.isDefeated) {
      const d = Math.hypot(boss.x - originX, boss.y - originY);
      if (d < minDist) {
        minDist = d;
        nearest = boss;
      }
    }
    return nearest;
  }

  public abstract update(
    dt: number,
    player: Player,
    enemies: Enemy[],
    boss: Boss | null,
    particles: ParticleSystem,
    projectiles: PlayerProjectile[]
  ): void;

  public render?(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number): void;
}
