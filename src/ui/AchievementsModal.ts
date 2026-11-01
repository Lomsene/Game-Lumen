import { ACHIEVEMENTS, achievements } from '../meta/Achievements';
import { forge, PLAYER_CLASSES } from '../meta/Forge';
import { t, getLanguage } from '../meta/i18n';

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Achievements list + local leaderboard of the best runs.
 */
export class AchievementsModal {
  private modalEl: HTMLElement | null;
  private onClose: (() => void) | null = null;

  constructor() {
    this.modalEl = document.getElementById('achievements-modal');
    document.getElementById('btn-close-achievements')?.addEventListener('click', () => this.hide());
  }

  public get isOpen(): boolean {
    return !!this.modalEl && !this.modalEl.classList.contains('hidden');
  }

  public show(onClose?: () => void) {
    this.onClose = onClose ?? null;
    this.render();
    this.modalEl?.classList.remove('hidden');
  }

  public hide() {
    if (!this.isOpen) return;
    this.modalEl?.classList.add('hidden');
    const cb = this.onClose;
    this.onClose = null;
    cb?.();
  }

  private render() {
    const lang = getLanguage();
    const locale = lang === 'en' ? 'en-US' : 'de-DE';

    const lbEl = document.getElementById('leaderboard-list');
    if (lbEl) {
      lbEl.innerHTML =
        forge.topRuns.length === 0
          ? `<li class="empty">${t('achievements_empty_lb')}</li>`
          : forge.topRuns
              .map((r, i) => {
                const cls = PLAYER_CLASSES[r.classId] ?? PLAYER_CLASSES.wanderer;
                const clsName = t(`class_${r.classId}_name`);
                const date = new Date(r.date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
                return `<li>
                  <span class="lb-rank">${i + 1}.</span>
                  <span>${formatTime(r.time)} <span class="lb-sub">${cls.icon} ${clsName} • ${date}</span></span>
                  <span>${r.score.toLocaleString(locale)}</span>
                </li>`;
              })
              .join('');
    }

    const lifetimeEl = document.getElementById('lifetime-stats');
    if (lifetimeEl) {
      lifetimeEl.innerHTML = `
        ${t('achievements_stat_runs')} <b>${achievements.lifetimeRuns}</b><br>
        ${t('achievements_stat_kills')} <b>${achievements.lifetimeKills.toLocaleString(locale)}</b><br>
        ${t('achievements_stat_shards')} <b>${forge.totalShardsCollected.toLocaleString(locale)}</b><br>
        ${t('achievements_stat_best')} <b>${Math.floor(forge.bestScore).toLocaleString(locale)}</b>`;
    }

    const listEl = document.getElementById('achievements-list');
    if (listEl) {
      listEl.innerHTML = ACHIEVEMENTS.map((a) => {
        const done = achievements.unlocked.has(a.id);
        const name = t(`ach_${a.id}_name`);
        const desc = t(`ach_${a.id}_desc`);
        return `<div class="achievement-item ${done ? 'unlocked' : ''}">
          <span class="ach-icon">${a.icon}</span>
          <div>
            <div class="ach-name">${name !== `ach_${a.id}_name` ? name : a.name}</div>
            <div class="ach-desc">${desc !== `ach_${a.id}_desc` ? desc : a.description}</div>
          </div>
          <span class="ach-reward">${done ? '✓' : `+${a.reward} ✨`}</span>
        </div>`;
      }).join('');
    }
  }
}
