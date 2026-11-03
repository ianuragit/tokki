/**
 * ChatGPT (chatgpt.com) — Plus / Pro plan usage.
 *
 * The Codex usage page (chatgpt.com/codex/settings/usage) fetches
 * /backend-api/wham/usage, which (at time of writing) looks like:
 *   { "rate_limit": { "primary_window":   { "used_percent": 12, "reset_after_seconds": 9000, ... },
 *                     "secondary_window": { "used_percent": 40, "reset_at": 1767225600, ... } } }
 * Field paths live in src/config/extractors.json.
 */
import type { Provider, ProviderConfig } from './types';
import { runExtraction } from './engine';
import { getPath } from './parse';

function windowLabel(seconds: unknown, fallback: string): string {
  if (typeof seconds !== 'number' || seconds <= 0) return fallback;
  const h = seconds / 3600;
  if (h <= 24) return `${Math.round(h)}-hour limit`;
  const d = Math.round(h / 24);
  return d === 7 ? 'Weekly limit' : `${d}-day limit`;
}

export function createChatGptProvider(cfg: ProviderConfig): Provider {
  return {
    id: 'chatgpt',
    name: 'ChatGPT',
    short: 'G',
    loginUrl: cfg.loginUrl,
    usageUrl: cfg.usageUrl,
    extract: (win) =>
      runExtraction(win, {
        providerId: 'chatgpt',
        cfg,
        // Use the real window length for labels when the response provides it.
        postProcess: (details, json) =>
          details.map((d) => {
            const key = /weekly/i.test(d.label) ? 'secondary_window' : /5-hour/i.test(d.label) ? 'primary_window' : null;
            if (!key) return d;
            const secs = getPath(json, `rate_limit.${key}.limit_window_seconds`);
            return { ...d, label: windowLabel(secs, d.label) };
          }),
      }),
  };
}
