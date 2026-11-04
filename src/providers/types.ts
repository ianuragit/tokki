import type { BrowserWindow } from 'electron';
import type { ProviderId, UsageResult } from '../shared/types';

export interface LimitConfig {
  label: string;
  /** Dot path to a percentage (or fraction, see percentScale). */
  percentPath?: string;
  /** Alternative: compute percent = used / limit * 100. */
  usedPath?: string;
  limitPath?: string;
  /** Dot path to an ISO string or epoch (s or ms). */
  resetsAtPath?: string;
  /** Dot path to "seconds until reset". */
  resetsInSecondsPath?: string;
}

export interface DomConfig {
  progressSelectors: string[];
  /** Regexes with the percentage in capture group 1. If the text says "remaining"/"left", it is inverted. */
  textPatterns: string[];
}

export interface ProviderConfig {
  loginUrl: string;
  usageUrl: string;
  loggedOutUrlPatterns: string[];
  responseUrlPatterns: string[];
  loggedOutStatusCodes: number[];
  percentScale: 'auto' | 'percent' | 'fraction';
  limits: LimitConfig[];
  /** Keys searched anywhere in matching JSON when no configured path yields a value. */
  autoKeys: string[];
  sessionCheck?: { url: string; loggedInPath: string };
  dom: DomConfig;
  timeoutMs: number;
  settleMs: number;
}

export type ExtractorConfig = Record<ProviderId, ProviderConfig>;

export interface Provider {
  id: ProviderId;
  name: string;
  short: string;
  loginUrl: string;
  usageUrl: string;
  /** Loads usageUrl in the given (hidden) window and extracts usage. */
  extract(win: BrowserWindow): Promise<UsageResult>;
}
