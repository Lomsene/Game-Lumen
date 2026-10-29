/**
 * The Forge (Die Schmiede) - Meta-progression system for LUMEN.
 * Handles persistent Shards currency, permanent upgrades, and Highscores via LocalStorage.
 */

export interface ForgeUpgradeDef {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  maxLevel: number;
  icon: string;
}

export const FORGE_UPGRADES: Record<string, ForgeUpgradeDef> = {
  eternalFlame: {
    id: 'eternalFlame',
    name: 'Ewige Flamme',
    description: 'Beginne jeden Durchlauf mit zusätzlichem Licht (+12 pro Stufe).',
    baseCost: 20,
    costMultiplier: 1.8,
    maxLevel: 5,
    icon: '🔥'
  },
  radiantEndurance: {
    id: 'radiantEndurance',
    name: 'Dunkelheitsresistenz',
    description: 'Verringert den natürlichen Lichtzerfall um 5% pro Stufe.',
    baseCost: 25,
    costMultiplier: 2.0,
    maxLevel: 5,
    icon: '🛡️'
  },
  quickstep: {
    id: 'quickstep',
    name: 'Reflex-Matrix',
    description: 'Sprint lädt 6% schneller auf und gewährt längere Unverwundbarkeit.',
    baseCost: 30,
    costMultiplier: 2.0,
    maxLevel: 5,
    icon: '⚡'
  },
  shardAttractor: {
    id: 'shardAttractor',
    name: 'Magnet-Resonanz',
    description: 'Zieht Lichtfunken und Splitter aus 25% größerer Distanz an.',
    baseCost: 15,
    costMultiplier: 1.7,
    maxLevel: 5,
    icon: '🧲'
  },
  fortuneReroll: {
    id: 'fortuneReroll',
    name: 'Schicksalsgabe',
    description: 'Gewährt +1 zusätzlichen Reroll bei Stufenaufstiegen pro Durchlauf.',
    baseCost: 40,
    costMultiplier: 2.5,
    maxLevel: 3,
    icon: '🎲'
  },
  soulLuminance: {
    id: 'soulLuminance',
    name: 'Seelenstärke',
    description: 'Erhöht den Basisschaden aller Waffen dauerhaft um 6% pro Stufe.',
    baseCost: 35,
    costMultiplier: 2.2,
    maxLevel: 5,
    icon: '⚔️'
  }
};

export class ForgeManager {
  public shards: number = 0;
  public totalShardsCollected: number = 0;
  public levels: Record<string, number> = {};
  public bestSurvivalTime: number = 0; // in seconds
  public bestScore: number = 0;

  private readonly STORAGE_KEY = 'lumen_save_v1';

  constructor() {
    this.load();
  }

  public load() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        this.shards = parsed.shards ?? 0;
        this.totalShardsCollected = parsed.totalShardsCollected ?? 0;
        this.levels = parsed.levels ?? {};
        this.bestSurvivalTime = parsed.bestSurvivalTime ?? 0;
        this.bestScore = parsed.bestScore ?? 0;
      }
    } catch (e) {
      console.warn('Failed to load save from localStorage', e);
    }
  }

  public save() {
    try {
      const data = {
        shards: this.shards,
        totalShardsCollected: this.totalShardsCollected,
        levels: this.levels,
        bestSurvivalTime: this.bestSurvivalTime,
        bestScore: this.bestScore
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }

  public addShards(amount: number) {
    this.shards += amount;
    this.totalShardsCollected += amount;
    this.save();
  }

  public recordRun(survivalSeconds: number, score: number) {
    if (survivalSeconds > this.bestSurvivalTime) {
      this.bestSurvivalTime = survivalSeconds;
    }
    if (score > this.bestScore) {
      this.bestScore = score;
    }
    this.save();
  }

  public getLevel(id: string): number {
    return this.levels[id] ?? 0;
  }

  public getCost(id: string): number {
    const def = FORGE_UPGRADES[id];
    if (!def) return 999999;
    const currentLvl = this.getLevel(id);
    if (currentLvl >= def.maxLevel) return 0;
    return Math.floor(def.baseCost * Math.pow(def.costMultiplier, currentLvl));
  }

  public canBuy(id: string): boolean {
    const def = FORGE_UPGRADES[id];
    if (!def) return false;
    const currentLvl = this.getLevel(id);
    if (currentLvl >= def.maxLevel) return false;
    return this.shards >= this.getCost(id);
  }

  public buy(id: string): boolean {
    if (!this.canBuy(id)) return false;
    const cost = this.getCost(id);
    this.shards -= cost;
    this.levels[id] = this.getLevel(id) + 1;
    this.save();
    return true;
  }
}

export const forge = new ForgeManager();
