import type { AppState, Mood, ProviderView, Thresholds } from './types';

export type Level = 'green' | 'amber' | 'red' | 'none';

export function levelFor(percent: number | null | undefined, t: Thresholds): Level {
  if (percent == null || Number.isNaN(percent)) return 'none';
  if (percent > t.red) return 'red';
  if (percent >= t.amber) return 'amber';
  return 'green';
}

/** The value shown for a provider (fresh or last-known), or null. */
export function shownPercent(p: ProviderView): number | null {
  if (p.status === 'login') return null;
  return p.last?.percent ?? null;
}

/**
 * The rabbit reacts to the highest percentage across enabled providers.
 * It looks confused if any enabled provider is logged out, or errored
 * without a last-known value.
 */
export function computeMood(providers: ProviderView[], t: Thresholds): Mood {
  const enabled = providers.filter((p) => p.enabled);
  if (enabled.length === 0) return 'confused';
  const broken = enabled.some(
    (p) => p.status === 'login' || (p.status === 'error' && shownPercent(p) == null),
  );
  if (broken) return 'confused';
  const values = enabled.map(shownPercent).filter((v): v is number => v != null);
  if (values.length === 0) return 'perky'; // still loading
  const max = Math.max(...values);
  if (max > t.red) return 'sleepy';
  if (max >= t.amber) return 'tired';
  return 'perky';
}

export function formatPercent(v: number | null | undefined): string {
  if (v == null) return '?';
  return `${Math.round(v)}%`;
}

/** Compact one-line summary for the macOS menu bar title. */
export function trayTitle(state: Pick<AppState, 'providers'>): string {
  return state.providers
    .filter((p) => p.enabled)
    .map((p) => {
      if (p.status === 'login') return `${p.short} login`;
      if (p.status === 'loading') return `${p.short} …`;
      const v = shownPercent(p);
      return `${p.short} ${v == null ? '?' : Math.round(v) + '%'}${p.status === 'stale' ? '?' : ''}`;
    })
    .join(' · ');
}

export function relativeTime(ts: number | undefined, now = Date.now()): string {
  if (!ts) return 'never';
  const s = Math.round((now - ts) / 1000);
  if (s < 45) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(ts).toLocaleString();
}

export function formatReset(iso: string | undefined, now = Date.now()): string | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const diff = t - now;
  if (diff <= 0) return 'resets now';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `resets in ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `resets in ${hrs} h ${mins % 60} min`;
  const d = new Date(t);
  return `resets ${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

/** Plain-text multi-line details (tray tooltip). */
export function detailsText(state: Pick<AppState, 'providers'>): string {
  const lines: string[] = ['Tokki'];
  for (const p of state.providers.filter((x) => x.enabled)) {
    if (p.status === 'login') {
      lines.push(`${p.name}: logged out — use “Log in to ${p.name}”`);
      continue;
    }
    if (p.status === 'loading') {
      lines.push(`${p.name}: loading…`);
      continue;
    }
    const v = shownPercent(p);
    lines.push(`${p.name}: ${formatPercent(v)}${p.status === 'stale' ? ' (stale)' : ''}`);
    for (const d of p.last?.details ?? []) {
      const r = formatReset(d.resetsAt);
      lines.push(`  ${d.label}: ${Math.round(d.percent)}%${r ? ` — ${r}` : ''}`);
    }
    lines.push(`  updated ${relativeTime(p.last?.fetchedAt)}`);
  }
  return lines.join('\n');
}
