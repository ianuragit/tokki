/**
 * DEBUG mode logger. Writes JSON response URLs and truncated, redacted bodies
 * from the usage pages to <userData>/debug-log.json so extractors can be tuned.
 * Never logs cookies or request headers.
 */
import fs from 'node:fs';
import path from 'node:path';

const MAX_ENTRIES = 400;

export interface DebugEntry {
  kind: 'response' | 'dom' | 'note' | 'result';
  provider: string;
  [k: string]: unknown;
}

class DebugLog {
  enabled = false;
  private file = '';
  private entries: (DebugEntry & { at: string })[] = [];
  private timer: NodeJS.Timeout | null = null;

  init(userDataDir: string) {
    this.file = path.join(userDataDir, 'debug-log.json');
    try {
      const prev = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (Array.isArray(prev)) this.entries = prev.slice(-MAX_ENTRIES);
    } catch {
      /* no previous log */
    }
  }

  get path() {
    return this.file;
  }

  add(e: DebugEntry) {
    if (!this.enabled) return;
    this.entries.push({ at: new Date().toISOString(), ...e });
    if (this.entries.length > MAX_ENTRIES) this.entries.splice(0, this.entries.length - MAX_ENTRIES);
    if (process.argv.includes('--debug')) console.log('[tokki:debug]', e.kind, e.provider, e.url ?? e.message ?? '');
    if (!this.timer) this.timer = setTimeout(() => this.flush(), 500);
  }

  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.file) return;
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.entries, null, 2));
    } catch (err) {
      console.error('[tokki] failed to write debug log', err);
    }
  }

  clear() {
    this.entries = [];
    this.flush();
  }
}

export const debugLog = new DebugLog();
