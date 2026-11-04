/** Settings persisted as JSON in the app data folder (never localStorage). */
import { app } from 'electron';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import { SKINS, type Settings } from '../shared/types';

export const DEFAULT_SETTINGS: Settings = {
  refreshMinutes: 5,
  thresholds: { amber: 60, red: 85 },
  compact: false,
  skin: 'tokki',
  widgetVisible: true,
  widgetPosition: null,
  launchAtLogin: false,
  debug: false,
  firstRunDone: false,
  providers: { claude: { enabled: true }, chatgpt: { enabled: true } },
};

function settingsFile(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function sanitize(s: Settings): Settings {
  const clamp = (n: unknown, lo: number, hi: number, d: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  if (!SKINS.some((k) => k.id === s.skin)) s.skin = 'tokki';
  s.refreshMinutes = clamp(s.refreshMinutes, 1, 240, DEFAULT_SETTINGS.refreshMinutes);
  s.thresholds.amber = clamp(s.thresholds.amber, 0, 100, 60);
  s.thresholds.red = clamp(s.thresholds.red, s.thresholds.amber, 100, 85);
  return s;
}

class SettingsStore extends EventEmitter {
  private data: Settings = structuredClone(DEFAULT_SETTINGS);
  private saveTimer: NodeJS.Timeout | null = null;

  load(): Settings {
    try {
      const raw = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
      this.data = sanitize({
        ...structuredClone(DEFAULT_SETTINGS),
        ...raw,
        thresholds: { ...DEFAULT_SETTINGS.thresholds, ...(raw.thresholds ?? {}) },
        providers: {
          claude: { ...DEFAULT_SETTINGS.providers.claude, ...(raw.providers?.claude ?? {}) },
          chatgpt: { ...DEFAULT_SETTINGS.providers.chatgpt, ...(raw.providers?.chatgpt ?? {}) },
        },
      });
    } catch {
      this.data = structuredClone(DEFAULT_SETTINGS);
    }
    return this.data;
  }

  get(): Settings {
    return this.data;
  }

  update(patch: Partial<Settings>): Settings {
    const prev = this.data;
    this.data = sanitize({
      ...prev,
      ...patch,
      thresholds: { ...prev.thresholds, ...(patch.thresholds ?? {}) },
      providers: { ...prev.providers, ...(patch.providers ?? {}) },
    });
    this.scheduleSave();
    this.emit('change', this.data, prev);
    return this.data;
  }

  private scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 300);
  }

  flush() {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    try {
      fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
      fs.writeFileSync(settingsFile(), JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('[tokki] failed to save settings', e);
    }
  }
}

export const settings = new SettingsStore();
