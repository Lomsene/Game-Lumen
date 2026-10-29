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
  tag: 'NEW WEAPON' | 'WEAPON' | 'UPGRADE' | 'EVOLUTION' | 'ECLIPSE PACT' | 'CLASS MASTERY';
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
  requiredClass?: string;
  description: (lvl: number) => string;
  apply: (player: Player, lvl: number) => void;
}

export const SVG_ICONS: Record<string, string> = {
  pulse: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor"><circle cx="24" cy="24" r="4" fill="currentColor" stroke="none"/><circle cx="24" cy="24" r="9" stroke-width="2"/><circle cx="24" cy="24" r="14" stroke-width="1.8" opacity="0.75"/><circle cx="24" cy="24" r="19" stroke-width="1.5" opacity="0.5"/></svg>`,
  lance: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor"><line x1="12" y1="32" x2="33" y2="17" stroke-width="2.6" stroke-linecap="round"/><polygon points="38,13 28,16 32,22" fill="currentColor" stroke="none"/></svg>`,
  sparks: `<svg width="46" height="46" viewBox="0 0 48 48" fill="currentColor" stroke="none"><path d="M18 11 L19.8 15.2 L24 17 L19.8 18.8 L18 23 L16.2 18.8 L12 17 L16.2 15.2 Z"/><path d="M31 9 L32.4 12.6 L36 14 L32.4 15.4 L31 19 L29.6 15.4 L26 14 L29.6 12.6 Z"/><path d="M19 26 L20.5 29.5 L24 31 L20.5 32.5 L19 36 L17.5 32.5 L14 31 L17.5 29.5 Z"/><path d="M32 23 L33.5 26.5 L37 28 L33.5 29.5 L32 33 L30.5 29.5 L27 28 L30.5 26.5 Z"/></svg>`,
  orbiters: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor"><circle cx="24" cy="24" r="14" stroke-width="1.6" stroke-dasharray="4 4" opacity="0.7"/><circle cx="24" cy="10" r="4" fill="currentColor" stroke="none"/><circle cx="36" cy="31" r="4" fill="currentColor" stroke="none"/><circle cx="12" cy="31" r="4" fill="currentColor" stroke="none"/></svg>`,
  flare: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor"><circle cx="24" cy="24" r="7" fill="currentColor" opacity="0.3"/><circle cx="24" cy="24" r="12" stroke-width="2"/><path d="M24 6 L24 10 M24 38 L24 42 M6 24 L10 24 M38 24 L42 24 M11 11 L14 14 M34 34 L37 37 M37 11 L34 14 M14 34 L11 37" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  radiance: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor"><circle cx="24" cy="24" r="5" fill="currentColor"/><line x1="24" y1="24" x2="42" y2="14" stroke-width="3" stroke-linecap="round"/><line x1="24" y1="24" x2="6" y2="34" stroke-width="3" stroke-linecap="round" opacity="0.5"/></svg>`,
  needles: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="10" y1="24" x2="36" y2="24"/><polyline points="30,19 37,24 30,29"/><line x1="14" y1="16" x2="32" y2="16" opacity="0.7"/><line x1="14" y1="32" x2="32" y2="32" opacity="0.7"/></svg>`,
  beacon: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor"><polygon points="24,8 34,36 14,36" stroke-width="2" fill="currentColor" fill-opacity="0.15"/><circle cx="24" cy="18" r="3" fill="currentColor"/></svg>`,
  deepReserve: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor"><circle cx="24" cy="24" r="15" stroke-width="2" fill="currentColor" fill-opacity="0.15"/><circle cx="24" cy="24" r="6.5" fill="currentColor" stroke="none"/></svg>`,
  blink: `<svg width="46" height="46" viewBox="0 0 48 48" fill="currentColor" stroke="none"><polygon points="13,13 26,24 13,35"/><polygon points="26,13 39,24 26,35" opacity="0.65"/></svg>`,
  fortune: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor"><rect x="12" y="12" width="24" height="24" rx="2" stroke-width="2.2"/><circle cx="18" cy="18" r="2.2" fill="currentColor" stroke="none"/><circle cx="24" cy="24" r="2.2" fill="currentColor" stroke="none"/><circle cx="30" cy="30" r="2.2" fill="currentColor" stroke="none"/></svg>`,
  radiantIntensity: `<svg width="46" height="46" viewBox="0 0 48 48" fill="currentColor" stroke="none"><polygon points="26,8 12,26 23,26 20,40 36,21 25,21"/></svg>`,
  swiftSteps: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M10 18 H32 C36 18 38 15 36 12"/><path d="M8 25 H38 C42 25 42 30 38 30"/><path d="M14 32 H28"/></svg>`,
  lightHarvester: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="24" cy="24" r="10" stroke-dasharray="3 3"/><circle cx="24" cy="24" r="4" fill="currentColor"/><path d="M24 8 V12 M24 36 V40 M8 24 H12 M36 24 H40"/></svg>`,
  shardMagnet: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 14 V25 C14 31 34 31 34 25 V14"/><line x1="14" y1="19" x2="20" y2="19"/><line x1="28" y1="19" x2="34" y2="19"/></svg>`,
  overcharge: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><polygon points="24,8 28,20 40,24 28,28 24,40 20,28 8,24 20,20" fill="currentColor" fill-opacity="0.2"/></svg>`,
  phosphorCoat: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M24 10 C32 18 36 24 36 30 C36 36.6 30.6 40 24 40 C17.4 40 12 36.6 12 30 C12 24 16 18 24 10 Z" fill="currentColor" fill-opacity="0.2"/><circle cx="24" cy="30" r="4" fill="currentColor"/></svg>`,
  resonance: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="24" cy="24" r="5"/><path d="M15 15 A13 13 0 0 1 33 15"/><path d="M33 33 A13 13 0 0 1 15 33"/><path d="M11 11 A19 19 0 0 1 37 11" opacity="0.6"/><path d="M37 37 A19 19 0 0 1 11 37" opacity="0.6"/></svg>`,
  prismaticLens: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="24" cy="24" r="14"/><ellipse cx="24" cy="24" rx="14" ry="6"/><ellipse cx="24" cy="24" rx="6" ry="14"/></svg>`,
  prismShield: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M24 8 L38 14 V24 C38 33 24 40 24 40 C24 40 10 33 10 24 V14 L24 8 Z" fill="currentColor" fill-opacity="0.18"/></svg>`,
  innerCore: `<svg width="46" height="46" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="24" cy="24" r="9" fill="currentColor" fill-opacity="0.3"/><circle cx="24" cy="24" r="4" fill="currentColor"/><circle cx="24" cy="24" r="16" stroke-dasharray="4 4"/></svg>`,
  evo: `<svg width="46" height="46" viewBox="0 0 48 48" fill="currentColor" stroke="currentColor" stroke-width="1.5"><polygon points="24,6 29,18 42,19 32,28 35,41 24,34 13,41 16,28 6,19 19,18"/></svg>`
};

export const PASSIVE_UPGRADES: Record<string, PassiveUpgradeDef> = {
  deepReserve: {
    id: 'deepReserve',
    name: 'DEEP RESERVE',
    icon: SVG_ICONS.deepReserve,
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
    icon: SVG_ICONS.blink,
    themeColor: 'cyan',
    maxLevel: 3,
    description: () => 'Dash recharges 22% faster and goes further.',
    apply: () => {}
  },
  fortune: {
    id: 'fortune',
    name: 'FORTUNE',
    icon: SVG_ICONS.fortune,
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
    icon: SVG_ICONS.radiantIntensity,
    themeColor: 'gold',
    maxLevel: 5,
    description: () => '+15% damage to all weapons.',
    apply: () => {}
  },
  swiftSteps: {
    id: 'swiftSteps',
    name: 'SWIFT STEPS',
    icon: SVG_ICONS.swiftSteps,
    themeColor: 'cyan',
    maxLevel: 4,
    description: () => '+15% movement speed.',
    apply: () => {}
  },
  lightHarvester: {
    id: 'lightHarvester',
    name: 'LIGHT HARVESTER',
    icon: SVG_ICONS.lightHarvester,
    themeColor: 'amber',
    maxLevel: 4,
    description: () => 'Enemies drop 30% more light on defeat.',
    apply: () => {}
  },
  shardMagnet: {
    id: 'shardMagnet',
    name: 'SHARD MAGNET',
    icon: SVG_ICONS.shardMagnet,
    themeColor: 'cyan',
    maxLevel: 4,
    description: () => 'Pulls shards and light from 60% greater distance.',
    apply: () => {}
  },
  overcharge: {
    id: 'overcharge',
    name: 'OVERCHARGE',
    icon: SVG_ICONS.overcharge,
    themeColor: 'gold',
    maxLevel: 4,
    description: () => '+12% critical hit chance with lightning sparks.',
    apply: () => {}
  },
  phosphorCoat: {
    id: 'phosphorCoat',
    name: 'PHOSPHOR COAT',
    icon: SVG_ICONS.phosphorCoat,
    themeColor: 'magenta',
    maxLevel: 4,
    description: () => 'Enemies inside your light suffer continuous burn damage.',
    apply: () => {}
  },
  resonance: {
    id: 'resonance',
    name: 'RESONANCE',
    icon: SVG_ICONS.resonance,
    themeColor: 'cyan',
    maxLevel: 4,
    description: () => 'All weapons attack 12% faster.',
    apply: () => {}
  },
  prismaticLens: {
    id: 'prismaticLens',
    name: 'PRISMATIC LENS',
    icon: SVG_ICONS.prismaticLens,
    themeColor: 'gold',
    maxLevel: 5,
    description: () => '+25% light perimeter radius and weapon reach.',
    apply: () => {}
  },
  astralBeacon: {
    id: 'astralBeacon',
    name: 'ASTRAL EXPANSION',
    icon: SVG_ICONS.innerCore,
    themeColor: 'cyan',
    maxLevel: 4,
    description: () => '+18% light perimeter size and +12 max light.',
    apply: (player) => {
      player.maxLight += 12;
      player.light = Math.min(player.maxLight, player.light + 12);
    }
  },
  bloodPact: {
    id: 'bloodPact',
    name: 'BLOOD ECLIPSE',
    icon: SVG_ICONS.phosphorCoat,
    themeColor: 'magenta',
    maxLevel: 2,
    description: () => 'ECLIPSE PACT: +45% all weapon damage, but +20% faster light drain.',
    apply: () => {}
  },
  voidGlass: {
    id: 'voidGlass',
    name: 'VOID GLASS',
    icon: SVG_ICONS.overcharge,
    themeColor: 'magenta',
    maxLevel: 2,
    description: () => 'ECLIPSE PACT: +35% weapon damage & +15% speed, but -18 max light.',
    apply: (player) => {
      player.maxLight = Math.max(55, player.maxLight - 18);
      player.light = Math.min(player.light, player.maxLight);
    }
  },
  prismShield: {
    id: 'prismShield',
    name: 'PRISM SHIELD',
    icon: SVG_ICONS.prismShield,
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
    icon: SVG_ICONS.innerCore,
    themeColor: 'amber',
    maxLevel: 3,
    description: () => 'Reduces natural light drain by 20%.',
    apply: () => {}
  },
  // Additional General Upgrades
  solarWrath: {
    id: 'solarWrath',
    name: 'SOLAR WRATH',
    icon: SVG_ICONS.flare,
    themeColor: 'gold',
    maxLevel: 4,
    description: () => '+22% weapon damage and +10 max light.',
    apply: (player) => {
      player.maxLight += 10;
      player.light = Math.min(player.maxLight, player.light + 10);
    }
  },
  chronoAccelerator: {
    id: 'chronoAccelerator',
    name: 'CHRONO MATRIX',
    icon: SVG_ICONS.resonance,
    themeColor: 'cyan',
    maxLevel: 3,
    description: () => '+15% attack speed and reduces Supernova cooldown by 30s now.',
    apply: (player) => {
      player.supernovaCooldown = Math.max(0, player.supernovaCooldown - 30);
    }
  },
  voidExecutioner: {
    id: 'voidExecutioner',
    name: 'VOID EXECUTIONER',
    icon: SVG_ICONS.lance,
    themeColor: 'magenta',
    maxLevel: 3,
    description: () => '+20% damage to all foes and +25% bonus score multiplier.',
    apply: (player) => {
      player.scoreMultiplier += 0.25;
    }
  },
  novaAscension: {
    id: 'novaAscension',
    name: 'SUPERNOVA ASCENSION',
    icon: SVG_ICONS.evo,
    themeColor: 'gold',
    maxLevel: 3,
    description: () => 'Supernova deals +45% blast damage and grants +2.5s longer Overdrive.',
    apply: () => {}
  },
  phantomStep: {
    id: 'phantomStep',
    name: 'PHANTOM STEP',
    icon: SVG_ICONS.blink,
    themeColor: 'green',
    maxLevel: 3,
    description: () => '+14% movement speed and Dash shockwave radius increased.',
    apply: () => {}
  },
  // Class-Specific In-Run Mastery Upgrades
  wandererHarmony: {
    id: 'wandererHarmony',
    name: 'AETHER HARMONY',
    icon: SVG_ICONS.pulse,
    themeColor: 'cyan',
    maxLevel: 3,
    requiredClass: 'wanderer',
    description: () => '[Aether-Wanderer] +18% light radius, +16% weapon damage & +15 Light.',
    apply: (player) => {
      player.addLight(15);
    }
  },
  vanguardBastion: {
    id: 'vanguardBastion',
    name: 'SOLAR BASTION',
    icon: SVG_ICONS.orbiters,
    themeColor: 'amber',
    maxLevel: 3,
    requiredClass: 'vanguard',
    description: () => '[Solar-Vanguard] +25 Max Light, -14% light drain & +20% weapon damage.',
    apply: (player) => {
      player.maxLight += 25;
      player.addLight(25);
    }
  },
  hunterLethality: {
    id: 'hunterLethality',
    name: 'VOID LETHALITY',
    icon: SVG_ICONS.needles,
    themeColor: 'magenta',
    maxLevel: 3,
    requiredClass: 'hunter',
    description: () => '[Void-Jäger] +25% weapon damage, +12% crit chance & +25% crit damage.',
    apply: () => {}
  },
  architectGrid: {
    id: 'architectGrid',
    name: 'STELLAR MATRIX',
    icon: SVG_ICONS.beacon,
    themeColor: 'gold',
    maxLevel: 3,
    requiredClass: 'architect',
    description: () => '[Sternen-Architekt] +22% light perimeter reach & Obelisks charge 30% faster.',
    apply: (player) => {
      player.maxLight += 15;
      player.addLight(15);
    }
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
        description: w.description,
        icon: SVG_ICONS[w.id] ?? w.icon,
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
        icon: SVG_ICONS.evo,
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
          icon: SVG_ICONS[sample.id] ?? sample.icon,
          themeColor,
          currentLevel: 0,
          nextLevel: 1,
          maxLevel: sample.maxLevel
        });
      }
    }
  }

  // 3. Passive Upgrades, Class Masteries & Eclipse Pacts
  for (const [id, def] of Object.entries(PASSIVE_UPGRADES)) {
    if (def.requiredClass && def.requiredClass !== player.classId) {
      continue;
    }
    const curLvl = player.passives.get(id) ?? 0;
    if (curLvl < def.maxLevel) {
      const isPact = id === 'bloodPact' || id === 'voidGlass';
      const isClassUpgrade = !!def.requiredClass;
      choices.push({
        id: `passive_${id}`,
        type: 'upgrade',
        tag: isClassUpgrade ? 'CLASS MASTERY' : isPact ? 'ECLIPSE PACT' : 'UPGRADE',
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
