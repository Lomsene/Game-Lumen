import { Player } from '../entities/Player';
import { Weapon } from '../weapons/Weapon';
import { PASSIVE_UPGRADES } from '../upgrades/UpgradePool';
import { settings, SettingsData, QualityLevel, JoystickMode, FpsCap, haptic } from '../meta/Settings';

interface MenuCallbacks {
  onResume: () => void;
  onQuit: () => void;
  getBuildInfo: () => { player: Player; weapons: Weapon[]; survivalTime: number };
}

/**
 * Pause menu, settings dialog and in-game toast hints.
 */
export class MenuUI {
  private pauseEl: HTMLElement | null;
  private settingsEl: HTMLElement | null;
  private toastEl: HTMLElement | null;
  private buildEl: HTMLElement | null;
  private toastTimer: number | null = null;
  private cb: MenuCallbacks;

  constructor(cb: MenuCallbacks) {
    this.cb = cb;
    this.pauseEl = document.getElementById('pause-modal');
    this.settingsEl = document.getElementById('settings-modal');
    this.toastEl = document.getElementById('hud-toast');
    this.buildEl = document.getElementById('pause-build');

    document.getElementById('btn-pause-resume')?.addEventListener('click', () => cb.onResume());
    document.getElementById('btn-pause-settings')?.addEventListener('click', () => this.showSettings());
    document.getElementById('btn-pause-quit')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-pause-quit');
      // Two-tap confirmation so a run is never lost by accident
      if (btn && btn.dataset.confirm !== '1') {
        btn.dataset.confirm = '1';
        btn.textContent = 'WIRKLICH AUFGEBEN?';
        window.setTimeout(() => {
          btn.dataset.confirm = '';
          btn.textContent = 'AUFGEBEN';
        }, 2500);
        return;
      }
      if (btn) {
        btn.dataset.confirm = '';
        btn.textContent = 'AUFGEBEN';
      }
      cb.onQuit();
    });
    document.getElementById('btn-close-settings')?.addEventListener('click', () => this.hideSettings());

    this.bindSettings();
  }

  // --- Pause ---------------------------------------------------------------

  public showPause() {
    this.renderBuild();
    this.pauseEl?.classList.remove('hidden');
  }

  public hidePause() {
    this.pauseEl?.classList.add('hidden');
    this.hideSettings();
  }

  private renderBuild() {
    if (!this.buildEl) return;
    const { player, weapons, survivalTime } = this.cb.getBuildInfo();
    const m = Math.floor(survivalTime / 60);
    const s = Math.floor(survivalTime % 60);
    const weaponRows = weapons
      .map((w) => `<li><span>${w.getDisplayName()}</span><b>${w.isEvolved ? 'EVO' : `LV ${w.level}`}</b></li>`)
      .join('');
    const passiveRows = Array.from(player.passives.entries())
      .map(([id, lvl]) => `<li><span>${PASSIVE_UPGRADES[id]?.name ?? id}</span><b>LV ${lvl}</b></li>`)
      .join('');
    this.buildEl.innerHTML = `
      <div class="pause-stats">
        <div><span>ZEIT</span><b>${m}:${s < 10 ? '0' : ''}${s}</b></div>
        <div><span>LEVEL</span><b>${player.level}</b></div>
        <div><span>KILLS</span><b>${player.kills}</b></div>
        <div><span>LICHT</span><b>${Math.ceil(player.light)}/${player.maxLight}</b></div>
      </div>
      <div class="pause-lists">
        <div><h4>WAFFEN</h4><ul>${weaponRows || '<li class="empty">Keine</li>'}</ul></div>
        <div><h4>UPGRADES</h4><ul>${passiveRows || '<li class="empty">Noch keine</li>'}</ul></div>
      </div>`;
  }

  // --- Settings ------------------------------------------------------------

  public showSettings() {
    this.syncSettingsUI();
    this.settingsEl?.classList.remove('hidden');
  }

  public hideSettings() {
    this.settingsEl?.classList.add('hidden');
  }

  /** Closes the top-most dismissible overlay (Android back button). Returns true if one was closed. */
  public closeTopOverlay(): boolean {
    const candidates = ['settings-modal', 'guide-modal', 'forge-modal'];
    for (const id of candidates) {
      const el = document.getElementById(id);
      if (el && !el.classList.contains('hidden')) {
        if (id === 'forge-modal') document.getElementById('btn-close-forge')?.click();
        else el.classList.add('hidden');
        return true;
      }
    }
    return false;
  }

  private bindSettings() {
    const bindRange = (id: string, key: 'musicVolume' | 'sfxVolume') => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      el?.addEventListener('input', () => settings.set(key, Number(el.value) / 100));
    };
    bindRange('set-music', 'musicVolume');
    bindRange('set-sfx', 'sfxVolume');

    const bindToggle = (id: string, key: keyof SettingsData) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      el?.addEventListener('change', () => {
        settings.set(key, el.checked as never);
        if (key === 'haptics' && el.checked) haptic(30);
      });
    };
    bindToggle('set-muted', 'muted');
    bindToggle('set-haptics', 'haptics');
    bindToggle('set-shake', 'screenShake');
    bindToggle('set-dmgnums', 'damageNumbers');
    bindToggle('set-fps', 'showFps');
    bindToggle('set-lefthanded', 'leftHanded');

    const quality = document.getElementById('set-quality') as HTMLSelectElement | null;
    quality?.addEventListener('change', () => settings.set('quality', quality.value as QualityLevel));
    const fpsCap = document.getElementById('set-fpscap') as HTMLSelectElement | null;
    fpsCap?.addEventListener('change', () => settings.set('fpsCap', Number(fpsCap.value) as FpsCap));
    const joystick = document.getElementById('set-joystick') as HTMLSelectElement | null;
    joystick?.addEventListener('change', () => settings.set('joystickMode', joystick.value as JoystickMode));

    document.getElementById('btn-reset-tutorial')?.addEventListener('click', () => {
      settings.set('tutorialSeen', false);
      this.showToast('Die Tipps werden im nächsten Durchlauf erneut angezeigt.');
    });
  }

  private syncSettingsUI() {
    const d = settings.data;
    const setVal = (id: string, v: string) => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | null;
      if (el) el.value = v;
    };
    const setChk = (id: string, v: boolean) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.checked = v;
    };
    setVal('set-music', `${Math.round(d.musicVolume * 100)}`);
    setVal('set-sfx', `${Math.round(d.sfxVolume * 100)}`);
    setVal('set-quality', d.quality);
    setVal('set-fpscap', `${d.fpsCap}`);
    setVal('set-joystick', d.joystickMode);
    setChk('set-muted', d.muted);
    setChk('set-haptics', d.haptics);
    setChk('set-shake', d.screenShake);
    setChk('set-dmgnums', d.damageNumbers);
    setChk('set-fps', d.showFps);
    setChk('set-lefthanded', d.leftHanded);
  }

  // --- Toast hints ---------------------------------------------------------

  public showToast(text: string, durationMs: number = 4200) {
    if (!this.toastEl) return;
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    this.toastEl.classList.remove('toast-in');
    void this.toastEl.offsetWidth; // Restart CSS animation
    this.toastEl.classList.add('toast-in');
    if (this.toastTimer !== null) window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl?.classList.add('hidden'), durationMs);
  }
}
