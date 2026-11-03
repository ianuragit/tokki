/**
 * Periodically loads each provider's usage page in a hidden window using its
 * persistent partition and runs the provider's extractor.
 */
import { BrowserWindow, powerMonitor } from 'electron';
import type { ProviderId } from '../shared/types';
import type { Provider } from '../providers/types';
import { PROVIDER_IDS } from '../providers';
import { providerSession } from './sessions';
import { settings } from './settings';
import { store } from './store';
import { debugLog } from './debugLog';

export class Poller {
  private timer: NodeJS.Timeout | null = null;
  private running: Promise<void> | null = null;
  private again = false;

  constructor(private providers: Record<ProviderId, Provider>) {
    powerMonitor.on('resume', () => setTimeout(() => this.refreshNow(), 5000));
  }

  setProviders(p: Record<ProviderId, Provider>) {
    this.providers = p;
  }

  start() {
    this.schedule();
    void this.refreshNow();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  /** (Re)arm the interval timer, e.g. after the refresh interval setting changes. */
  schedule() {
    this.stop();
    const ms = settings.get().refreshMinutes * 60_000;
    this.timer = setTimeout(async () => {
      await this.refreshNow();
      this.schedule();
    }, ms);
  }

  /** Refresh all enabled providers (or just one). Concurrent calls are coalesced. */
  async refreshNow(only?: ProviderId): Promise<void> {
    if (store.mock) return;
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      store.setRefreshing(true);
      try {
        const ids = only ? [only] : PROVIDER_IDS.filter((id) => settings.get().providers[id].enabled);
        // Sequential: keeps memory/CPU low.
        for (const id of ids) {
          if (store.mock) break;
          const r = await this.fetchOne(id);
          if (!store.mock) store.applyResult(id, r);
        }
      } finally {
        store.setRefreshing(false);
        this.running = null;
      }
    })();
    await this.running;
    if (this.again) {
      this.again = false;
      await this.refreshNow();
    }
  }

  private async fetchOne(id: ProviderId) {
    const provider = this.providers[id];
    const win = new BrowserWindow({
      show: false,
      width: 1200,
      height: 900,
      webPreferences: {
        session: providerSession(id),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
        spellcheck: false,
      },
    });
    win.webContents.setAudioMuted(true);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    try {
      return await provider.extract(win);
    } catch (e) {
      debugLog.add({ kind: 'note', provider: id, message: `extract threw: ${e}` });
      return { percent: null, error: String(e), fetchedAt: Date.now() };
    } finally {
      if (!win.isDestroyed()) win.destroy();
    }
  }
}
