import { Player } from '../entities/Player';
import { Weapon } from '../weapons/Weapon';
import { GiftCardOption, generateGiftChoices, applyGiftChoice } from '../upgrades/UpgradePool';
import { sound } from '../engine/Sound';

export class GiftModal {
  private modalEl: HTMLElement | null;
  private levelLabelEl: HTMLElement | null;
  private cardsContainerEl: HTMLElement | null;
  private rerollBtn: HTMLButtonElement | null;
  private rerollCountEl: HTMLElement | null;
  private skipBtn: HTMLButtonElement | null;

  public rerollsLeft: number = 1;
  private currentChoices: GiftCardOption[] = [];
  private onChoiceSelected: (() => void) | null = null;
  private player: Player | null = null;
  private weapons: Weapon[] = [];

  constructor() {
    this.modalEl = document.getElementById('gift-modal');
    this.levelLabelEl = document.getElementById('gift-level-label');
    this.cardsContainerEl = document.getElementById('gift-cards');
    this.rerollBtn = document.getElementById('gift-reroll-btn') as HTMLButtonElement;
    this.rerollCountEl = document.getElementById('gift-reroll-count');
    this.skipBtn = document.getElementById('gift-skip-btn') as HTMLButtonElement;

    if (this.rerollBtn) {
      this.rerollBtn.addEventListener('click', () => this.handleReroll());
    }
    if (this.skipBtn) {
      this.skipBtn.addEventListener('click', () => this.handleSkip());
    }
  }

  public show(
    player: Player,
    weapons: Weapon[],
    rerollBonus: number,
    onComplete: () => void
  ) {
    this.player = player;
    this.weapons = weapons;
    this.onChoiceSelected = onComplete;

    if (this.levelLabelEl) {
      this.levelLabelEl.textContent = `LEVEL ${player.level}`;
    }

    this.rerollsLeft = 1 + rerollBonus;
    this.updateRerollButton();

    this.generateCards();

    if (this.modalEl) {
      this.modalEl.classList.remove('hidden');
    }
  }

  public hide() {
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
  }

  private generateCards() {
    if (!this.player) return;
    this.currentChoices = generateGiftChoices(this.player, this.weapons);
    this.renderCards();
  }

  private renderCards() {
    if (!this.cardsContainerEl) return;
    this.cardsContainerEl.innerHTML = '';

    for (let i = 0; i < this.currentChoices.length; i++) {
      const choice = this.currentChoices[i];
      const card = document.createElement('div');
      card.className = `gift-card ${choice.themeColor}`;

      // Level tag e.g. "LV 0 -> 1" or "LV 1 -> 2"
      const levelText = choice.isEvolution
        ? 'EVOLUTION'
        : `LV ${choice.currentLevel} → ${choice.nextLevel}`;

      const levelBadgeHtml = choice.tag === 'NEW WEAPON'
        ? ''
        : `<span class="card-level-badge">${levelText}</span>`;

      card.innerHTML = `
        ${levelBadgeHtml}
        <div class="card-icon-box">
          ${choice.icon}
        </div>
        <h3 class="card-title">${choice.title}</h3>
        <p class="card-description">${choice.description}</p>
        <div class="card-tag-pill ${choice.themeColor}">${choice.tag}</div>
      `;

      card.addEventListener('click', () => {
        if (!this.player) return;
        applyGiftChoice(choice, this.player, this.weapons);
        sound.playShard(true);
        this.hide();
        if (this.onChoiceSelected) this.onChoiceSelected();
      });

      this.cardsContainerEl.appendChild(card);
    }
  }

  private handleReroll() {
    if (this.rerollsLeft <= 0 || !this.player) return;
    this.rerollsLeft -= 1;
    this.updateRerollButton();
    sound.playShoot(450, 0.1);
    this.generateCards();
  }

  private updateRerollButton() {
    if (this.rerollCountEl) {
      this.rerollCountEl.textContent = `${this.rerollsLeft}`;
    }
    if (this.rerollBtn) {
      this.rerollBtn.disabled = this.rerollsLeft <= 0;
    }
  }

  private handleSkip() {
    if (!this.player) return;
    // Skip awards +12 Light!
    this.player.addLight(12);
    sound.playShard();
    this.hide();
    if (this.onChoiceSelected) this.onChoiceSelected();
  }
}
