import { Player } from '../entities/Player';
import { Boss } from '../entities/Boss';
import { Weapon } from '../weapons/Weapon';

export class HUD {
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

  // Boss bar elements
  private bossBarContainer: HTMLElement | null;
  private bossBarFill: HTMLElement | null;
  private bossNameText: HTMLElement | null;
  private bossPhaseText: HTMLElement | null;

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

    this.bossBarContainer = document.getElementById('boss-bar-container');
    this.bossBarFill = document.getElementById('boss-bar-fill');
    this.bossNameText = document.getElementById('boss-name');
    this.bossPhaseText = document.getElementById('boss-phase');
  }

  public update(player: Player, survivalTime: number, boss: Boss | null, activeWeapons: Weapon[]) {
    // 1. Light bar
    const lightPercent = Math.max(0, Math.min(100, (player.light / player.maxLight) * 100));
    if (this.lightFill) {
      this.lightFill.style.width = `${lightPercent}%`;
      if (lightPercent < 25) {
        this.lightFill.style.background = 'linear-gradient(90deg, #e11d48, #f43f5e)';
        this.lightFill.style.boxShadow = '0 0 16px #f43f5e';
      } else {
        this.lightFill.style.background = 'linear-gradient(90deg, #0284c7 0%, #00f3ff 70%, #ffffff 100%)';
        this.lightFill.style.boxShadow = '0 0 16px #00f3ff';
      }
    }
    if (this.lightText) {
      this.lightText.textContent = `${Math.ceil(player.light)} / ${player.maxLight}`;
    }

    // 2. Level & Weapons
    if (this.levelText) {
      this.levelText.textContent = `LV ${player.level}`;
    }
    if (this.weaponsRow) {
      this.weaponsRow.innerHTML = activeWeapons
        .map((w) => `<div class="hud-weapon-badge" title="${w.getDisplayName()} LV ${w.level}">${w.icon}</div>`)
        .join('');
    }

    // 3. Timer & Phase
    const minutes = Math.floor(survivalTime / 60);
    const seconds = Math.floor(survivalTime % 60);
    const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    if (this.timerText) {
      this.timerText.textContent = timeFormatted;
    }
    if (this.phaseNameText) {
      if (survivalTime < 180) {
        this.phaseNameText.textContent = 'THE FIRST DARK';
      } else if (survivalTime < 360) {
        this.phaseNameText.textContent = 'THE ECLIPSE';
      } else if (survivalTime < 600) {
        this.phaseNameText.textContent = 'THE VOID SOVEREIGN';
      } else {
        this.phaseNameText.textContent = 'THE ETERNAL ABYSS';
      }
    }

    // 4. Score, Multiplier & Kills
    if (this.scoreText) {
      this.scoreText.textContent = `${Math.floor(player.score)}`;
    }
    if (this.multiplierText) {
      this.multiplierText.textContent = `x${player.scoreMultiplier.toFixed(1)}`;
    }
    if (this.killsText) {
      this.killsText.textContent = `${player.kills} kills`;
    }
    if (this.shardsText) {
      this.shardsText.textContent = `✨ ${player.shardsCollectedThisRun}`;
    }

    // 5. Dash cooldown ring
    if (this.dashRingProgress) {
      const circumference = 163.36; // 2 * Math.PI * 26
      const cdRatio = player.dashCooldown / player.dashMaxCooldown;
      const offset = circumference * cdRatio;
      this.dashRingProgress.style.strokeDashoffset = `${offset}`;
    }

    // 6. Boss bar
    if (boss && !boss.isDefeated) {
      if (this.bossBarContainer) this.bossBarContainer.classList.remove('hidden');
      if (this.bossNameText) this.bossNameText.textContent = boss.name;
      if (this.bossPhaseText) this.bossPhaseText.textContent = `PHASE ${boss.phase}`;
      if (this.bossBarFill) {
        const hpPercent = Math.max(0, Math.min(100, (boss.hp / boss.maxHp) * 100));
        this.bossBarFill.style.width = `${hpPercent}%`;
      }
    } else {
      if (this.bossBarContainer) this.bossBarContainer.classList.add('hidden');
    }
  }
}
