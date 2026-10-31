import { ACHIEVEMENTS, achievements } from '../meta/Achievements';
import { forge, PLAYER_CLASSES } from '../meta/Forge';

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
    const lbEl = document.getElementById('leaderboard-list');
    if (lbEl) {
      lbEl.innerHTML =
        forge.topRuns.length === 0
          ? '<li class="empty">Noch keine Läufe – leg los!</li>'
          : forge.topRuns
              .map((r, i) => {
                const cls = PLAYER_CLASSES[r.classId] ?? PLAYER_CLASSES.wanderer;
                const date = new Date(r.date).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
                return `<li>
                  <span class="lb-rank">${i + 1}.</span>
                  <span>${formatTime(r.time)} <span class="lb-sub">${cls.icon} ${cls.name} • ${date}</span></span>
                  <span>${r.score.toLocaleString('de-DE')}</span>
                </li>`;
              })
              .join('');
    }

    const lifetimeEl = document.getElementById('lifetime-stats');
    if (lifetimeEl) {
      lifetimeEl.innerHTML = `
        Läufe gesamt: <b>${achievements.lifetimeRuns}</b><br>
        Feinde besiegt: <b>${achievements.lifetimeKills.toLocaleString('de-DE')}</b><br>
        Splitter gesammelt: <b>${forge.totalShardsCollected.toLocaleString('de-DE')}</b><br>
        Bester Score: <b>${Math.floor(forge.bestScore).toLocaleString('de-DE')}</b>`;
    }

    const listEl = document.getElementById('achievements-list');
    if (listEl) {
      listEl.innerHTML = ACHIEVEMENTS.map((a) => {
        const done = achievements.unlocked.has(a.id);
        return `<div class="achievement-item ${done ? 'unlocked' : ''}">
          <span class="ach-icon">${a.icon}</span>
          <div>
            <div class="ach-name">${a.name}</div>
            <div class="ach-desc">${a.description}</div>
          </div>
          <span class="ach-reward">${done ? '✓' : `+${a.reward} ✨`}</span>
        </div>`;
      }).join('');
    }
  }
}
