import { settings } from '../meta/Settings';
import { Difficulty } from '../meta/i18n';

/**
 * Central balance formulas for AETHER: ECLIPSE.
 *
 * Supports 3 difficulty tiers:
 * - 'easy' (Dämmerung / Dawn): gentler light drain, tempered enemies, forgiving drops.
 * - 'normal' (Eklipse / Eclipse): the original balanced survival baseline.
 * - 'hard' (Abgrund / Abyss): relentless speed & HP, lethal damage, aggressive swarms,
 *   new enemy attack mechanics, rewarding +50% score and +35% shards.
 */
export const Balance = {
  getDifficulty(): Difficulty {
    return settings.data.difficulty ?? 'normal';
  },

  // --- Enemies -------------------------------------------------------------
  /**
   * Enemy HP multiplier scaled by survival minutes and difficulty.
   */
  enemyHpScale(minutes: number): number {
    const base = 1 + 0.45 * minutes + 0.1 * minutes * minutes + 0.015 * minutes * minutes * minutes;
    const diff = this.getDifficulty();
    const mult = diff === 'easy' ? 0.75 : diff === 'hard' ? 1.45 : 1.0;
    return base * mult;
  },

  /** Enemy contact / projectile damage multiplier. */
  enemyDamageScale(minutes: number): number {
    const base = 1 + 0.05 * minutes + 0.002 * minutes * minutes;
    const diff = this.getDifficulty();
    const mult = diff === 'easy' ? 0.75 : diff === 'hard' ? 1.35 : 1.0;
    return base * mult;
  },

  /** Enemy movement speed multiplier. */
  enemySpeedScale(minutes: number): number {
    const base = 1 + Math.min(0.45, minutes * 0.045);
    const diff = this.getDifficulty();
    const mult = diff === 'easy' ? 0.88 : diff === 'hard' ? 1.18 : 1.0;
    return base * mult;
  },

  /** Chance that a regular spawn is an Elite Champion (starts earlier and higher on Hard). */
  eliteChance(seconds: number): number {
    const diff = this.getDifficulty();
    if (diff === 'easy') {
      if (seconds < 60) return 0;
      return Math.min(0.12, 0.025 + (seconds / 60) * 0.01);
    }
    if (diff === 'hard') {
      if (seconds < 25) return 0.04;
      return Math.min(0.36, 0.08 + (seconds / 60) * 0.03);
    }
    // Normal
    if (seconds < 50) return 0;
    return Math.min(0.18, 0.04 + (seconds / 60) * 0.015);
  },

  /** Enemies per spawn tick: grows over time. */
  packSize(seconds: number): number {
    const minutes = seconds / 60;
    let size = 1 + Math.floor(minutes / 2.5);
    if (seconds > 40 && Math.random() < 0.4) size += 1;
    const diff = this.getDifficulty();
    if (diff === 'easy') {
      return Math.max(1, Math.min(5, size - 1));
    }
    if (diff === 'hard') {
      return Math.min(8, size + 1);
    }
    return Math.min(6, size);
  },

  /** Seconds between spawn ticks. Brighter players attract enemies faster. */
  spawnInterval(seconds: number, lightRatio: number, bossActive: boolean): number {
    const timeFactor = 1 + seconds / 80;
    const bossSlowdown = bossActive ? 1.7 : 1.0;
    const baseInterval = Math.max(0.3, (1.25 * bossSlowdown) / (timeFactor * (0.8 + lightRatio * 0.35)));
    const diff = this.getDifficulty();
    if (diff === 'easy') return baseInterval * 1.25;
    if (diff === 'hard') return Math.max(0.2, baseInterval * 0.75);
    return baseInterval;
  },

  // --- Player --------------------------------------------------------------
  /** Natural light drain per second before reductions. */
  lightDrain(minutes: number): number {
    const base = Math.min(10, 2.6 + 0.3 * minutes);
    const diff = this.getDifficulty();
    if (diff === 'easy') return base * 0.8;
    if (diff === 'hard') return base * 1.25;
    return base;
  },

  /** XP required to go from `level` to `level + 1`. */
  xpToNext(level: number): number {
    return Math.floor(10 + 10 * level + 1.5 * level * level);
  },

  /** Invulnerability after taking a hit (seconds). */
  hitInvulnerability: 0.5,

  /** Hurtbox is smaller than the drawn orb so touch controls feel fair. */
  playerHurtRadius: 12,

  // --- Supernova (charged by kills) ----------------------------------------
  /** Kill points needed for the next Supernova; grows 25% per use. */
  novaChargeNeeded(uses: number): number {
    return Math.round(70 * Math.pow(1.25, uses));
  },
  /** Share of current light sacrificed by Supernova. */
  novaSacrifice: 0.5,

  // --- Bosses (endless chain) ----------------------------------------------
  /** Boss-free seconds before the next boss appears. */
  bossInterval(bossNumber: number): number {
    const base = bossNumber === 1 ? 150 : 140;
    const diff = this.getDifficulty();
    if (diff === 'easy') return base + 25;
    if (diff === 'hard') return Math.max(90, base - 25);
    return base;
  },
  /** Each boss has 2.5x the HP of the previous one. */
  bossHp(bossNumber: number): number {
    const base = Math.round(2400 * Math.pow(2.5, bossNumber - 1));
    const diff = this.getDifficulty();
    if (diff === 'easy') return Math.round(base * 0.75);
    if (diff === 'hard') return Math.round(base * 1.35);
    return base;
  },
  bossDamageScale(bossNumber: number): number {
    const base = 1 + 0.15 * (bossNumber - 1);
    const diff = this.getDifficulty();
    if (diff === 'easy') return base * 0.85;
    if (diff === 'hard') return base * 1.3;
    return base;
  },

  // --- Multipliers & Drops -------------------------------------------------
  scoreMultiplier(): number {
    const diff = this.getDifficulty();
    return diff === 'easy' ? 0.85 : diff === 'hard' ? 1.5 : 1.0;
  },
  shardMultiplier(): number {
    const diff = this.getDifficulty();
    return diff === 'easy' ? 1.0 : diff === 'hard' ? 1.35 : 1.0;
  },

  smallLightValue: 4.5,
  bigLightValue: 16,
  bigShardValue: 5,
  bigLightChance: 0.06,

  /**
   * Chance that a regular kill drops light at all.
   */
  lightDropChance(minutes: number): number {
    const base = 1 / (1 + minutes * 0.18);
    return this.getDifficulty() === 'easy' ? Math.min(1, base * 1.25) : base;
  },
  /** Shard chances shrink over a run because kill rates grow - keeps the Forge economy sane. */
  shardChance(minutes: number): number {
    const base = 0.22 / (1 + minutes * 0.35);
    return base * this.shardMultiplier();
  },
  bigShardChance(minutes: number): number {
    const base = 0.02 / (1 + minutes * 0.35);
    return base * this.shardMultiplier();
  }
};
