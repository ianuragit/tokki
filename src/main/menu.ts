/** Shared menu used by the widget's context menu and the tray. */
import { Menu, type MenuItemConstructorOptions } from 'electron';
import { SKINS, type ProviderId } from '../shared/types';
import { settings } from './settings';
import { store } from './store';
import { debugLog } from './debugLog';
import { currentScenarioName } from './mock';

export interface MenuActions {
  refresh(): void;
  setWidgetVisible(v: boolean): void;
  isWidgetVisible(): boolean;
  login(id: ProviderId): void;
  resetLogins(): void;
  setDebug(v: boolean): void;
  openDebugFolder(): void;
  openSettings(): void;
  cycleMock(): void;
  exitMock(): void;
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
    {
      label: 'Character',
      submenu: SKINS.map((k) => ({
        label: k.name,
        type: 'radio' as const,
        checked: s.skin === k.id,
        click: () => settings.update({ skin: k.id, compact: false }),
      })),
    },
    { type: 'separator' },
    { label: 'Log in to Claude…', click: () => a.login('claude') },
    { label: 'Log in to ChatGPT…', click: () => a.login('chatgpt') },
    { label: 'Reset logins…', click: () => a.resetLogins() },
    { type: 'separator' },
    { label: 'Debug mode', type: 'checkbox', checked: debugLog.enabled, click: (m) => a.setDebug(m.checked) },
    { label: 'Open debug log folder', click: () => a.openDebugFolder() },
    { type: 'separator' },
    // Available in every build so all rabbit moods can be checked without dev tools.
    {
      label: store.mock ? `Preview next mood (now: ${currentScenarioName()})` : 'Preview moods (mock data)',
      click: () => a.cycleMock(),
    },
  );
  if (store.mock) items.push({ label: 'Back to real data', click: () => a.exitMock() });
  items.push(
    { type: 'separator' },
    { label: 'Launch at login', type: 'checkbox', checked: s.launchAtLogin, click: (m) => settings.update({ launchAtLogin: m.checked }) },
    { label: 'Settings…', click: () => a.openSettings() },
    { type: 'separator' },
    { label: 'Quit Tokki', click: () => a.quit() },
  );
  return Menu.buildFromTemplate(items);
}
