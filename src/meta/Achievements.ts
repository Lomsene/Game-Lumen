import { storage } from '../engine/Storage';
import { forge } from './Forge';
import { runStats } from './RunStats';
import type { Player } from '../entities/Player';
import type { Weapon } from '../weapons/Weapon';

export interface AchievementContext {
  time: number; // survival seconds this run
  player: Player;
  weapons: Weapon[];
  lifetimeKills: number;
  lifetimeRuns: number;
}

export interface AchievementDef {
  id: string;
  icon: string;
  name: string;
  description: string;
  reward: number; // shards
  check: (c: AchievementContext) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstLight', icon: '🕯️', name: 'Erstes Licht', description: 'Überlebe 1 Minute.', reward: 10, check: (c) => c.time >= 60 },
  { id: 'survivor5', icon: '⏱️', name: 'Standhaft', description: 'Überlebe 5 Minuten.', reward: 40, check: (c) => c.time >= 300 },
  { id: 'survivor10', icon: '🌑', name: 'Kind der Finsternis', description: 'Überlebe 10 Minuten und erreiche die Eklipse-Phase.', reward: 100, check: (c) => c.time >= 600 },
  { id: 'boss1', icon: '💀', name: 'Dunkelbrecher', description: 'Besiege deinen ersten Boss.', reward: 25, check: () => runStats.bossesDefeated >= 1 },
  { id: 'boss3', icon: '👑', name: 'Fürstentöter', description: 'Besiege 3 Bosse in einem Lauf.', reward: 80, check: () => runStats.bossesDefeated >= 3 },
  { id: 'noDash', icon: '🧘', name: 'Ruhige Hand', description: 'Überlebe 3 Minuten ohne einen einzigen Dash.', reward: 40, check: (c) => c.time >= 180 && runStats.dashes === 0 },
  { id: 'untouchable', icon: '🛡️', name: 'Unberührbar', description: 'Überlebe die ersten 2 Minuten ohne Treffer.', reward: 40, check: (c) => c.time >= 120 && runStats.hitsTaken === 0 },
  { id: 'combo50', icon: '🔥', name: 'Kettenreaktion', description: 'Erreiche eine Serie von 50 Kills.', reward: 30, check: () => runStats.maxCombo >= 50 },
  { id: 'obelisk3', icon: '🔮', name: 'Obelisk-Jäger', description: 'Erobere 3 Leeren-Obelisken in einem Lauf.', reward: 30, check: () => runStats.obelisksCaptured >= 3 },
  { id: 'evolve', icon: '✨', name: 'Evolution', description: 'Entwickle eine Waffe zu ihrer Evolution.', reward: 30, check: (c) => c.weapons.some((w) => w.isEvolved) },
  { id: 'arsenal', icon: '⚔️', name: 'Volles Arsenal', description: 'Führe 4 Waffen gleichzeitig.', reward: 25, check: (c) => c.weapons.length >= 4 },
  { id: 'brink', icon: '🌅', name: 'Am Abgrund', description: 'Falle unter 5% Licht und erhole dich auf über 80%.', reward: 35, check: (c) => runStats.lowestLightPct < 0.05 && c.player.light / c.player.maxLight > 0.8 },
  { id: 'kills1000', icon: '☄️', name: 'Lichtbringer', description: 'Besiege insgesamt 1.000 Feinde.', reward: 50, check: (c) => c.lifetimeKills >= 1000 },
  { id: 'runs10', icon: '🔁', name: 'Unermüdlich', description: 'Spiele 10 Durchläufe.', reward: 20, check: (c) => c.lifetimeRuns >= 10 }
];

/**
 * Tracks unlocked achievements and lifetime counters. Unlocking pays out Forge shards directly.
 */
class AchievementManager {
  public unlocked: Set<string> = new Set();
  public lifetimeKills: number = 0;
  public lifetimeRuns: number = 0;
  private readonly STORAGE_KEY = 'lumen_achievements_v1';

  public load() {
    try {
      const raw = storage.get(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.unlocked = new Set(Array.isArray(parsed.unlocked) ? parsed.unlocked : []);
        this.lifetimeKills = parsed.lifetimeKills ?? 0;
        this.lifetimeRuns = parsed.lifetimeRuns ?? 0;
      }
    } catch (e) {
      console.warn('Failed to load achievements', e);
    }
  }

  private save() {
    storage.set(
      this.STORAGE_KEY,
      JSON.stringify({ unlocked: [...this.unlocked], lifetimeKills: this.lifetimeKills, lifetimeRuns: this.lifetimeRuns })
    );
  }

  /** Checks all locked achievements; returns the newly unlocked ones (shards already awarded). */
  public evaluate(time: number, player: Player, weapons: Weapon[], runKillsPending: number = 0): AchievementDef[] {
    const ctx: AchievementContext = {
      time,
      player,
      weapons,
      lifetimeKills: this.lifetimeKills + runKillsPending,
      lifetimeRuns: this.lifetimeRuns
    };
    const fresh: AchievementDef[] = [];
    for (const a of ACHIEVEMENTS) {
      if (this.unlocked.has(a.id)) continue;
      if (a.check(ctx)) {
        this.unlocked.add(a.id);
        forge.addShards(a.reward);
        fresh.push(a);
      }
    }
    if (fresh.length > 0) this.save();
    return fresh;
  }

  /** Commits lifetime counters at the end of a run, then runs a final check. */
  public finishRun(time: number, player: Player, weapons: Weapon[]): AchievementDef[] {
    this.lifetimeKills += player.kills;
    this.lifetimeRuns += 1;
    this.save();
    return this.evaluate(time, player, weapons);
  }
}

export const achievements = new AchievementManager();
