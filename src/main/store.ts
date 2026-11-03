/**
 * In-memory app state + last-known values cache (<userData>/state-cache.json)
 * so the widget shows something sensible immediately after a restart.
 */
import { app } from 'electron';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import type { AppState, ProviderId, ProviderView, UsageResult } from '../shared/types';
import { computeMood } from '../shared/mood';
import { PROVIDER_IDS, PROVIDER_META } from '../providers';
import { settings } from './settings';
import { debugLog } from './debugLog';

class Store extends EventEmitter {
  private views: Record<ProviderId, ProviderView>;
  mock = false;
  refreshing = false;

  constructor() {
    super();
    this.views = Object.fromEntries(
      PROVIDER_IDS.map((id) => [
        id,
        { id, name: PROVIDER_META[id].name, short: PROVIDER_META[id].short, enabled: true, status: 'loading' },
      ]),
    ) as Record<ProviderId, ProviderView>;
  }

  private cacheFile() {
    return path.join(app.getPath('userData'), 'state-cache.json');
  }

  loadCache() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.cacheFile(), 'utf8'));
      for (const id of PROVIDER_IDS) {
        const last = raw[id] as UsageResult | undefined;
        if (last && typeof last.fetchedAt === 'number') {
          this.views[id].last = last;
          this.views[id].status = 'stale'; // until refreshed
        }
      }
    } catch {
      /* no cache yet */
    }
  }

  private saveCache() {
    if (this.mock) return;
    const out: Partial<Record<ProviderId, UsageResult>> = {};
    for (const id of PROVIDER_IDS) if (this.views[id].last) out[id] = this.views[id].last;
    try {
      fs.writeFileSync(this.cacheFile(), JSON.stringify(out, null, 2));
    } catch {
      /* ignore */
    }
  }

  /** Apply a new extraction result, keeping the last known value on failure. */
  applyResult(id: ProviderId, r: UsageResult) {
    const v = this.views[id];
    v.lastAttemptAt = r.fetchedAt;
    if (r.loggedOut) {
      v.status = 'login';
      v.lastError = 'Logged out';
    } else if (r.percent != null) {
      v.status = 'ok';
      v.last = r;
      v.lastError = undefined;
    } else {
      v.status = v.last ? 'stale' : 'error';
      v.lastError = r.error ?? 'unknown error';
    }
    debugLog.add({ kind: 'result', provider: id, result: r });
    this.saveCache();
    this.emitChange();
  }

  /** Replace all views (mock mode). */
  setViews(views: Partial<Record<ProviderId, Partial<ProviderView>>>) {
    for (const id of PROVIDER_IDS) {
      const base: ProviderView = { id, name: PROVIDER_META[id].name, short: PROVIDER_META[id].short, enabled: true, status: 'loading' };
      this.views[id] = { ...base, ...(views[id] ?? {}) };
    }
    this.emitChange();
  }

  setRefreshing(v: boolean) {
    this.refreshing = v;
    this.emitChange();
  }

  emitChange() {
    this.emit('change', this.get());
  }

  get(): AppState {
    const s = settings.get();
    const providers = PROVIDER_IDS.map((id) => ({ ...this.views[id], enabled: s.providers[id].enabled }));
    return {
      providers,
      thresholds: s.thresholds,
      compact: s.compact,
      mood: computeMood(providers, s.thresholds),
      debug: debugLog.enabled,
      mock: this.mock,
      refreshing: this.refreshing,
    };
  }
}

export const store = new Store();
