/**
 * Pure parsing helpers (no Electron imports) so they can be unit tested.
 */
import type { UsageDetail, UsageResult } from '../shared/types';
import type { LimitConfig, ProviderConfig } from './types';

export function getPath(obj: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

/** Normalise a value to 0..100. "auto": values <= 1 are treated as fractions unless the key says percent. */
export function normalizePercent(v: number, scale: ProviderConfig['percentScale']): number {
  let p = v;
  if (scale === 'fraction') p = v * 100;
  else if (scale === 'auto' && v > 0 && v <= 1 && !Number.isInteger(v)) p = v * 100;
  return Math.max(0, Math.min(100, p));
}

/** Accepts ISO strings or epoch seconds / milliseconds. */
export function normalizeTime(v: unknown): string | undefined {
  if (v == null) return undefined;
  const n = toNumber(v);
  if (n != null) {
    const ms = n > 1e12 ? n : n * 1000;
    return new Date(ms).toISOString();
  }
  if (typeof v === 'string') {
    const t = Date.parse(v);
    return Number.isNaN(t) ? undefined : new Date(t).toISOString();
  }
  return undefined;
}

export function extractLimit(json: unknown, lim: LimitConfig, cfg: Pick<ProviderConfig, 'percentScale'>, now = Date.now()): UsageDetail | null {
  let percent: number | undefined;
  const raw = toNumber(getPath(json, lim.percentPath));
  if (raw != null) percent = normalizePercent(raw, cfg.percentScale);
  if (percent == null && lim.usedPath && lim.limitPath) {
    const used = toNumber(getPath(json, lim.usedPath));
    const limit = toNumber(getPath(json, lim.limitPath));
    if (used != null && limit) percent = Math.max(0, Math.min(100, (used / limit) * 100));
  }
  if (percent == null) return null;
  let resetsAt = normalizeTime(getPath(json, lim.resetsAtPath));
  if (!resetsAt) {
    const secs = toNumber(getPath(json, lim.resetsInSecondsPath));
    if (secs != null) resetsAt = new Date(now + secs * 1000).toISOString();
  }
  return { label: lim.label, percent, ...(resetsAt ? { resetsAt } : {}) };
}

/** Recursively look for numeric values under any of `keys`. Labels are the JSON path of the parent. */
export function autoScan(json: unknown, keys: string[], scale: ProviderConfig['percentScale']): UsageDetail[] {
  const out: UsageDetail[] = [];
  const wanted = new Set(keys.map((k) => k.toLowerCase()));
  const walk = (node: unknown, path: string[], depth: number) => {
    if (depth > 8 || node == null || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const n = toNumber(v);
      if (n != null && wanted.has(k.toLowerCase())) {
        const parent = node as Record<string, unknown>;
        const resetsAt = normalizeTime(parent.resets_at ?? parent.reset_at ?? parent.resetsAt);
        out.push({
          label: humanize(path[path.length - 1] ?? k),
          percent: normalizePercent(n, scale),
          ...(resetsAt ? { resetsAt } : {}),
        });
      } else if (typeof v === 'object') {
        walk(v, [...path, k], depth + 1);
      }
    }
  };
  walk(json, [], 0);
  return out;
}

export function humanize(key: string): string {
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Parse one JSON body using configured limits, falling back to autoKeys. */
export function parseUsageJson(json: unknown, cfg: Pick<ProviderConfig, 'limits' | 'autoKeys' | 'percentScale'>, now = Date.now()): UsageDetail[] {
  const found = cfg.limits
    .map((l) => extractLimit(json, l, cfg, now))
    .filter((d): d is UsageDetail => d != null);
  if (found.length) return found;
  return autoScan(json, cfg.autoKeys, cfg.percentScale);
}

/** Merge details from several responses, de-duplicating by label (later wins). */
export function mergeDetails(lists: UsageDetail[][]): UsageDetail[] {
  const m = new Map<string, UsageDetail>();
  for (const list of lists) for (const d of list) m.set(d.label, d);
  return [...m.values()];
}

export function toResult(details: UsageDetail[], source: UsageResult['source'], now = Date.now()): UsageResult {
  if (!details.length) return { percent: null, error: 'no usage values found', fetchedAt: now };
  const head = details.reduce((a, b) => (b.percent > a.percent ? b : a));
  return {
    percent: head.percent,
    label: head.label,
    ...(head.resetsAt ? { resetsAt: head.resetsAt } : {}),
    details,
    source,
    fetchedAt: now,
  };
}

export function matchesAny(s: string, patterns: string[]): boolean {
  return patterns.some((p) => {
    try {
      return new RegExp(p, 'i').test(s);
    } catch {
      return false;
    }
  });
}

/** One percentage found in the rendered page by the DOM fallback. */
export interface DomHit {
  percent: number;
  context: string;
  inverted?: boolean;
}

/** Turn DOM hits into details: "remaining/left" values are inverted to "used". */
export function domHitsToDetails(hits: DomHit[]): UsageDetail[] {
  const seen = new Set<string>();
  const out: UsageDetail[] = [];
  for (const h of hits) {
    if (!(h.percent >= 0 && h.percent <= 100)) continue;
    const percent = h.inverted ? 100 - h.percent : h.percent;
    let label = h.context.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Usage';
    if (seen.has(label)) label = `${label} (${out.length + 1})`;
    seen.add(label);
    out.push({ label, percent });
  }
  return out;
}

const SECRET_KEY = /token|secret|password|cookie|authorization|session_?key|api_?key|credential/i;
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

/** Remove anything credential-like (and emails) before writing to the debug log. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 20) return '[deep]';
  if (typeof value === 'string') return value.replace(JWT, '[redacted-jwt]').replace(EMAIL, '[redacted-email]');
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY.test(k) ? '[redacted]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}… [${s.length - max} more chars]` : s;
}
