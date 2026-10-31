import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Persistent key/value storage for AETHER: ECLIPSE.
 * Reads are synchronous from localStorage; on Android every write is mirrored to
 * Capacitor Preferences (native SharedPreferences), which survives WebView cache wipes.
 * init() restores the native copy into localStorage before anything loads.
 */
const PERSISTED_KEYS = ['lumen_save_v1', 'aether_settings_v1', 'lumen_achievements_v1'];

class Storage {
  private readonly isNative = Capacitor.isNativePlatform();

  public async init() {
    if (!this.isNative) return;
    for (const key of PERSISTED_KEYS) {
      try {
        const { value } = await Preferences.get({ key });
        if (value !== null) {
          localStorage.setItem(key, value);
        } else {
          // Migrate saves created before native storage existed
          const local = localStorage.getItem(key);
          if (local !== null) await Preferences.set({ key, value: local });
        }
      } catch (e) {
        console.warn(`Failed to restore ${key} from native storage`, e);
      }
    }
  }

  public get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  public set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`Failed to write ${key} to localStorage`, e);
    }
    if (this.isNative) {
      Preferences.set({ key, value }).catch((e) => console.warn(`Failed to write ${key} to native storage`, e));
    }
  }
}

export const storage = new Storage();
