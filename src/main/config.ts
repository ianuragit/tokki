/**
 * Extractor config: bundled defaults (src/config/extractors.json) merged with an
 * optional user override at <userData>/extractors.json — so URL patterns and
 * field paths can be tuned without rebuilding the app.
 */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import defaults from '../config/extractors.json';
import type { ExtractorConfig } from '../providers/types';

export function overridePath(): string {
  return path.join(app.getPath('userData'), 'extractors.json');
}

export function loadExtractorConfig(): ExtractorConfig {
  const base = structuredClone(defaults) as unknown as ExtractorConfig & { $comment?: string };
  delete base.$comment;
  try {
    const user = JSON.parse(fs.readFileSync(overridePath(), 'utf8'));
    for (const id of Object.keys(base) as (keyof ExtractorConfig)[]) {
      if (user[id]) base[id] = { ...base[id], ...user[id], dom: { ...base[id].dom, ...(user[id].dom ?? {}) } };
    }
    console.log('[tokki] loaded extractor override from', overridePath());
  } catch (e: any) {
    if (e?.code !== 'ENOENT') console.error('[tokki] invalid extractors.json override:', e?.message);
  }
  return base;
}
