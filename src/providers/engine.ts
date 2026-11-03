/**
 * Generic extraction engine shared by all providers.
 *
 * 1. Attach the Chrome DevTools Protocol debugger to the hidden window and
 *    capture JSON responses whose URL matches the provider's patterns.
 * 2. If none yields a value, scrape percentages from the rendered DOM.
 *
 * Cookies and request headers are never read or logged.
 */
import type { BrowserWindow, WebContents } from 'electron';
import type { UsageDetail, UsageResult } from '../shared/types';
import type { ProviderConfig } from './types';
import {
  domHitsToDetails,
  matchesAny,
  mergeDetails,
  parseUsageJson,
  redact,
  toResult,
  truncate,
  type DomHit,
} from './parse';
import { debugLog } from '../main/debugLog';

interface PendingResponse {
  url: string;
  status: number;
  mimeType: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Resolve with `fallback` if `p` doesn't settle in time (page scripts can hang on stuck pages). */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p.catch(() => fallback), new Promise<T>((r) => setTimeout(() => r(fallback), ms))]);
}

function isJsonish(mime: string, url: string): boolean {
  return /json/i.test(mime) || /\.json(\?|$)/i.test(url);
}

export interface EngineOptions {
  providerId: string;
  cfg: ProviderConfig;
  /** Optional provider-specific post-processing of details parsed from JSON. */
  postProcess?: (details: UsageDetail[], json: unknown, url: string) => UsageDetail[];
}

export async function runExtraction(win: BrowserWindow, opts: EngineOptions): Promise<UsageResult> {
  const { cfg, providerId } = opts;
  const wc = win.webContents;
  const dbg = wc.debugger;
  const pending = new Map<string, PendingResponse>();
  const parsed: UsageDetail[][] = [];
  let authFailed = false;
  let firstHitAt = 0;
  const bodyReads: Promise<void>[] = [];

  const onMessage = (_e: unknown, method: string, params: any) => {
    if (method === 'Network.responseReceived') {
      const r = params.response;
      if (r && isJsonish(r.mimeType ?? '', r.url ?? '')) {
        pending.set(params.requestId, { url: r.url, status: r.status, mimeType: r.mimeType });
      }
    } else if (method === 'Network.loadingFinished') {
      const p = pending.get(params.requestId);
      if (!p) return;
      pending.delete(params.requestId);
      const relevant = matchesAny(p.url, cfg.responseUrlPatterns);
      if (!relevant && !debugLog.enabled) return;
      bodyReads.push(readBody(params.requestId, p, relevant));
    }
  };

  const readBody = async (requestId: string, p: PendingResponse, relevant: boolean) => {
    let text = '';
    try {
      const res = (await withTimeout(dbg.sendCommand('Network.getResponseBody', { requestId }), 5000, null)) as {
        body: string;
        base64Encoded: boolean;
      } | null;
      if (!res) return;
      text = res.base64Encoded ? Buffer.from(res.body, 'base64').toString('utf8') : res.body;
    } catch {
      return; // body evicted or window gone
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (debugLog.enabled) {
      debugLog.add({
        kind: 'response',
        provider: providerId,
        url: p.url,
        status: p.status,
        matched: relevant,
        body: truncate(json !== undefined ? JSON.stringify(redact(json)) : String(redact(text)), 4000),
      });
    }
    if (!relevant) return;
    if (cfg.loggedOutStatusCodes.includes(p.status)) {
      authFailed = true;
      return;
    }
    if (json === undefined || p.status >= 400) return;
    let details = parseUsageJson(json, cfg);
    if (opts.postProcess) details = opts.postProcess(details, json, p.url);
    if (details.length) {
      parsed.push(details);
      if (!firstHitAt) firstHitAt = Date.now();
    }
  };

  const isLoggedOutUrl = () => {
    const url = wc.getURL();
    return url !== '' && matchesAny(url, cfg.loggedOutUrlPatterns);
  };

  try {
    // A fresh webContents has no renderer until it navigates, and CDP commands
    // would wait for one, so commit a blank page first.
    await withTimeout(wc.loadURL('about:blank'), 5000, undefined);
    try {
      dbg.attach('1.3');
      dbg.on('message', onMessage as any);
      const ok = await withTimeout(dbg.sendCommand('Network.enable').then(() => true), 5000, false);
      if (!ok) debugLog.add({ kind: 'note', provider: providerId, message: 'Network.enable timed out; DOM fallback only' });
    } catch (e) {
      debugLog.add({ kind: 'note', provider: providerId, message: `debugger attach failed: ${e}` });
    }

    // Don't await loadURL: it can reject on client-side redirects (ERR_ABORTED)
    // or never settle on a stuck page. The polling loop below enforces the deadline.
    let loadFailed = '';
    wc.loadURL(cfg.usageUrl).catch((e) => {
      loadFailed = String(e).slice(0, 200);
      debugLog.add({ kind: 'note', provider: providerId, message: `loadURL: ${loadFailed}` });
    });

    const deadline = Date.now() + cfg.timeoutMs;
    while (Date.now() < deadline) {
      if (win.isDestroyed()) throw new Error('window destroyed');
      if (firstHitAt && Date.now() - firstHitAt >= cfg.settleMs) break;
      if (authFailed || isLoggedOutUrl()) break;
      if (loadFailed && !/ERR_ABORTED/.test(loadFailed)) break; // network error, DNS, offline…
      await sleep(400);
    }
    await withTimeout(Promise.allSettled(bodyReads), 5000, []);
    const finalUrl = wc.getURL();
    debugLog.add({ kind: 'note', provider: providerId, message: `final URL: ${finalUrl}` });

    if (parsed.length) return toResult(mergeDetails(parsed), 'network');
    if (isLoggedOutUrl() || authFailed) return loggedOut();

    if (loadFailed && !/ERR_ABORTED/.test(loadFailed)) {
      return { percent: null, error: `could not load page (${loadFailed.match(/ERR_[A-Z_]+/)?.[0] ?? 'network error'})`, fetchedAt: Date.now() };
    }
    if (cfg.sessionCheck && (await withTimeout(sessionLoggedOut(wc, cfg.sessionCheck), 8000, false))) return loggedOut();

    // Fallback: scrape the rendered page.
    const hits = await withTimeout(scrapeDom(wc, cfg), 5000, [] as DomHit[]);
    debugLog.add({ kind: 'dom', provider: providerId, url: finalUrl, hits });
    const details = domHitsToDetails(hits);
    if (details.length) return toResult(details, 'dom');
    return { percent: null, error: 'could not find usage on page', fetchedAt: Date.now() };
  } finally {
    dbg.removeListener('message', onMessage as any);
    try {
      if (dbg.isAttached()) dbg.detach();
    } catch {
      /* ignore */
    }
  }
}

function loggedOut(): UsageResult {
  return { percent: null, loggedOut: true, error: 'logged out', fetchedAt: Date.now() };
}

/** Ask the page's own session endpoint whether we're logged in. Only a boolean leaves the page. */
async function sessionLoggedOut(wc: WebContents, check: { url: string; loggedInPath: string }): Promise<boolean> {
  try {
    const json = await wc.executeJavaScript(
      `fetch(${JSON.stringify(check.url)}, { credentials: 'include' })
         .then(r => r.ok ? r.json() : null)
         .then(j => j ? { v: ${JSON.stringify(check.loggedInPath)}.split('.').reduce((o, k) => (o == null ? o : o[k]), j) != null } : { v: false })
         .catch(() => null)`,
      true,
    );
    return json != null && json.v === false;
  } catch {
    return false;
  }
}

async function scrapeDom(wc: WebContents, cfg: ProviderConfig): Promise<DomHit[]> {
  const script = `(() => {
    const hits = [];
    const sels = ${JSON.stringify(cfg.dom.progressSelectors)};
    for (const sel of sels) {
      let els = [];
      try { els = Array.from(document.querySelectorAll(sel)); } catch (e) {}
      for (const el of els) {
        const now = parseFloat(el.getAttribute('aria-valuenow'));
        const max = parseFloat(el.getAttribute('aria-valuemax') || '100') || 100;
        if (isNaN(now)) continue;
        const box = el.closest('section, li, [class*="card"], div');
        const ctx = (el.getAttribute('aria-label') || (box && box.innerText) || '').split('\\n').find(l => l.trim() && !/^\\d/.test(l.trim())) || '';
        hits.push({ percent: now / max * 100, context: ctx });
      }
    }
    if (hits.length) return hits;
    const lines = (document.body ? document.body.innerText : '').split('\\n').map(l => l.trim()).filter(Boolean);
    const pats = ${JSON.stringify(cfg.dom.textPatterns)}.map(p => new RegExp(p, 'i'));
    lines.forEach((line, i) => {
      for (const re of pats) {
        const m = line.match(re);
        if (!m) continue;
        const pct = parseFloat(m[1]);
        const rest = line.replace(m[0], '').trim();
        const ctx = rest.length > 2 ? rest : (lines[i - 1] || '');
        hits.push({ percent: pct, context: ctx, inverted: /remaining|left/i.test(m[0]) });
        break;
      }
    });
    return hits.slice(0, 10);
  })()`;
  try {
    const res = await wc.executeJavaScript(script, true);
    return Array.isArray(res) ? (res as DomHit[]) : [];
  } catch {
    return [];
  }
}
