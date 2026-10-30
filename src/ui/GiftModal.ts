import { Player } from '../entities/Player';
import { Weapon } from '../weapons/Weapon';
import { GiftCardOption, generateGiftChoices, applyGiftChoice } from '../upgrades/UpgradePool';
import { sound } from '../engine/Sound';

const TAG_LABELS: Record<string, string> = {
  'NEW WEAPON': 'NEUE WAFFE',
  WEAPON: 'WAFFE',
  UPGRADE: 'UPGRADE',
  EVOLUTION: 'EVOLUTION',
  'ECLIPSE PACT': 'ECLIPSE-PAKT',
  'CLASS MASTERY': 'KLASSE'
};

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
  /** Ignore taps for a moment after opening so a held joystick finger can't pick a card. */
  private inputLockedUntil: number = 0;
  private isOpen: boolean = false;

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

    // Keyboard shortcuts: 1/2/3 pick a card, R rerolls, S skips
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen || e.repeat) return;
      const idx = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code) % 3;
      if (idx >= 0 && this.currentChoices[idx]) this.pick(this.currentChoices[idx]);
      else if (e.code === 'KeyR') this.handleReroll();
      else if (e.code === 'KeyS') this.handleSkip();
    });
  }

  private isLocked(): boolean {
    return performance.now() < this.inputLockedUntil;
  }

  private pick(choice: GiftCardOption) {
    if (!this.player || !this.isOpen || this.isLocked()) return;
    applyGiftChoice(choice, this.player, this.weapons);
    sound.playShard(true);
    this.close();
  }

  private close() {
    this.isOpen = false;
    this.hide();
    if (this.onChoiceSelected) this.onChoiceSelected();
  }

  public show(
    player: Player,
    weapons: Weapon[],
    rerollBonus: number,
    label: string,
    onComplete: () => void
  ) {
    this.player = player;
    this.weapons = weapons;
    this.onChoiceSelected = onComplete;
    this.isOpen = true;
    this.inputLockedUntil = performance.now() + 350;

    if (this.levelLabelEl) {
      this.levelLabelEl.textContent = label;
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
      card.style.animationDelay = `${i * 60}ms`;

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
        <div class="card-tag-pill ${choice.themeColor}">${TAG_LABELS[choice.tag] ?? choice.tag}</div>
        <span class="card-key-hint">${i + 1}</span>
      `;

      card.addEventListener('click', () => this.pick(choice));

      this.cardsContainerEl.appendChild(card);
    }
  }

  private handleReroll() {
    if (this.rerollsLeft <= 0 || !this.player || !this.isOpen || this.isLocked()) return;
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
    if (!this.player || !this.isOpen || this.isLocked()) return;
    // Skip awards +12 Light
    this.player.addLight(12);
    sound.playShard();
    this.close();
  }
}
