import path from 'node:path';

/** dist/ root at runtime (main bundle lives in dist/main). */
export const DIST = path.join(__dirname, '..');
export const ROOT = path.join(DIST, '..');
export const rendererFile = (name: string) => path.join(DIST, 'renderer', name);
export const preloadFile = () => path.join(DIST, 'preload', 'preload.js');
export const assetFile = (name: string) => path.join(ROOT, 'assets', name);
