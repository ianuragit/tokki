/** Shared menu used by the widget's context menu and the tray. */
import { Menu, type MenuItemConstructorOptions } from 'electron';
import type { ProviderId } from '../shared/types';
import { settings } from './settings';
import { store } from './store';
import { debugLog } from './debugLog';

export interface MenuActions {
  refresh(): void;
  setWidgetVisible(v: boolean): void;
  isWidgetVisible(): boolean;
  login(id: ProviderId): void;
  setDebug(v: boolean): void;
  openDebugLog(): void;
  openSettings(): void;
  cycleMock(): void;
  exitMock(): void;
  showDevItems: boolean;
  quit(): void;
}

export function buildMenu(a: MenuActions, where: 'widget' | 'tray'): Menu {
  const s = settings.get();
  const items: MenuItemConstructorOptions[] = [
    { label: store.refreshing ? 'Refreshing…' : 'Refresh now', enabled: !store.refreshing && !store.mock, click: () => a.refresh() },
    { type: 'separator' },
  ];
  if (where === 'tray') {
    const visible = a.isWidgetVisible();
    items.push({ label: visible ? 'Hide Tokki' : 'Show Tokki', click: () => a.setWidgetVisible(!visible) });
  } else {
    items.push({ label: 'Hide Tokki', click: () => a.setWidgetVisible(false) });
  }
  items.push(
    { label: 'Compact mode', type: 'checkbox', checked: s.compact, click: (m) => settings.update({ compact: m.checked }) },
    { type: 'separator' },
    { label: 'Log in to Claude…', click: () => a.login('claude') },
    { label: 'Log in to ChatGPT…', click: () => a.login('chatgpt') },
    { type: 'separator' },
    { label: 'Debug mode', type: 'checkbox', checked: debugLog.enabled, click: (m) => a.setDebug(m.checked) },
  );
  if (debugLog.enabled) items.push({ label: 'Open debug log', click: () => a.openDebugLog() });
  if (a.showDevItems) {
    items.push(
      { type: 'separator' },
      { label: 'Dev: cycle mock data', click: () => a.cycleMock() },
      { label: 'Dev: use real data', enabled: store.mock, click: () => a.exitMock() },
    );
  }
  items.push(
    { type: 'separator' },
    { label: 'Launch at login', type: 'checkbox', checked: s.launchAtLogin, click: (m) => settings.update({ launchAtLogin: m.checked }) },
    { label: 'Settings…', click: () => a.openSettings() },
    { type: 'separator' },
    { label: 'Quit Tokki', role: undefined, click: () => a.quit() },
  );
  return Menu.buildFromTemplate(items);
}
