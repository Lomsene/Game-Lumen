/**
 * Per-run statistics (damage per source, max combo, dashes, ...).
 * Damage is attributed to whatever source is "active" when takeDamage() runs:
 * the Game sets `source` before updating each weapon / resolving each projectile hit.
 */
export const SOURCE_LABELS: Record<string, string> = {
  supernova: 'Supernova',
  obelisk: 'Obelisk-Nova',
  phosphor: 'Phosphor-Glut',
  other: 'Sonstiges'
};

class RunStats {
  public source: string = 'other';
  public damageBySource: Map<string, number> = new Map();
  public maxCombo: number = 0;
  public dashes: number = 0;
  public bossesDefeated: number = 0;
  public elitesDefeated: number = 0;
  public obelisksCaptured: number = 0;
  public supernovas: number = 0;
  public hitsTaken: number = 0;
  public lowestLightPct: number = 1;

  public reset() {
    this.source = 'other';
    this.damageBySource = new Map();
    this.maxCombo = 0;
    this.dashes = 0;
    this.bossesDefeated = 0;
    this.elitesDefeated = 0;
    this.obelisksCaptured = 0;
    this.supernovas = 0;
    this.hitsTaken = 0;
    this.lowestLightPct = 1;
  }

  public recordDamage(amount: number) {
    if (!(amount > 0)) return;
    this.damageBySource.set(this.source, (this.damageBySource.get(this.source) ?? 0) + amount);
  }

  public get totalDamage(): number {
    let sum = 0;
    for (const v of this.damageBySource.values()) sum += v;
    return sum;
  }
}

export const runStats = new RunStats();
