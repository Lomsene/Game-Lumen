import { forge, FORGE_UPGRADES } from '../meta/Forge';
import { sound } from '../engine/Sound';

export class ForgeModal {
  private modalEl: HTMLElement | null;
  private shardsDisplayEl: HTMLElement | null;
  private itemsGridEl: HTMLElement | null;
  private closeBtn: HTMLElement | null;
  private onClosed: (() => void) | null = null;

  constructor() {
    this.modalEl = document.getElementById('forge-modal');
    this.shardsDisplayEl = document.getElementById('forge-shards-display');
    this.itemsGridEl = document.getElementById('forge-items-grid');
    this.closeBtn = document.getElementById('btn-close-forge');

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.hide());
    }
  }

  public show(onClose?: () => void) {
    this.onClosed = onClose ?? null;
    this.render();
    if (this.modalEl) {
      this.modalEl.classList.remove('hidden');
    }
  }

  public hide() {
    if (this.modalEl) {
      this.modalEl.classList.add('hidden');
    }
    if (this.onClosed) this.onClosed();
  }

  public render() {
    if (this.shardsDisplayEl) {
      this.shardsDisplayEl.textContent = `${forge.shards}`;
    }

    if (!this.itemsGridEl) return;
    this.itemsGridEl.innerHTML = '';

    for (const [id, def] of Object.entries(FORGE_UPGRADES)) {
      const curLvl = forge.getLevel(id);
      const isMax = curLvl >= def.maxLevel;
      const cost = forge.getCost(id);
      const canAfford = forge.canBuy(id);

      const itemCard = document.createElement('div');
      itemCard.className = 'forge-item';

      // Build level pips
      let pipsHtml = '';
      for (let p = 0; p < def.maxLevel; p++) {
        pipsHtml += `<div class="forge-pip ${p < curLvl ? 'active' : ''}"></div>`;
      }

      itemCard.innerHTML = `
        <div class="forge-item-top">
          <span class="forge-item-name">${def.icon} ${def.name}</span>
          <span class="forge-item-level">LV ${curLvl} / ${def.maxLevel}</span>
        </div>
        <p class="forge-item-desc">${def.description}</p>
        <div class="forge-pips-row">${pipsHtml}</div>
        <button class="forge-buy-btn" ${!canAfford || isMax ? 'disabled' : ''}>
          ${isMax ? 'MAX' : `✨ ${cost} Splitter`}
        </button>
      `;

      const buyBtn = itemCard.querySelector('.forge-buy-btn');
      if (buyBtn && !isMax) {
        buyBtn.addEventListener('click', () => {
          if (forge.buy(id)) {
            sound.playShard(true);
            this.render();
          }
        });
      }

      this.itemsGridEl.appendChild(itemCard);
    }
  }
}
