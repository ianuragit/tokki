import type { AppState, ProviderView } from '../shared/types';
import { levelFor, shownPercent } from '../shared/mood';

const root = document.getElementById('root')!;

function renderCell(p: ProviderView, state: AppState) {
  const cell = document.querySelector<HTMLElement>(`.cell[data-id="${p.id}"]`);
  if (!cell) return;
  const val = cell.querySelector<HTMLElement>('.val')!;
  cell.classList.toggle('hidden', !p.enabled);
  cell.classList.toggle('is-stale', p.status === 'stale');
  val.className = 'val';
  val.textContent = '';
  if (p.status === 'login') {
    val.classList.add('small');
    val.textContent = 'login';
    return;
  }
  if (p.status === 'loading' && !p.last) {
    val.classList.add('lv-none');
    val.textContent = '…';
    return;
  }
  const v = shownPercent(p);
  if (v == null) {
    val.classList.add('lv-none');
    val.textContent = '?';
    return;
  }
  val.classList.add(`lv-${levelFor(v, state.thresholds)}`);
  val.textContent = `${Math.round(v)}%`;
  if (p.status === 'stale') {
    const q = document.createElement('span');
    q.className = 'stale';
    q.textContent = '?';
    val.appendChild(q);
  }
}

function render(state: AppState) {
  root.className = `mood-${state.mood}`;
  root.classList.toggle('compact', state.compact);
  root.classList.toggle('refreshing', state.refreshing);
  for (const p of state.providers) renderCell(p, state);
  const enabled = state.providers.filter((p) => p.enabled).length;
  document.querySelector('.divider')?.classList.toggle('hidden', enabled < 2);
}

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  window.tokki.showContextMenu();
});

window.tokki.onState(render);
window.tokki.getState().then((s) => s && render(s));
