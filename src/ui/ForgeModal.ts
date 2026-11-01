import {
  forge,
  FORGE_UPGRADES,
  PLAYER_CLASSES,
  PLAYER_SKINS,
  PlayerClassId,
  PlayerSkinId
} from '../meta/Forge';
import { sound } from '../engine/Sound';
import { t } from '../meta/i18n';

type ForgeTab = 'upgrades' | 'classes' | 'skins';

export class ForgeModal {
  private modalEl: HTMLElement | null;
  private shardsDisplayEl: HTMLElement | null;
  private itemsGridEl: HTMLElement | null;
  private closeBtn: HTMLElement | null;
  private tabButtons: NodeListOf<HTMLElement>;
  private activeTab: ForgeTab = 'upgrades';
  private onClosed: (() => void) | null = null;

  constructor() {
    this.modalEl = document.getElementById('forge-modal');
    this.shardsDisplayEl = document.getElementById('forge-shards-display');
    this.itemsGridEl = document.getElementById('forge-items-grid');
    this.closeBtn = document.getElementById('btn-close-forge');
    this.tabButtons = document.querySelectorAll('.forge-tab-btn');

    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.hide());
    }

    this.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = (btn.dataset.tab as ForgeTab) || 'upgrades';
        this.activeTab = tab;
        this.tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
        sound.playShoot(600, 0.05);
        this.render();
      });
    });
  }

  public show(onClose?: () => void, initialTab: ForgeTab = 'upgrades') {
    this.onClosed = onClose ?? null;
    this.activeTab = initialTab;
    this.tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === initialTab));
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

    if (this.activeTab === 'upgrades') {
      this.renderUpgrades();
    } else if (this.activeTab === 'classes') {
      this.renderClasses();
    } else if (this.activeTab === 'skins') {
      this.renderSkins();
    }
  }

  private renderUpgrades() {
    if (!this.itemsGridEl) return;

    for (const [id, def] of Object.entries(FORGE_UPGRADES)) {
      if (def.category === 'class') continue; // Class masteries are rendered in the Classes tab AND here if unlocked
      this.appendUpgradeCard(id, def);
    }
  }

  private appendUpgradeCard(id: string, def: (typeof FORGE_UPGRADES)[string]) {
    if (!this.itemsGridEl) return;
    const curLvl = forge.getLevel(id);
    const isMax = curLvl >= def.maxLevel;
    const cost = forge.getCost(id);
    const canAfford = forge.canBuy(id);

    const itemCard = document.createElement('div');
    itemCard.className = 'forge-item';

    let pipsHtml = '';
    for (let p = 0; p < def.maxLevel; p++) {
      pipsHtml += `<div class="forge-pip ${p < curLvl ? 'active' : ''}"></div>`;
    }

    const nameKey = `forge_up_${id}_name`;
    const descKey = `forge_up_${id}_desc`;
    const name = t(nameKey) !== nameKey ? t(nameKey) : def.name;
    const desc = t(descKey) !== descKey ? t(descKey, curLvl + 1) : def.description;

    itemCard.innerHTML = `
      <div class="forge-item-top">
        <span class="forge-item-name">${def.icon} ${name}</span>
        <span class="forge-item-level">LV ${curLvl} / ${def.maxLevel}</span>
      </div>
      <p class="forge-item-desc">${desc}</p>
      <div class="forge-pips-row">${pipsHtml}</div>
      <button class="forge-buy-btn" ${!canAfford || isMax ? 'disabled' : ''}>
        ${isMax ? t('forge_btn_max') : t('forge_cost', cost)}
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

  private renderClasses() {
    if (!this.itemsGridEl) return;

    for (const [cId, cDef] of Object.entries(PLAYER_CLASSES)) {
      const classId = cId as PlayerClassId;
      const unlocked = forge.isClassUnlocked(classId);
      const selected = forge.selectedClass === classId;
      const canAfford = forge.shards >= cDef.unlockCost;

      const masteryDef = FORGE_UPGRADES[cDef.masteryUpgradeId];
      const mLvl = forge.getLevel(cDef.masteryUpgradeId);
      const mMax = masteryDef ? masteryDef.maxLevel : 5;
      const mCost = forge.getCost(cDef.masteryUpgradeId);
      const canBuyMastery = unlocked && forge.canBuy(cDef.masteryUpgradeId);

      let pipsHtml = '';
      for (let p = 0; p < mMax; p++) {
        pipsHtml += `<div class="forge-pip ${p < mLvl ? 'active' : ''}"></div>`;
      }

      const card = document.createElement('div');
      card.className = `forge-item ${selected ? 'forge-item-selected' : ''}`;

      const name = t(`class_${classId}_name`);
      const sub = t(`class_${classId}_sub`);
      const desc = t(`class_${classId}_desc`);

      const masteryNameKey = `forge_up_${cDef.masteryUpgradeId}_name`;
      const masteryDescKey = `forge_up_${cDef.masteryUpgradeId}_desc`;
      const masteryName = t(masteryNameKey) !== masteryNameKey ? t(masteryNameKey) : (masteryDef?.name ?? 'Mastery');
      const masteryDesc = t(masteryDescKey) !== masteryDescKey ? t(masteryDescKey) : (masteryDef?.description ?? '');

      const selectLabel = selected
        ? `✓ ${t('forge_btn_active')}`
        : unlocked
        ? t('forge_btn_select')
        : `${t('forge_btn_unlock')} (✨ ${cDef.unlockCost})`;

      card.innerHTML = `
        <div class="forge-item-top">
          <span class="forge-item-name">${cDef.icon} ${name}</span>
          <span class="forge-item-level">${selected ? `✓ ${t('forge_btn_active')}` : unlocked ? t('forge_btn_select') : `🔒 ${cDef.unlockCost} ✨`}</span>
        </div>
        <div style="font-size:11px; color:#38bdf8; font-family:var(--font-mono); letter-spacing:1px;">${sub}</div>
        <p class="forge-item-desc">${desc}</p>
        <div class="forge-class-mastery-box">
          <div class="forge-item-top">
            <span style="font-size:12px; font-weight:700; color:#fbbf24;">${masteryName}</span>
            <span class="forge-item-level">LV ${mLvl} / ${mMax}</span>
          </div>
          <p class="forge-item-desc" style="font-size:11px;">${masteryDesc}</p>
          <div class="forge-pips-row">${pipsHtml}</div>
        </div>
        <div style="display:flex; justify-content:space-between; gap:8px; margin-top:6px;">
          <button class="forge-buy-btn btn-select-class" ${!unlocked && !canAfford ? 'disabled' : ''}>
            ${selectLabel}
          </button>
          ${
            unlocked && masteryDef
              ? `<button class="forge-buy-btn btn-upgrade-mastery" ${!canBuyMastery || mLvl >= mMax ? 'disabled' : ''}>
                  ${mLvl >= mMax ? t('forge_btn_max') : `${t('forge_btn_buy')} (✨ ${mCost})`}
                </button>`
              : ''
          }
        </div>
      `;

      const selectBtn = card.querySelector('.btn-select-class');
      if (selectBtn && !selected) {
        selectBtn.addEventListener('click', () => {
          if (forge.unlockOrSelectClass(classId)) {
            sound.playShard(true);
            this.render();
          }
        });
      }

      const masteryBtn = card.querySelector('.btn-upgrade-mastery');
      if (masteryBtn && unlocked && mLvl < mMax) {
        masteryBtn.addEventListener('click', () => {
          if (forge.buy(cDef.masteryUpgradeId)) {
            sound.playShard(true);
            this.render();
          }
        });
      }

      this.itemsGridEl.appendChild(card);
    }
  }

  private renderSkins() {
    if (!this.itemsGridEl) return;

    for (const [sId, sDef] of Object.entries(PLAYER_SKINS)) {
      const skinId = sId as PlayerSkinId;
      const unlocked = forge.isSkinUnlocked(skinId);
      const selected = forge.selectedSkin === skinId;
      const canAfford = forge.shards >= sDef.cost;

      const card = document.createElement('div');
      card.className = `forge-item ${selected ? 'forge-item-selected' : ''}`;

      const previewStyle =
        sDef.ringStyle === 'prismatic'
          ? 'background: conic-gradient(#00f3ff, #a855f7, #ec4899, #fbbf24, #34d399, #00f3ff); box-shadow: 0 0 18px #ec4899;'
          : `background: radial-gradient(circle, ${sDef.coreColor} 0%, ${sDef.primaryColor} 65%, transparent 100%); box-shadow: 0 0 18px ${sDef.primaryColor}; border: 2px solid ${sDef.secondaryColor};`;

      const name = t(`skin_${skinId}_name`);
      const desc = t(`skin_${skinId}_desc`);

      const skinLabel = selected
        ? `✓ ${t('forge_btn_active')}`
        : unlocked
        ? t('forge_btn_select')
        : `${t('forge_btn_unlock')} (✨ ${sDef.cost})`;

      card.innerHTML = `
        <div class="forge-item-top">
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="skin-orb-preview" style="${previewStyle}"></span>
            <span class="forge-item-name">${name}</span>
          </div>
          <span class="forge-item-level">${selected ? `✓ ${t('forge_btn_active')}` : unlocked ? t('forge_btn_select') : `🔒 ${sDef.cost} ✨`}</span>
        </div>
        <p class="forge-item-desc">${desc}</p>
        <button class="forge-buy-btn" ${!unlocked && !canAfford ? 'disabled' : ''}>
          ${skinLabel}
        </button>
      `;

      const btn = card.querySelector('.forge-buy-btn');
      if (btn && !selected) {
        btn.addEventListener('click', () => {
          if (forge.unlockOrSelectSkin(skinId)) {
            sound.playShard(true);
            this.render();
          }
        });
      }

      this.itemsGridEl.appendChild(card);
    }
  }
}
