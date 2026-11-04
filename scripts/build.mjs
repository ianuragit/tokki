// Bundles main, preload and renderer code with esbuild and copies static files to dist/.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });

const common = { bundle: true, sourcemap: 'linked', logLevel: 'warning', target: 'es2022', legalComments: 'none' };

await Promise.all([
  build({ ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main/main.js', platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist/preload/preload.js', platform: 'node', format: 'cjs', external: ['electron'] }),
  build({
    ...common,
    entryPoints: ['src/renderer/widget.ts', 'src/renderer/tooltip.ts', 'src/renderer/settings.ts'],
    outdir: 'dist/renderer',
    platform: 'browser',
    format: 'iife',
  }),
  // Pure modules for unit tests.
  build({
    ...common,
    sourcemap: false,
    entryPoints: { parse: 'src/providers/parse.ts', mood: 'src/shared/mood.ts', pixelIcon: 'src/main/pixelIcon.ts', skins: 'src/renderer/skins.ts' },
    outdir: 'dist/lib',
    platform: 'node',
    format: 'cjs',
  }),
]);

for (const f of fs.readdirSync(path.join(root, 'src/renderer'))) {
  if (/\.(html|css)$/.test(f)) fs.copyFileSync(path.join(root, 'src/renderer', f), path.join(dist, 'renderer', f));
}
console.log('built → dist/');
