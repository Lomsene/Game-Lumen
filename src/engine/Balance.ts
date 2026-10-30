/**
 * Central balance formulas for AETHER: ECLIPSE.
 *
 * The run is endless: difficulty rises continuously with survival time (minutes).
 * All scaling curves are polynomial instead of exponential so the game gets steadily
 * harder without hitting an unbeatable wall after a few minutes.
 * `npm run balance` prints these curves as a table (scripts/balance-table.mjs mirrors them).
 */
export const Balance = {
  // --- Enemies -------------------------------------------------------------
  /**
   * Enemy HP multiplier: x7.6 @5min, x30 @10min, x81 @15min, x170 @20min.
   * The cubic term makes sure no build can outscale the darkness forever.
   */
  enemyHpScale(minutes: number): number {
    return 1 + 0.45 * minutes + 0.1 * minutes * minutes + 0.015 * minutes * minutes * minutes;
  },

  /** Enemy contact / projectile damage multiplier: x1.7 @10min, x2.8 @20min. */
  enemyDamageScale(minutes: number): number {
    return 1 + 0.05 * minutes + 0.002 * minutes * minutes;
  },

  /** Enemy movement speed multiplier, capped at +45%. */
  enemySpeedScale(minutes: number): number {
    return 1 + Math.min(0.45, minutes * 0.045);
  },

  /** Chance that a regular spawn is an Elite Champion (starts at 0:50). */
  eliteChance(seconds: number): number {
    if (seconds < 50) return 0;
    return Math.min(0.18, 0.04 + (seconds / 60) * 0.015);
  },

  /** Enemies per spawn tick: 1 at start, grows every 2.5 minutes (max 6). */
  packSize(seconds: number): number {
    const minutes = seconds / 60;
    let size = 1 + Math.floor(minutes / 2.5);
    if (seconds > 40 && Math.random() < 0.4) size += 1;
    return Math.min(6, size);
  },

  /** Seconds between spawn ticks. Brighter players attract enemies faster. */
  spawnInterval(seconds: number, lightRatio: number, bossActive: boolean): number {
    const timeFactor = 1 + seconds / 80;
    const bossSlowdown = bossActive ? 1.7 : 1.0;
    return Math.max(0.3, (1.25 * bossSlowdown) / (timeFactor * (0.8 + lightRatio * 0.35)));
  },

  // --- Player --------------------------------------------------------------
  /** Natural light drain per second before reductions (capped at 10/s). */
  lightDrain(minutes: number): number {
    return Math.min(10, 2.6 + 0.3 * minutes);
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
    return bossNumber === 1 ? 150 : 140;
  },
  /** Each boss has 2.5x the HP of the previous one. */
  bossHp(bossNumber: number): number {
    return Math.round(2400 * Math.pow(2.5, bossNumber - 1));
  },
  bossDamageScale(bossNumber: number): number {
    return 1 + 0.15 * (bossNumber - 1);
  },

  // --- Drops ---------------------------------------------------------------
  smallLightValue: 4.5,
  bigLightValue: 16,
  bigShardValue: 5,
  bigLightChance: 0.06,
  /**
   * Chance that a regular kill drops light at all. Falls over time as kill rates rise,
   * so light (= life) stays scarce even late in a run.
   */
  lightDropChance(minutes: number): number {
    return 1 / (1 + minutes * 0.18);
  },
  /** Shard chances shrink over a run because kill rates grow - keeps the Forge economy sane. */
  shardChance(minutes: number): number {
    return 0.22 / (1 + minutes * 0.35);
  },
  bigShardChance(minutes: number): number {
    return 0.02 / (1 + minutes * 0.35);
  }
};
