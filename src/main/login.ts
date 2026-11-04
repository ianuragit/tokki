/**
 * Visible login windows. Each uses the provider's persistent partition so the
 * session cookies are stored by Electron and reused by the hidden poller.
 */
import { BrowserWindow, shell } from 'electron';
import type { ProviderId } from '../shared/types';
import type { Provider } from '../providers/types';
import { providerSession } from './sessions';

const open = new Map<ProviderId, BrowserWindow>();

export function openLoginWindow(provider: Provider, onClosed: () => void): BrowserWindow {
  const existing = open.get(provider.id);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return existing;
  }
  const ses = providerSession(provider.id);
  const win = new BrowserWindow({
    width: 1080,
    height: 820,
    title: `Log in to ${provider.name} — Tokki`,
    autoHideMenuBar: true,
    webPreferences: {
      session: ses,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // Allow OAuth popups (Google / Apple / Microsoft sign-in) inside the same partition.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:/i.test(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: { session: ses, contextIsolation: true, nodeIntegration: false, sandbox: true },
        },
      };
    }
    if (/^mailto:/i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadURL(provider.loginUrl);
  win.on('page-title-updated', (e) => e.preventDefault());
  win.on('closed', () => {
    open.delete(provider.id);
    onClosed();
  });
  open.set(provider.id, win);
  return win;
}

export function hasOpenLoginWindows(): boolean {
  return [...open.values()].some((w) => !w.isDestroyed());
}

/** Close login windows without triggering their "refresh on close" callback. */
export function closeLoginWindows(): void {
  for (const w of open.values()) {
    if (!w.isDestroyed()) {
      w.removeAllListeners('closed');
      w.destroy();
    }
  }
  open.clear();
}
