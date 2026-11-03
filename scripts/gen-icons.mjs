// Generates the app icon (.png/.ico/.icns) and tray icons from the Tokki rabbit SVG.
// Run with: npm run icons   (outputs are committed, so CI doesn't need to run this)
import { Resvg } from '@resvg/resvg-js';
import png2icons from 'png2icons';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = (...p) => path.join(root, ...p);

// Perky Tokki, same geometry as src/renderer/widget.html (64×64 units).
const rabbit = `
  <g transform="rotate(-8 24 28)">
    <ellipse cx="24" cy="15" rx="5.2" ry="13" fill="#fbf7f2" stroke="#3a3340" stroke-width="1.4"/>
    <ellipse cx="24" cy="16.5" rx="2.4" ry="9" fill="#f6b8c8"/>
  </g>
  <g transform="rotate(8 40 28)">
    <ellipse cx="40" cy="15" rx="5.2" ry="13" fill="#fbf7f2" stroke="#3a3340" stroke-width="1.4"/>
    <ellipse cx="40" cy="16.5" rx="2.4" ry="9" fill="#f6b8c8"/>
  </g>
  <ellipse cx="32" cy="57" rx="13" ry="7" fill="#fbf7f2" stroke="#3a3340" stroke-width="1.4"/>
  <ellipse cx="32" cy="40" rx="17.5" ry="15" fill="#fbf7f2" stroke="#3a3340" stroke-width="1.4"/>
  <ellipse cx="22.5" cy="45.5" rx="3.2" ry="2" fill="#f7a6b9" opacity="0.6"/>
  <ellipse cx="41.5" cy="45.5" rx="3.2" ry="2" fill="#f7a6b9" opacity="0.6"/>
  <circle cx="25.5" cy="39.5" r="3" fill="#2c2533"/>
  <circle cx="38.5" cy="39.5" r="3" fill="#2c2533"/>
  <circle cx="26.5" cy="38.4" r="1" fill="#fff"/>
  <circle cx="39.5" cy="38.4" r="1" fill="#fff"/>
  <path d="M30.4 44.2 h3.2 l-1.6 1.9 z" fill="#e7849c"/>
  <path d="M32 46.1 q-1.6 2 -3.2 0.6 M32 46.1 q1.6 2 3.2 0.6" stroke="#2c2533" stroke-width="1.1" stroke-linecap="round" fill="none"/>`;

const appIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="1024" height="1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#c9bcff"/>
      <stop offset="1" stop-color="#7c5cff"/>
    </linearGradient>
    <clipPath id="clip"><rect x="3" y="3" width="58" height="58" rx="13"/></clipPath>
  </defs>
  <rect x="3" y="3" width="58" height="58" rx="13" fill="url(#bg)"/>
  <g clip-path="url(#clip)"><g transform="translate(5.6 9) scale(0.825)">${rabbit}</g></g>
</svg>`;

// Monochrome silhouette for the macOS menu bar (template image: black + alpha).
const traySilhouette = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><mask id="m">
    <rect width="64" height="64" fill="#fff"/>
    <circle cx="25" cy="42" r="3.6" fill="#000"/>
    <circle cx="39" cy="42" r="3.6" fill="#000"/>
    <path d="M29.5 48.5 h5 l-2.5 3 z" fill="#000"/>
  </mask></defs>
  <g mask="url(#m)" fill="#000">
    <ellipse cx="22" cy="17" rx="6.5" ry="16" transform="rotate(-10 22 33)"/>
    <ellipse cx="42" cy="17" rx="6.5" ry="16" transform="rotate(10 42 33)"/>
    <ellipse cx="32" cy="43" rx="21" ry="18"/>
  </g>
</svg>`;

function render(svg, size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

fs.mkdirSync(out('build'), { recursive: true });
fs.mkdirSync(out('assets'), { recursive: true });

fs.writeFileSync(out('build', 'icon.svg'), appIcon);
const png1024 = render(appIcon, 1024);
fs.writeFileSync(out('build', 'icon.png'), png1024);
fs.writeFileSync(out('build', 'icon.ico'), png2icons.createICO(png1024, png2icons.BICUBIC2, 0, false, true));
fs.writeFileSync(out('build', 'icon.icns'), png2icons.createICNS(png1024, png2icons.BICUBIC2, 0));

fs.writeFileSync(out('assets', 'trayTemplate.png'), render(traySilhouette, 16));
fs.writeFileSync(out('assets', 'trayTemplate@2x.png'), render(traySilhouette, 32));
fs.writeFileSync(out('assets', 'tray.png'), render(appIcon, 32));
fs.writeFileSync(out('assets', 'icon.png'), render(appIcon, 256));
console.log('icons written to build/ and assets/');
