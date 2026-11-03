/**
 * Tray / menu bar.
 * - macOS: monochrome rabbit template icon + live text title ("C 42% · G 67%").
 * - Windows/Linux: the icon itself is re-rendered with both numbers; details go in the tooltip.
 */
import { nativeImage, Tray, type NativeImage } from 'electron';
import type { AppState, ProviderView } from '../shared/types';
import { detailsText, levelFor, shownPercent, trayTitle, type Level } from '../shared/mood';
import { renderUsageIcon, type IconRow, type RGBA } from './pixelIcon';
import { assetFile } from './paths';

const COLORS: Record<Level, RGBA> = {
  green: [74, 222, 128, 255],
  amber: [251, 191, 36, 255],
  red: [248, 113, 113, 255],
  none: [180, 180, 190, 255],
};

function row(p: ProviderView, state: AppState): IconRow {
  if (p.status === 'login' || p.status === 'loading') return { text: '--', color: COLORS.none };
  const v = shownPercent(p);
  if (v == null) return { text: '?', color: COLORS.none };
  return { text: String(Math.round(v)), color: COLORS[levelFor(v, state.thresholds)] };
}

export function usageIcon(state: AppState): NativeImage {
  const rows = state.providers.filter((p) => p.enabled).map((p) => row(p, state));
  if (!rows.length) rows.push({ text: '?', color: COLORS.none });
  const img = nativeImage.createFromBuffer(renderUsageIcon(rows, 16), { scaleFactor: 1 });
  img.addRepresentation({ scaleFactor: 2, buffer: renderUsageIcon(rows, 32) });
  return img;
}

/** Windows limits tray tooltips to 127 characters, so keep it short there. */
function shortTooltip(state: AppState): string {
  const lines = state.providers
    .filter((p) => p.enabled)
    .map((p) => {
      if (p.status === 'login') return `${p.name}: logged out`;
      const ds = (p.last?.details ?? []).map((d) => `${Math.round(d.percent)}%`).join('/');
      const v = shownPercent(p);
      return `${p.name}: ${v == null ? '?' : Math.round(v) + '%'}${ds && (p.last?.details?.length ?? 0) > 1 ? ` (${ds})` : ''}${p.status === 'stale' ? ' stale' : ''}`;
    });
  return ['Tokki', ...lines].join('\n').slice(0, 127);
}

export class TokkiTray {
  tray: Tray;

  constructor(onClick: () => void) {
    const icon =
      process.platform === 'darwin'
        ? nativeImage.createFromPath(assetFile('trayTemplate.png'))
        : nativeImage.createFromPath(assetFile('tray.png'));
    if (process.platform === 'darwin') icon.setTemplateImage(true);
    this.tray = new Tray(icon);
    this.tray.setToolTip('Tokki');
    if (process.platform !== 'darwin') this.tray.on('click', onClick);
  }

  update(state: AppState) {
    if (process.platform === 'darwin') {
      this.tray.setTitle(` ${trayTitle(state)}`, { fontType: 'monospacedDigit' });
      this.tray.setToolTip(detailsText(state));
    } else {
      this.tray.setImage(usageIcon(state));
      this.tray.setToolTip(process.platform === 'win32' ? shortTooltip(state) : detailsText(state));
    }
  }
}
