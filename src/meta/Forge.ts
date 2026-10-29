/**
 * The Forge (Die Schmiede) - Meta-progression system for LUMEN.
 * Handles persistent Shards currency, permanent upgrades, and Highscores via LocalStorage.
 */

export type PlayerClassId = 'wanderer' | 'vanguard' | 'hunter' | 'architect';
export type PlayerSkinId = 'cyan' | 'solar' | 'emerald' | 'void' | 'crimson' | 'prismatic';

export interface PlayerClassDef {
  id: PlayerClassId;
  name: string;
  subtitle: string;
  description: string;
  startingWeaponId: string;
  icon: string;
  unlockCost: number;
  masteryUpgradeId: string;
}

export interface PlayerSkinDef {
  id: PlayerSkinId;
  name: string;
  description: string;
  cost: number;
  primaryColor: string;
  secondaryColor: string;
  trailRgba: string;
  coreColor: string;
  ringStyle: 'brackets' | 'crown' | 'diamond' | 'hex' | 'blades' | 'prismatic';
}

export const PLAYER_CLASSES: Record<PlayerClassId, PlayerClassDef> = {
  wanderer: {
    id: 'wanderer',
    name: 'Aether-Wanderer',
    subtitle: 'Ausgewogener Hüter',
    description: 'Startet mit PULSE. Ausgewogenes Licht, Tempo und Reichweite.',
    startingWeaponId: 'pulse',
    icon: '◎',
    unlockCost: 0,
    masteryUpgradeId: 'classMasteryWanderer'
  },
  vanguard: {
    id: 'vanguard',
    name: 'Solar-Vanguard',
    subtitle: 'Sonnen-Bollwerk',
    description: 'Startet mit ORBITERS. +30 Max-Licht & -15% Lichtverlust, aber -10% Tempo.',
    startingWeaponId: 'orbiters',
    icon: '🪐',
    unlockCost: 60,
    masteryUpgradeId: 'classMasteryVanguard'
  },
  hunter: {
    id: 'hunter',
    name: 'Void-Jäger',
    subtitle: 'Schatten-Assassine',
    description: 'Startet mit NEEDLES. +30% Waffenschaden & -25% Dash-Abklingzeit, aber -15 Max-Licht.',
    startingWeaponId: 'needles',
    icon: '⇶',
    unlockCost: 90,
    masteryUpgradeId: 'classMasteryHunter'
  },
  architect: {
    id: 'architect',
    name: 'Sternen-Architekt',
    subtitle: 'Kosmischer Konstrukteur',
    description: 'Startet mit BEACON. +20% Lichtkegel-Radius & +35% Magnet-Reichweite.',
    startingWeaponId: 'beacon',
    icon: '🏛️',
    unlockCost: 120,
    masteryUpgradeId: 'classMasteryArchitect'
  }
};

export const PLAYER_SKINS: Record<PlayerSkinId, PlayerSkinDef> = {
  cyan: {
    id: 'cyan',
    name: 'Aether-Kern',
    description: 'Reines, strahlendes Cyan-Sternenlicht.',
    cost: 0,
    primaryColor: '#00f3ff',
    secondaryColor: '#38bdf8',
    trailRgba: '56, 189, 248',
    coreColor: '#ffffff',
    ringStyle: 'brackets'
  },
  solar: {
    id: 'solar',
    name: 'Sonnen-Seraph',
    description: 'Goldene Korona mit strahlendem Sonnenkranz.',
    cost: 50,
    primaryColor: '#fbbf24',
    secondaryColor: '#f59e0b',
    trailRgba: '251, 191, 36',
    coreColor: '#fef3c7',
    ringStyle: 'crown'
  },
  emerald: {
    id: 'emerald',
    name: 'Smaragd-Pulsar',
    description: 'Bio-lumineszente Smaragd-Kristallgeometrie.',
    cost: 75,
    primaryColor: '#34d399',
    secondaryColor: '#10b981',
    trailRgba: '52, 211, 153',
    coreColor: '#ecfdf5',
    ringStyle: 'diamond'
  },
  void: {
    id: 'void',
    name: 'Leeren-Monarch',
    description: 'Dunkle Amethyst-Aura mit hexagonalem Runenschild.',
    cost: 100,
    primaryColor: '#c084fc',
    secondaryColor: '#a855f7',
    trailRgba: '192, 132, 252',
    coreColor: '#f3e8ff',
    ringStyle: 'hex'
  },
  crimson: {
    id: 'crimson',
    name: 'Blut-Eklipse',
    description: 'Karmesinroter Singularitätskern mit rotierenden Klingen.',
    cost: 130,
    primaryColor: '#f43f5e',
    secondaryColor: '#e11d48',
    trailRgba: '244, 63, 94',
    coreColor: '#ffe4e6',
    ringStyle: 'blades'
  },
  prismatic: {
    id: 'prismatic',
    name: 'Astral-Prisma',
    description: 'Mystisches, farbwechselndes Spektrallicht der Ewigkeit.',
    cost: 180,
    primaryColor: '#38bdf8',
    secondaryColor: '#ec4899',
    trailRgba: '236, 72, 153',
    coreColor: '#ffffff',
    ringStyle: 'prismatic'
  }
};

export interface ForgeUpgradeDef {
  id: string;
  name: string;
  description: string;
  baseCost: number;
  costMultiplier: number;
  maxLevel: number;
  icon: string;
  category?: 'general' | 'class';
}

export const FORGE_UPGRADES: Record<string, ForgeUpgradeDef> = {
  eternalFlame: {
    id: 'eternalFlame',
    name: 'Ewige Flamme',
    description: 'Beginne jeden Durchlauf mit zusätzlichem Licht (+12 pro Stufe).',
    baseCost: 20,
    costMultiplier: 1.8,
    maxLevel: 5,
    icon: '🔥',
    category: 'general'
  },
  radiantEndurance: {
    id: 'radiantEndurance',
    name: 'Dunkelheitsresistenz',
    description: 'Verringert den natürlichen Lichtzerfall um 5% pro Stufe.',
    baseCost: 25,
    costMultiplier: 2.0,
    maxLevel: 5,
    icon: '🛡️',
    category: 'general'
  },
  quickstep: {
    id: 'quickstep',
    name: 'Reflex-Matrix',
    description: 'Sprint lädt 6% schneller auf und gewährt längere Unverwundbarkeit.',
    baseCost: 30,
    costMultiplier: 2.0,
    maxLevel: 5,
    icon: '⚡',
    category: 'general'
  },
  shardAttractor: {
    id: 'shardAttractor',
    name: 'Magnet-Resonanz',
    description: 'Zieht Lichtfunken und Splitter aus 25% größerer Distanz an.',
    baseCost: 15,
    costMultiplier: 1.7,
    maxLevel: 5,
    icon: '🧲',
    category: 'general'
  },
  fortuneReroll: {
    id: 'fortuneReroll',
    name: 'Schicksalsgabe',
    description: 'Gewährt +1 zusätzlichen Reroll bei Stufenaufstiegen pro Durchlauf.',
    baseCost: 40,
    costMultiplier: 2.5,
    maxLevel: 3,
    icon: '🎲',
    category: 'general'
  },
  soulLuminance: {
    id: 'soulLuminance',
    name: 'Seelenstärke',
    description: 'Erhöht den Basisschaden aller Waffen dauerhaft um 6% pro Stufe.',
    baseCost: 35,
    costMultiplier: 2.2,
    maxLevel: 5,
    icon: '⚔️',
    category: 'general'
  },
  supernovaCatalyst: {
    id: 'supernovaCatalyst',
    name: 'Supernova-Fokus',
    description: 'Erhöht den Schaden der Supernova-Opferung um +25% und gewährt +1,5s längeren Overdrive.',
    baseCost: 45,
    costMultiplier: 2.1,
    maxLevel: 4,
    icon: '💥',
    category: 'general'
  },
  shardGreed: {
    id: 'shardGreed',
    name: 'Splitter-Alchemie',
    description: 'Erhöht die Chance auf Splitter-Drops von besiegten Feinden um +8% pro Stufe.',
    baseCost: 30,
    costMultiplier: 1.9,
    maxLevel: 5,
    icon: '💎',
    category: 'general'
  },
  // Class-specific Forge Mastery Upgrades
  classMasteryWanderer: {
    id: 'classMasteryWanderer',
    name: 'Wanderer-Meisterschaft',
    description: '[Aether-Wanderer] +8% Abklingzeitverringerung & +8% Lichtkegel-Radius pro Stufe.',
    baseCost: 30,
    costMultiplier: 2.0,
    maxLevel: 5,
    icon: '◎',
    category: 'class'
  },
  classMasteryVanguard: {
    id: 'classMasteryVanguard',
    name: 'Vanguard-Meisterschaft',
    description: '[Solar-Vanguard] +12 Max-Licht & +10% mehr Licht aus Lichtfunken pro Stufe.',
    baseCost: 35,
    costMultiplier: 2.0,
    maxLevel: 5,
    icon: '🪐',
    category: 'class'
  },
  classMasteryHunter: {
    id: 'classMasteryHunter',
    name: 'Jäger-Meisterschaft',
    description: '[Void-Jäger] +7% Kritische Trefferchance & +10% Krit-Schaden pro Stufe.',
    baseCost: 35,
    costMultiplier: 2.0,
    maxLevel: 5,
    icon: '⇶',
    category: 'class'
  },
  classMasteryArchitect: {
    id: 'classMasteryArchitect',
    name: 'Architekten-Meisterschaft',
    description: '[Sternen-Architekt] +10% Waffenschaden & +12% schnelleres Aufladen von Obelisken pro Stufe.',
    baseCost: 35,
    costMultiplier: 2.0,
    maxLevel: 5,
    icon: '🏛️',
    category: 'class'
  }
};

export class ForgeManager {
  public shards: number = 0;
  public totalShardsCollected: number = 0;
  public levels: Record<string, number> = {};
  public bestSurvivalTime: number = 0; // in seconds
  public bestScore: number = 0;

  public unlockedClasses: PlayerClassId[] = ['wanderer'];
  public selectedClass: PlayerClassId = 'wanderer';

  public unlockedSkins: PlayerSkinId[] = ['cyan'];
  public selectedSkin: PlayerSkinId = 'cyan';

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
        this.unlockedClasses = Array.isArray(parsed.unlockedClasses) && parsed.unlockedClasses.length > 0
          ? parsed.unlockedClasses
          : ['wanderer'];
        this.selectedClass = parsed.selectedClass ?? 'wanderer';
        this.unlockedSkins = Array.isArray(parsed.unlockedSkins) && parsed.unlockedSkins.length > 0
          ? parsed.unlockedSkins
          : ['cyan'];
        this.selectedSkin = parsed.selectedSkin ?? 'cyan';
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
        bestScore: this.bestScore,
        unlockedClasses: this.unlockedClasses,
        selectedClass: this.selectedClass,
        unlockedSkins: this.unlockedSkins,
        selectedSkin: this.selectedSkin
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }

  public isClassUnlocked(classId: PlayerClassId): boolean {
    return this.unlockedClasses.includes(classId);
  }

  public unlockOrSelectClass(classId: PlayerClassId): boolean {
    if (this.isClassUnlocked(classId)) {
      this.selectedClass = classId;
      this.save();
      return true;
    }
    const def = PLAYER_CLASSES[classId];
    if (!def || this.shards < def.unlockCost) return false;
    this.shards -= def.unlockCost;
    this.unlockedClasses.push(classId);
    this.selectedClass = classId;
    this.save();
    return true;
  }

  public isSkinUnlocked(skinId: PlayerSkinId): boolean {
    return this.unlockedSkins.includes(skinId);
  }

  public unlockOrSelectSkin(skinId: PlayerSkinId): boolean {
    if (this.isSkinUnlocked(skinId)) {
      this.selectedSkin = skinId;
      this.save();
      return true;
    }
    const def = PLAYER_SKINS[skinId];
    if (!def || this.shards < def.cost) return false;
    this.shards -= def.cost;
    this.unlockedSkins.push(skinId);
    this.selectedSkin = skinId;
    this.save();
    return true;
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
