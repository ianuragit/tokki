import type { AppState, ProviderView } from '../shared/types';
import { formatReset, levelFor, relativeTime, shownPercent } from '../shared/mood';

const card = document.getElementById('card')!;

function el(tag: string, cls: string, text?: string): HTMLElement {
  const e = document.createElement(tag);
  e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderProvider(p: ProviderView, state: AppState): HTMLElement {
  const box = el('div', 'prov');
  const head = el('div', 'head');
  head.appendChild(el('span', '', p.name));
  const v = shownPercent(p);
  const headVal =
    p.status === 'login' ? 'logged out' : p.status === 'loading' && !p.last ? 'loading…' : v == null ? '?' : `${Math.round(v)}%`;
  head.appendChild(el('span', `lv-${levelFor(v, state.thresholds)}`, headVal));
  box.appendChild(head);

  if (p.status === 'login') {
    box.appendChild(el('div', 'note', `Right-click → “Log in to ${p.name}…”`));
    return box;
  }
  for (const d of p.last?.details ?? []) {
    const row = el('div', 'row');
    row.appendChild(el('span', 'l', d.label));
    row.appendChild(el('span', `r lv-${levelFor(d.percent, state.thresholds)}`, `${Math.round(d.percent)}%`));
    box.appendChild(row);
    const r = formatReset(d.resetsAt);
    if (r) box.appendChild(el('div', 'sub', r));
  }
  if (p.last) box.appendChild(el('div', 'sub', `Updated ${relativeTime(p.last.fetchedAt)}${p.last.source === 'dom' ? ' · from page text' : ''}`));
  if (p.status === 'stale' || p.status === 'error') {
    box.appendChild(el('div', 'note', `${p.lastAttemptAt ? `Last attempt (${relativeTime(p.lastAttemptAt)})` : 'Last attempt'} failed: ${p.lastError ?? 'unknown'}`));
  }
  return box;
}

let lastState: AppState | null = null;

function render(state: AppState) {
  lastState = state;
  card.replaceChildren();
  const enabled = state.providers.filter((p) => p.enabled);
  for (const p of enabled) card.appendChild(renderProvider(p, state));
  if (!enabled.length) card.appendChild(el('div', 'note', 'No services enabled — open Settings.'));
  const foot = [state.refreshing ? 'Refreshing…' : '', state.mock ? 'Mock data' : '', state.debug ? 'Debug on' : '']
    .filter(Boolean)
    .join(' · ');
  if (foot) card.appendChild(el('div', 'foot', foot));
  requestAnimationFrame(() => window.tokki.reportSize(document.body.scrollWidth, card.offsetHeight + 4));
}

window.tokki.onState(render);
window.tokki.getState().then((s) => s && render(s));
// Keep relative times fresh while visible.
setInterval(() => !document.hidden && lastState && render(lastState), 30_000);
