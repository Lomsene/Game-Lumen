import { Player } from '../entities/Player';
import { Boss } from '../entities/Boss';
import { Weapon } from '../weapons/Weapon';
import { SVG_ICONS } from '../upgrades/UpgradePool';

export class HUD {
  // Light bar elements
  private lightFill: HTMLElement | null;
  private lightText: HTMLElement | null;
  private levelText: HTMLElement | null;
  private timerText: HTMLElement | null;
  private phaseNameText: HTMLElement | null;
  private scoreText: HTMLElement | null;
  private multiplierText: HTMLElement | null;
  private killsText: HTMLElement | null;
  private shardsText: HTMLElement | null;
  private weaponsRow: HTMLElement | null;
  private dashRingProgress: SVGCircleElement | null;
  private supernovaRingProgress: SVGCircleElement | null;
  private supernovaTextEl: HTMLElement | null;
  private supernovaIndicatorEl: HTMLElement | null;

  // Boss bar elements (at absolute top)
  private bossBarContainer: HTMLElement | null;
  private bossBarFill: HTMLElement | null;
  private bossNameText: HTMLElement | null;
  private bossPhaseText: HTMLElement | null;
  private bossHpNumbers: HTMLElement | null;

  // Gem / XP progress bar elements (at top)
  private gemFill: HTMLElement | null;
  private gemLevelTag: HTMLElement | null;
  private gemProgressText: HTMLElement | null;

  // Cached values to prevent redundant DOM layout thrashing at 60/120 FPS
  private lastWeaponsKey: string = '';
  private lastLightText: string = '';
  private lastLightLow: boolean | null = null;
  private lastLevel: number = -1;
  private lastTimeFormatted: string = '';
  private lastPhaseName: string = '';
  private lastScoreInt: number = -1;
  private lastMultStr: string = '';
  private lastMultVisible: boolean = false;
  private lastKillsStr: string = '';
  private lastShards: number = -1;
  private lastDashOffset: string = '';
  private lastSupernovaOffset: string = '';
  private lastSupernovaLabel: string = '';
  private lastBossVisible: boolean = false;

  constructor() {
    this.lightFill = document.getElementById('hud-light-fill');
    this.lightText = document.getElementById('hud-light-text');
    this.levelText = document.getElementById('hud-level');
    this.timerText = document.getElementById('hud-timer');
    this.phaseNameText = document.getElementById('hud-phase-name');
    this.scoreText = document.getElementById('hud-score');
    this.multiplierText = document.getElementById('hud-multiplier');
    this.killsText = document.getElementById('hud-kills');
    this.shardsText = document.getElementById('hud-shards-ingame');
    this.weaponsRow = document.getElementById('hud-active-weapons');
    this.dashRingProgress = document.getElementById('dash-ring-progress') as unknown as SVGCircleElement;
    this.supernovaRingProgress = document.getElementById('supernova-ring-progress') as unknown as SVGCircleElement;
    this.supernovaTextEl = document.getElementById('supernova-text');
    this.supernovaIndicatorEl = document.getElementById('supernova-indicator');

    this.bossBarContainer = document.getElementById('boss-bar-container');
    this.bossBarFill = document.getElementById('boss-bar-fill');
    this.bossNameText = document.getElementById('boss-name');
    this.bossPhaseText = document.getElementById('boss-phase');
    this.bossHpNumbers = document.getElementById('boss-hp-numbers');

    this.gemFill = document.getElementById('hud-gem-fill');
    this.gemLevelTag = document.getElementById('hud-gem-level-tag');
    this.gemProgressText = document.getElementById('hud-gem-progress-text');
  }

  public update(player: Player, survivalTime: number, boss: Boss | null, activeWeapons: Weapon[]) {
    // 1. Gem / XP Progress Bar
    const xpRatio = Math.max(0, Math.min(1, player.xp / player.xpToNextLevel));
    if (this.gemFill) {
      this.gemFill.style.width = `${(xpRatio * 100).toFixed(1)}%`;
    }
    if (this.gemProgressText) {
      this.gemProgressText.textContent = `${player.xp} / ${player.xpToNextLevel} XP (${Math.floor(xpRatio * 100)}%)`;
    }

    // 2. Light bar
    const lightPercent = Math.max(0, Math.min(100, (player.light / player.maxLight) * 100));
    if (this.lightFill) {
      this.lightFill.style.width = `${lightPercent.toFixed(1)}%`;
      const isLow = lightPercent < 25;
      if (isLow !== this.lastLightLow) {
        this.lastLightLow = isLow;
        if (isLow) {
          this.lightFill.style.background = 'linear-gradient(90deg, #e11d48, #f43f5e)';
          this.lightFill.style.boxShadow = '0 0 16px #f43f5e';
        } else {
          this.lightFill.style.background = 'linear-gradient(90deg, #0284c7 0%, #00f3ff 70%, #ffffff 100%)';
          this.lightFill.style.boxShadow = '0 0 16px #00f3ff';
        }
      }
    }
    if (this.lightText) {
      const lStr = `${Math.ceil(player.light)} / ${player.maxLight}`;
      if (lStr !== this.lastLightText) {
        this.lastLightText = lStr;
        this.lightText.textContent = lStr;
      }
    }

    // 3. Level & Weapons (Only rebuild SVG DOM when weapon list or levels actually change!)
    if (player.level !== this.lastLevel) {
      this.lastLevel = player.level;
      if (this.levelText) this.levelText.textContent = `LV ${player.level}`;
      if (this.gemLevelTag) this.gemLevelTag.textContent = `LEVEL ${player.level}`;
    }

    if (this.weaponsRow) {
      let weaponsKey = '';
      for (let i = 0; i < activeWeapons.length; i++) {
        const w = activeWeapons[i];
        weaponsKey += `${w.id}:${w.level}:${w.isEvolved ? 1 : 0}|`;
      }
      if (weaponsKey !== this.lastWeaponsKey) {
        this.lastWeaponsKey = weaponsKey;
        this.weaponsRow.innerHTML = activeWeapons
          .map((w) => {
            const svg = SVG_ICONS[w.id] ?? w.icon;
            const smallSvg = svg.replace('width="46"', 'width="16"').replace('height="46"', 'height="16"');
            return `<div class="hud-weapon-pill" title="${w.getDisplayName()} LV ${w.level}">
              <span class="hud-weapon-pill-icon">${smallSvg}</span>
              <span>L${w.level}</span>
            </div>`;
          })
          .join('');
      }
    }

    // 4. Timer & Phase
    const minutes = Math.floor(survivalTime / 60);
    const seconds = Math.floor(survivalTime % 60);
    const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    if (timeFormatted !== this.lastTimeFormatted) {
      this.lastTimeFormatted = timeFormatted;
      if (this.timerText) this.timerText.textContent = timeFormatted;
    }

    if (this.phaseNameText) {
      const phaseName =
        survivalTime < 120
          ? 'THE FIRST DARK'
          : survivalTime < 270
            ? 'THE ECLIPSE'
            : survivalTime < 450
              ? 'THE VOID SOVEREIGN'
              : 'THE ETERNAL ABYSS';
      if (phaseName !== this.lastPhaseName) {
        this.lastPhaseName = phaseName;
        this.phaseNameText.textContent = phaseName;
      }
    }

    // 5. Score, Multiplier & Kills
    const scoreInt = Math.floor(player.score);
    if (scoreInt !== this.lastScoreInt) {
      this.lastScoreInt = scoreInt;
      if (this.scoreText) this.scoreText.textContent = `${scoreInt}`;
    }

    if (this.multiplierText) {
      const totalMult = player.getTotalMultiplier();
      const shouldShow = player.kills > 0 || totalMult > 1.01;
      if (shouldShow) {
        const multStr = `x${totalMult.toFixed(1)}`;
        if (multStr !== this.lastMultStr) {
          this.lastMultStr = multStr;
          this.multiplierText.textContent = multStr;
        }
        if (!this.lastMultVisible) {
          this.lastMultVisible = true;
          this.multiplierText.classList.remove('hidden');
        }
      } else if (this.lastMultVisible) {
        this.lastMultVisible = false;
        this.multiplierText.classList.add('hidden');
      }
    }

    if (this.killsText) {
      const streakStr = player.comboCount >= 5 ? ` • 🔥${player.comboCount}` : '';
      const killsStr = `${player.kills} kills${streakStr}`;
      if (killsStr !== this.lastKillsStr) {
        this.lastKillsStr = killsStr;
        this.killsText.textContent = killsStr;
      }
    }

    if (this.shardsText && player.shardsCollectedThisRun !== this.lastShards) {
      this.lastShards = player.shardsCollectedThisRun;
      this.shardsText.textContent = player.shardsCollectedThisRun > 0 ? `✨ ${player.shardsCollectedThisRun}` : '';
    }

    // 6. Dash cooldown ring
    if (this.dashRingProgress) {
      const circumference = 150.8;
      const cdRatio = player.dashCooldown / player.dashMaxCooldown;
      const offsetStr = (circumference * cdRatio).toFixed(1);
      if (offsetStr !== this.lastDashOffset) {
        this.lastDashOffset = offsetStr;
        this.dashRingProgress.style.strokeDashoffset = offsetStr;
      }
    }

    // 6b. Supernova (97% Light Sacrifice, 1x per 10 min) cooldown ring
    if (this.supernovaRingProgress) {
      const circumference = 150.8;
      const cdRatio = Math.max(0, Math.min(1, player.supernovaCooldown / player.supernovaMaxCooldown));
      const offsetStr = (circumference * cdRatio).toFixed(1);
      if (offsetStr !== this.lastSupernovaOffset) {
        this.lastSupernovaOffset = offsetStr;
        this.supernovaRingProgress.style.strokeDashoffset = offsetStr;
      }
    }
    if (this.supernovaTextEl) {
      let label = 'NOVA [R]';
      if (player.supernovaCooldown > 0) {
        const m = Math.floor(player.supernovaCooldown / 60);
        const s = Math.floor(player.supernovaCooldown % 60);
        label = `${m}:${s < 10 ? '0' : ''}${s}`;
      }
      if (label !== this.lastSupernovaLabel) {
        this.lastSupernovaLabel = label;
        this.supernovaTextEl.textContent = label;
      }
    }
    if (this.supernovaIndicatorEl) {
      const ready = player.supernovaCooldown <= 0 && player.light > 8;
      this.supernovaIndicatorEl.classList.toggle('nova-ready', ready);
    }

    // 7. Boss Health Bar
    if (boss && !boss.isDefeated) {
      if (!this.lastBossVisible) {
        this.lastBossVisible = true;
        if (this.bossBarContainer) this.bossBarContainer.classList.remove('hidden');
      }
      if (this.bossNameText) this.bossNameText.textContent = boss.name;
      if (this.bossPhaseText) this.bossPhaseText.textContent = `PHASE ${boss.phase} / ${boss.maxPhases}`;
      if (this.bossHpNumbers) this.bossHpNumbers.textContent = `${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp} HP`;
      if (this.bossBarFill) {
        const hpPercent = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
        this.bossBarFill.style.width = `${hpPercent.toFixed(1)}%`;
      }
    } else if (this.lastBossVisible) {
      this.lastBossVisible = false;
      if (this.bossBarContainer) this.bossBarContainer.classList.add('hidden');
    }
  }
}
