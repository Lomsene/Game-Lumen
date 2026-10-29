import { Player } from '../entities/Player';
import { Weapon } from '../weapons/Weapon';
import {
  PulseWeapon,
  LanceWeapon,
  SparksWeapon,
  OrbitersWeapon,
  FlareWeapon,
  RadianceWeapon,
  NeedlesWeapon,
  BeaconWeapon
} from '../weapons/WeaponRegistry';

export interface GiftCardOption {
  id: string;
  type: 'weapon' | 'upgrade';
  tag: 'NEW WEAPON' | 'WEAPON' | 'UPGRADE' | 'EVOLUTION';
  title: string;
  description: string;
  icon: string;
  themeColor: 'gold' | 'amber' | 'cyan' | 'green' | 'magenta';
  currentLevel: number;
  nextLevel: number;
  maxLevel: number;
  isEvolution?: boolean;
}

export interface PassiveUpgradeDef {
  id: string;
  name: string;
  icon: string;
  themeColor: 'gold' | 'amber' | 'cyan' | 'green' | 'magenta';
  maxLevel: number;
  description: (lvl: number) => string;
  apply: (player: Player, lvl: number) => void;
}

export const PASSIVE_UPGRADES: Record<string, PassiveUpgradeDef> = {
  deepReserve: {
    id: 'deepReserve',
    name: 'DEEP RESERVE',
    icon: '◎',
    themeColor: 'cyan',
    maxLevel: 5,
    description: () => '+18 max light, refilled now.',
    apply: (player) => {
      player.maxLight += 18;
      player.light = player.maxLight;
    }
  },
  blink: {
    id: 'blink',
    name: 'BLINK',
    icon: '⏩',
    themeColor: 'cyan',
    maxLevel: 3,
    description: () => 'Dash recharges 22% faster and goes further.',
    apply: () => {}
  },
  fortune: {
    id: 'fortune',
    name: 'FORTUNE',
    icon: '⚂',
    themeColor: 'amber',
    maxLevel: 4,
    description: () => 'Better upgrade offers and +12% score.',
    apply: (player) => {
      player.scoreMultiplier += 0.12;
    }
  },
  radiantIntensity: {
    id: 'radiantIntensity',
    name: 'RADIANT INTENSITY',
    icon: '⚡',
    themeColor: 'gold',
    maxLevel: 5,
    description: () => '+15% damage to all weapons.',
    apply: () => {}
  },
  swiftSteps: {
    id: 'swiftSteps',
    name: 'SWIFT STEPS',
    icon: '🥾',
    themeColor: 'cyan',
    maxLevel: 4,
    description: () => '+15% movement speed.',
    apply: () => {}
  },
  lightHarvester: {
    id: 'lightHarvester',
    name: 'LIGHT HARVESTER',
    icon: '🌾',
    themeColor: 'amber',
    maxLevel: 4,
    description: () => 'Enemies drop 30% more light on defeat.',
    apply: () => {}
  },
  shardMagnet: {
    id: 'shardMagnet',
    name: 'SHARD MAGNET',
    icon: '🧲',
    themeColor: 'cyan',
    maxLevel: 4,
    description: () => 'Pulls shards and light from 60% greater distance.',
    apply: () => {}
  },
  overcharge: {
    id: 'overcharge',
    name: 'OVERCHARGE',
    icon: '✨',
    themeColor: 'gold',
    maxLevel: 4,
    description: () => '+12% critical hit chance with lightning sparks.',
    apply: () => {}
  },
  phosphorCoat: {
    id: 'phosphorCoat',
    name: 'PHOSPHOR COAT',
    icon: '🔥',
    themeColor: 'magenta',
    maxLevel: 4,
    description: () => 'Enemies inside your light suffer continuous burn damage.',
    apply: () => {}
  },
  resonance: {
    id: 'resonance',
    name: 'RESONANCE',
    icon: '🌀',
    themeColor: 'cyan',
    maxLevel: 4,
    description: () => 'All weapons attack 12% faster.',
    apply: () => {}
  },
  prismaticLens: {
    id: 'prismaticLens',
    name: 'PRISMATIC LENS',
    icon: '🔍',
    themeColor: 'gold',
    maxLevel: 4,
    description: () => '+20% base light radius and weapon reach.',
    apply: () => {}
  },
  prismShield: {
    id: 'prismShield',
    name: 'PRISM SHIELD',
    icon: '🛡️',
    themeColor: 'cyan',
    maxLevel: 1,
    description: () => 'Absorbs one fatal hit every 20s and creates a shockwave.',
    apply: (player) => {
      player.shieldActive = true;
    }
  },
  innerCore: {
    id: 'innerCore',
    name: 'INNER CORE',
    icon: '☀️',
    themeColor: 'amber',
    maxLevel: 3,
    description: () => 'Reduces natural light drain by 20%.',
    apply: () => {}
  }
};

export const ALL_WEAPON_CLASSES = [
  PulseWeapon,
  LanceWeapon,
  SparksWeapon,
  OrbitersWeapon,
  FlareWeapon,
  RadianceWeapon,
  NeedlesWeapon,
  BeaconWeapon
];

export function generateGiftChoices(player: Player, activeWeapons: Weapon[]): GiftCardOption[] {
  const choices: GiftCardOption[] = [];
  const activeIds = new Set(activeWeapons.map((w) => w.id));

  // 1. Upgrade existing weapons or evolve them
  for (const w of activeWeapons) {
    if (w.level < w.maxLevel) {
      choices.push({
        id: `weapon_${w.id}`,
        type: 'weapon',
        tag: 'WEAPON',
        title: w.name,
        description: `Upgrade ${w.name} to level ${w.level + 1}.`,
        icon: w.icon,
        themeColor: 'cyan',
        currentLevel: w.level,
        nextLevel: w.level + 1,
        maxLevel: w.maxLevel
      });
    } else if (!w.isEvolved) {
      choices.push({
        id: `weapon_${w.id}_evo`,
        type: 'weapon',
        tag: 'EVOLUTION',
        title: w.evolvedName,
        description: w.evolvedDescription,
        icon: '★',
        themeColor: 'gold',
        currentLevel: 5,
        nextLevel: 6,
        maxLevel: 6,
        isEvolution: true
      });
    }
  }

  // 2. Offer new weapons (if player has space, max 4 weapons at once)
  if (activeWeapons.length < 4) {
    for (const WeaponClass of ALL_WEAPON_CLASSES) {
      const sample = new WeaponClass();
      if (!activeIds.has(sample.id)) {
        const themeColor: 'gold' | 'amber' | 'cyan' | 'green' =
          sample.id === 'lance' ? 'gold' : sample.id === 'sparks' ? 'green' : 'amber';
        choices.push({
          id: `new_weapon_${sample.id}`,
          type: 'weapon',
          tag: 'NEW WEAPON',
          title: sample.name,
          description: sample.description,
          icon: sample.icon,
          themeColor,
          currentLevel: 0,
          nextLevel: 1,
          maxLevel: sample.maxLevel
        });
      }
    }
  }

  // 3. Passive Upgrades
  for (const [id, def] of Object.entries(PASSIVE_UPGRADES)) {
    const curLvl = player.passives.get(id) ?? 0;
    if (curLvl < def.maxLevel) {
      choices.push({
        id: `passive_${id}`,
        type: 'upgrade',
        tag: 'UPGRADE',
        title: def.name,
        description: def.description(curLvl + 1),
        icon: def.icon,
        themeColor: def.themeColor,
        currentLevel: curLvl,
        nextLevel: curLvl + 1,
        maxLevel: def.maxLevel
      });
    }
  }

  // Shuffle and pick 3 unique cards
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return choices.slice(0, 3);
}

export function applyGiftChoice(
  choice: GiftCardOption,
  player: Player,
  activeWeapons: Weapon[]
) {
  if (choice.type === 'weapon') {
    if (choice.id.startsWith('new_weapon_')) {
      const weaponId = choice.id.replace('new_weapon_', '');
      const FoundClass = ALL_WEAPON_CLASSES.find((c) => new c().id === weaponId);
      if (FoundClass) {
        activeWeapons.push(new FoundClass());
      }
    } else {
      const weaponId = choice.id.replace('weapon_', '').replace('_evo', '');
      const existing = activeWeapons.find((w) => w.id === weaponId);
      if (existing) {
        existing.upgrade();
      }
    }
  } else {
    const passiveId = choice.id.replace('passive_', '');
    const def = PASSIVE_UPGRADES[passiveId];
    if (def) {
      const curLvl = (player.passives.get(passiveId) ?? 0) + 1;
      player.passives.set(passiveId, curLvl);
      def.apply(player, curLvl);
    }
  }
}
