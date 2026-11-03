/** Minimal, typed IPC surface exposed to Tokki's own pages as `window.tokki`. */
import { contextBridge, ipcRenderer } from 'electron';
import type { AppState, Settings, TokkiApi } from '../shared/types';

const api: TokkiApi = {
  getState: () => ipcRenderer.invoke('state:get'),
  onState: (cb) => {
    ipcRenderer.on('state', (_e, s: AppState) => cb(s));
  },
  showContextMenu: () => ipcRenderer.send('menu:popup'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch: Partial<Settings>) => ipcRenderer.invoke('settings:save', patch),
  closeWindow: () => ipcRenderer.send('window:close'),
  reportSize: (w: number, h: number) => ipcRenderer.send('window:size', w, h),
};

contextBridge.exposeInMainWorld('tokki', api);
