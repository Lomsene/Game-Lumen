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
  private lastXpWidth: string = '';
  private lightWidth: string = '';
  private lastBossWidth: string = '';
  private lastBossHpText: string = '';
  private lastBossPhaseText: string = '';
  private lastBossName: string = '';
  private lastNovaReady: boolean | null = null;
  private touchNovaBtn: HTMLElement | null;
  private touchNovaFill: HTMLElement | null;
  private touchDashBtn: HTMLElement | null;
  private lastTouchNova: string = '';
  private lastDashReady: boolean | null = null;

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
    this.touchNovaBtn = document.getElementById('touch-nova-btn');
    this.touchNovaFill = document.getElementById('touch-nova-fill');
    this.touchDashBtn = document.getElementById('touch-dash-btn');
  }

  /** Forget cached values so a new run redraws everything. */
  public reset() {
    this.lastWeaponsKey = '';
    this.lastLightText = '';
    this.lastLightLow = null;
    this.lastLevel = -1;
    this.lastTimeFormatted = '';
    this.lastPhaseName = '';
    this.lastScoreInt = -1;
    this.lastKillsStr = '';
    this.lastShards = -1;
    this.lastXpWidth = '';
    this.lightWidth = '';
    this.lastNovaReady = null;
    this.lastTouchNova = '';
    this.lastDashReady = null;
    this.lastSupernovaLabel = '';
    this.lastSupernovaOffset = '';
    this.lastDashOffset = '';
  }

  public update(player: Player, survivalTime: number, boss: Boss | null, activeWeapons: Weapon[], phaseLabel: string) {
    // 1. Gem / XP Progress Bar
    const xpRatio = Math.max(0, Math.min(1, player.xp / player.xpToNextLevel));
    const xpWidth = `${(xpRatio * 100).toFixed(1)}%`;
    if (this.gemFill && xpWidth !== this.lastXpWidth) {
      this.lastXpWidth = xpWidth;
      this.gemFill.style.width = xpWidth;
    }

    // 2. Light bar
    const lightPercent = Math.max(0, Math.min(100, (player.light / player.maxLight) * 100));
    if (this.lightFill) {
      const lw = `${lightPercent.toFixed(1)}%`;
      if (lw !== this.lightWidth) {
        this.lightWidth = lw;
        this.lightFill.style.width = lw;
      }
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

    if (this.phaseNameText && phaseLabel !== this.lastPhaseName) {
      this.lastPhaseName = phaseLabel;
      this.phaseNameText.textContent = phaseLabel;
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
      const killsStr = `${player.kills} Kills${streakStr}`;
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
    const circumference = 150.8;
    if (this.dashRingProgress) {
      const cdRatio = player.dashCooldown / player.dashMaxCooldown;
      const offsetStr = (circumference * cdRatio).toFixed(0);
      if (offsetStr !== this.lastDashOffset) {
        this.lastDashOffset = offsetStr;
        this.dashRingProgress.style.strokeDashoffset = offsetStr;
      }
    }
    const dashReady = player.dashCooldown <= 0;
    if (this.touchDashBtn && dashReady !== this.lastDashReady) {
      this.lastDashReady = dashReady;
      this.touchDashBtn.classList.toggle('on-cooldown', !dashReady);
    }

    // 6b. Supernova charge (filled by kills)
    const novaRatio = Math.max(0, Math.min(1, player.novaCharge / player.getNovaChargeNeeded()));
    if (this.supernovaRingProgress) {
      const offsetStr = (circumference * (1 - novaRatio)).toFixed(0);
      if (offsetStr !== this.lastSupernovaOffset) {
        this.lastSupernovaOffset = offsetStr;
        this.supernovaRingProgress.style.strokeDashoffset = offsetStr;
      }
    }
    const novaReady = player.isNovaReady() && player.light > 8;
    const novaLabel = novaReady ? 'NOVA [R]' : `${Math.floor(novaRatio * 100)}%`;
    if (this.supernovaTextEl && novaLabel !== this.lastSupernovaLabel) {
      this.lastSupernovaLabel = novaLabel;
      this.supernovaTextEl.textContent = novaLabel;
    }
    if (novaReady !== this.lastNovaReady) {
      this.lastNovaReady = novaReady;
      this.supernovaIndicatorEl?.classList.toggle('nova-ready', novaReady);
      this.touchNovaBtn?.classList.toggle('nova-ready', novaReady);
    }
    const touchFill = `${(novaRatio * 100).toFixed(0)}%`;
    if (this.touchNovaFill && touchFill !== this.lastTouchNova) {
      this.lastTouchNova = touchFill;
      this.touchNovaFill.style.height = touchFill;
    }

    // 7. Boss Health Bar
    if (boss && !boss.isDefeated) {
      if (!this.lastBossVisible) {
        this.lastBossVisible = true;
        if (this.bossBarContainer) this.bossBarContainer.classList.remove('hidden');
      }
      const name = `BOSS ${boss.bossNumber} • ${boss.name}`;
      if (this.bossNameText && name !== this.lastBossName) {
        this.lastBossName = name;
        this.bossNameText.textContent = name;
      }
      const phaseStr = `PHASE ${boss.phase} / ${boss.maxPhases}`;
      if (this.bossPhaseText && phaseStr !== this.lastBossPhaseText) {
        this.lastBossPhaseText = phaseStr;
        this.bossPhaseText.textContent = phaseStr;
      }
      const hpStr = `${formatBig(Math.max(0, Math.ceil(boss.hp)))} / ${formatBig(boss.maxHp)} HP`;
      if (this.bossHpNumbers && hpStr !== this.lastBossHpText) {
        this.lastBossHpText = hpStr;
        this.bossHpNumbers.textContent = hpStr;
      }
      const hpPercent = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
      const bw = `${hpPercent.toFixed(1)}%`;
      if (this.bossBarFill && bw !== this.lastBossWidth) {
        this.lastBossWidth = bw;
        this.bossBarFill.style.width = bw;
      }
    } else if (this.lastBossVisible) {
      this.lastBossVisible = false;
      if (this.bossBarContainer) this.bossBarContainer.classList.add('hidden');
    }
  }
}

/** 1234567 -> "1.23M", 45600 -> "45.6k" */
function formatBig(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`;
  return `${n}`;
}
