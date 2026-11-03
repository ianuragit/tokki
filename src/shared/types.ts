/** Types shared between the main process, preload and renderers. */

export type ProviderId = 'claude' | 'chatgpt';

/** A single usage limit, e.g. "5-hour session" or "Weekly". */
export interface UsageDetail {
  label: string;
  percent: number;
  resetsAt?: string; // ISO timestamp
}

/** Result of one extraction attempt for one provider. */
export interface UsageResult {
  /** Headline percentage (highest of all limits), or null if unknown. */
  percent: number | null;
  label?: string;
  resetsAt?: string;
  /** Machine-friendly error text when extraction failed. */
  error?: string;
  /** True when the provider session is logged out. */
  loggedOut?: boolean;
  /** All limits found; the headline is the highest of these. */
  details?: UsageDetail[];
  /** How the value was obtained: network JSON or DOM text. */
  source?: 'network' | 'dom' | 'mock';
  fetchedAt: number;
}

/**
 * - ok:      fresh value
 * - stale:   latest attempt failed to parse, showing last known value
 * - login:   logged out
 * - error:   failed and no last known value
 * - loading: never fetched yet
 */
export type ProviderStatus = 'ok' | 'stale' | 'login' | 'error' | 'loading';

export interface ProviderView {
  id: ProviderId;
  name: string;
  short: string;
  enabled: boolean;
  status: ProviderStatus;
  /** Last known good result (may be older than lastAttemptAt). */
  last?: UsageResult;
  lastAttemptAt?: number;
  lastError?: string;
}

export type Mood = 'perky' | 'tired' | 'sleepy' | 'confused';

export interface Thresholds {
  /** percent >= amber → amber/tired */
  amber: number;
  /** percent > red → red/sleepy */
  red: number;
}

export interface AppState {
  providers: ProviderView[];
  thresholds: Thresholds;
  compact: boolean;
  mood: Mood;
  debug: boolean;
  mock: boolean;
  refreshing: boolean;
}

export interface Settings {
  refreshMinutes: number;
  thresholds: Thresholds;
  compact: boolean;
  widgetVisible: boolean;
  widgetPosition: { x: number; y: number } | null;
  launchAtLogin: boolean;
  debug: boolean;
  firstRunDone: boolean;
  providers: Record<ProviderId, { enabled: boolean }>;
}

/** The minimal API the preload exposes as `window.tokki`. */
export interface TokkiApi {
  getState(): Promise<AppState>;
  onState(cb: (s: AppState) => void): void;
  showContextMenu(): void;
  getSettings(): Promise<Settings>;
  saveSettings(patch: Partial<Settings>): Promise<Settings>;
  closeWindow(): void;
  reportSize(width: number, height: number): void;
}
