import { BrowserWindow } from 'electron';
import { preloadFile, rendererFile } from './paths';

let win: BrowserWindow | null = null;

export function openSettingsWindow(): BrowserWindow {
  if (win && !win.isDestroyed()) {
    win.show();
    win.focus();
    return win;
  }
  win = new BrowserWindow({
    width: 420,
    height: 560,
    title: 'Tokki Settings',
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadFile(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(rendererFile('settings.html'));
  win.once('ready-to-show', () => win?.show());
  win.on('closed', () => (win = null));
  return win;
}

export function settingsWindow(): BrowserWindow | null {
  return win && !win.isDestroyed() ? win : null;
}
