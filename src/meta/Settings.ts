/**
 * Persistent player settings (audio, graphics quality, controls, accessibility).
 */
export type QualityLevel = 'auto' | 'high' | 'medium' | 'low';
export type JoystickMode = 'floating' | 'fixed';

export interface SettingsData {
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  muted: boolean;
  quality: QualityLevel;
  haptics: boolean;
  screenShake: boolean;
  damageNumbers: boolean;
  showFps: boolean;
  joystickMode: JoystickMode;
  leftHanded: boolean;
  tutorialSeen: boolean;
}

const DEFAULTS: SettingsData = {
  musicVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
  quality: 'auto',
  haptics: true,
  screenShake: true,
  damageNumbers: true,
  showFps: false,
  joystickMode: 'floating',
  leftHanded: false,
  tutorialSeen: false
};

class SettingsManager {
  public data: SettingsData = { ...DEFAULTS };
  private readonly STORAGE_KEY = 'aether_settings_v1';
  private listeners: Array<(s: SettingsData) => void> = [];

  constructor() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) this.data = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      this.data = { ...DEFAULTS };
    }
  }

  public set<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    this.data[key] = value;
    this.save();
    for (const l of this.listeners) l(this.data);
  }

  public onChange(listener: (s: SettingsData) => void) {
    this.listeners.push(listener);
  }

  private save() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage may be unavailable (private mode) - settings then only last for this session.
    }
  }
}

export const settings = new SettingsManager();

/** Short vibration feedback on supported devices (Android WebView / Chrome). */
export function haptic(pattern: number | number[]) {
  if (!settings.data.haptics) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Ignore - not supported
  }
}
