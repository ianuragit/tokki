import type { TokkiApi } from '../shared/types';

declare global {
  interface Window {
    tokki: TokkiApi;
  }
}
export {};
