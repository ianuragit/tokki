/**
 * Tokki — main process entry.
 *
 * Flags:
 *   --dev    show developer menu items (mock data cycling)
 *   --mock   start with mock data instead of real polling
 *   --debug  enable DEBUG logging for this run (also toggleable from the menu)
 */
import { app, BrowserWindow, ipcMain, Menu, shell, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import type { ProviderId, Settings } from '../shared/types';
import { createProviders } from '../providers';
import type { Provider } from '../providers/types';
import { settings } from './settings';
import { store } from './store';
import { debugLog } from './debugLog';
import { loadExtractorConfig } from './config';
import { Poller } from './poller';
import { Widget } from './widget';
import { TokkiTray } from './tray';
import { buildMenu, type MenuActions } from './menu';
import { openLoginWindow } from './login';
import { openSettingsWindow, settingsWindow } from './settingsWindow';
import { nextScenario } from './mock';

const argv = process.argv;
const DEV = argv.includes('--dev') || !app.isPackaged;
const START_MOCK = argv.includes('--mock');
const FORCE_DEBUG = argv.includes('--debug');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.setName('Tokki');
  if (process.platform === 'win32') app.setAppUserModelId('com.tokki.app');
  app.on('second-instance', () => widget?.setVisible(true));
  app.whenReady().then(init);
}

let widget: Widget | null = null;
let tray: TokkiTray | null = null;
let poller: Poller | null = null;
let providers: Record<ProviderId, Provider>;

function uiWindows(): BrowserWindow[] {
  return [...(widget?.allWindows() ?? []), settingsWindow()].filter((w): w is BrowserWindow => !!w);
}

function broadcast() {
  const s = store.get();
  for (const w of uiWindows()) w.webContents.send('state', s);
  tray?.update(s);
}

const actions: MenuActions = {
  refresh: () => void poller?.refreshNow(),
  setWidgetVisible: (v) => settings.update({ widgetVisible: v }),
  isWidgetVisible: () => !!widget?.isVisible(),
  login: (id) => openLoginWindow(providers[id], () => void poller?.refreshNow(id)),
  setDebug: (v) => settings.update({ debug: v }),
  openDebugLog: () => {
    debugLog.flush();
    void shell.openPath(debugLog.path);
  },
  openSettings: () => openSettingsWindow(),
  cycleMock: () => {
    store.mock = true;
    const sc = nextScenario();
    console.log('[tokki] mock scenario:', sc.name);
    store.setViews(sc.views);
  },
  exitMock: () => {
    store.mock = false;
    store.setViews({});
    store.loadCache();
    store.emitChange();
    void poller?.refreshNow();
  },
  showDevItems: DEV || START_MOCK,
  quit: () => app.quit(),
};

/** Only accept IPC from our own bundled pages. */
function trusted(e: IpcMainEvent | IpcMainInvokeEvent): boolean {
  return !!e.senderFrame && e.senderFrame.url.startsWith('file://');
}

function registerIpc() {
  ipcMain.handle('state:get', (e) => (trusted(e) ? store.get() : null));
  ipcMain.handle('settings:get', (e) => (trusted(e) ? settings.get() : null));
  ipcMain.handle('settings:save', (e, patch: Partial<Settings>) => {
    if (!trusted(e) || typeof patch !== 'object' || !patch) return null;
    const allowed: (keyof Settings)[] = ['refreshMinutes', 'thresholds', 'compact', 'widgetVisible', 'launchAtLogin', 'debug', 'providers'];
    const clean = Object.fromEntries(Object.entries(patch).filter(([k]) => allowed.includes(k as keyof Settings)));
    return settings.update(clean as Partial<Settings>);
  });
  ipcMain.on('menu:popup', (e) => {
    if (trusted(e) && widget && e.sender === widget.win.webContents) widget.popupMenu();
  });
  ipcMain.on('window:close', (e) => {
    if (trusted(e)) BrowserWindow.fromWebContents(e.sender)?.close();
  });
  ipcMain.on('window:size', (e, w: number, h: number) => {
    if (!trusted(e) || typeof w !== 'number' || typeof h !== 'number') return;
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win || !widget) return;
    if (win === widget.allWindows()[1]) widget.setTipHeight(h);
    else if (win === settingsWindow()) win.setContentSize(Math.round(Math.max(w, 300)), Math.round(Math.min(h, 900)));
  });
}

function applyLoginItem(enabled: boolean) {
  if (process.platform === 'linux') return; // not supported by Electron on Linux
  if (!app.isPackaged) return; // don't register the dev Electron binary
  app.setLoginItemSettings({ openAtLogin: enabled });
}

function init() {
  if (process.platform === 'darwin') app.dock?.hide();
  Menu.setApplicationMenu(null);

  settings.load();
  debugLog.init(app.getPath('userData'));
  debugLog.enabled = settings.get().debug || FORCE_DEBUG;
  store.loadCache();

  providers = createProviders(loadExtractorConfig());
  poller = new Poller(providers);
  registerIpc();

  widget = new Widget((win) => buildMenu(actions, 'widget').popup({ window: win }));
  tray = new TokkiTray(() => actions.setWidgetVisible(!widget?.isVisible()));
  tray.tray.on('right-click', () => tray?.tray.popUpContextMenu(buildMenu(actions, 'tray')));
  // Rebuild the tray menu lazily so checkbox/labels are current.
  const refreshTrayMenu = () => tray?.tray.setContextMenu(buildMenu(actions, 'tray'));
  refreshTrayMenu();

  store.on('change', () => {
    broadcast();
    refreshTrayMenu();
  });

  settings.on('change', (s: Settings, prev: Settings) => {
    if (s.compact !== prev.compact) widget?.setCompact(s.compact);
    if (s.widgetVisible !== prev.widgetVisible) widget?.setVisible(s.widgetVisible);
    if (s.refreshMinutes !== prev.refreshMinutes) poller?.schedule();
    if (s.launchAtLogin !== prev.launchAtLogin) applyLoginItem(s.launchAtLogin);
    if (s.debug !== prev.debug) debugLog.enabled = s.debug || FORCE_DEBUG;
    const newlyEnabled = (Object.keys(s.providers) as ProviderId[]).filter(
      (id) => s.providers[id].enabled && !prev.providers[id].enabled,
    );
    for (const id of newlyEnabled) void poller?.refreshNow(id);
    store.emitChange();
    refreshTrayMenu();
  });

  broadcast();

  // Test hook for automated screenshots/smoke tests (dev builds only).
  if (DEV) (globalThis as any).__tokki = { actions, store, settings, widget: () => widget };

  if (START_MOCK) {
    actions.cycleMock();
  } else {
    if (!settings.get().firstRunDone) {
      settings.update({ firstRunDone: true });
      for (const id of Object.keys(providers) as ProviderId[]) {
        if (settings.get().providers[id].enabled) actions.login(id);
      }
    }
    poller.start();
  }
}

// Tokki lives in the tray: closing windows must not quit the app.
app.on('window-all-closed', () => {
  /* keep running */
});

app.on('before-quit', () => {
  settings.flush();
  debugLog.flush();
});
