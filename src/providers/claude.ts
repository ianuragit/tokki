/**
 * Claude (claude.ai) — Pro / Max plan usage.
 *
 * The usage settings page (claude.ai/settings/usage) fetches
 * /api/organizations/<org-id>/usage, which (at time of writing) looks like:
 *   { "five_hour": { "utilization": 42, "resets_at": "..." },
 *     "seven_day": { "utilization": 13, "resets_at": "..." }, ... }
 * Field paths live in src/config/extractors.json.
 */
import type { Provider, ProviderConfig } from './types';
import { runExtraction } from './engine';

export function createClaudeProvider(cfg: ProviderConfig): Provider {
  return {
    id: 'claude',
    name: 'Claude',
    short: 'C',
    loginUrl: cfg.loginUrl,
    usageUrl: cfg.usageUrl,
    extract: (win) =>
      runExtraction(win, {
        providerId: 'claude',
        cfg,
        // Ignore null limits (e.g. no Opus-specific cap on this plan) — handled by parse;
        // drop zero-valued model-specific weekly limits so they don't clutter the tooltip.
        postProcess: (details) =>
          details.filter((d) => !(d.percent === 0 && /\((opus|sonnet)\)/i.test(d.label))),
      }),
  };
}
