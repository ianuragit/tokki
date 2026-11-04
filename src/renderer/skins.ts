/**
 * Character skins for the widget. Each skin is an inline SVG (64×64 units)
 * built from the same mood parts (eyes/mouth variants, "z z", "?") so the
 * mood CSS in widget.css works for every character. Skin-specific parts
 * (ears, hat tips, lights) have their own mood rules in widget.css.
 */
import type { SkinId } from '../shared/types';

/** Standard mood face: eyes + mouth variants, toggled by .mood-* classes. */
function face(cx: number, ey: number, my: number, spread = 6.5): string {
  const l = cx - spread;
  const r = cx + spread;
  return `
    <g class="eyes eyes-open"><g class="blinker">
      <circle cx="${l}" cy="${ey}" r="3" class="pupil"/>
      <circle cx="${r}" cy="${ey}" r="3" class="pupil"/>
      <circle cx="${l + 1}" cy="${ey - 1.1}" r="1" class="shine"/>
      <circle cx="${r + 1}" cy="${ey - 1.1}" r="1" class="shine"/>
    </g></g>
    <g class="eyes eyes-half">
      <path d="M${l - 3} ${ey} a3 3 0 0 0 6 0 z M${r - 3} ${ey} a3 3 0 0 0 6 0 z" class="pupil"/>
      <path d="M${l - 3.2} ${ey + 0.1} q3.2 -1.3 6.4 0 M${r - 3.2} ${ey + 0.1} q3.2 -1.3 6.4 0" class="lid"/>
    </g>
    <g class="eyes eyes-closed">
      <path d="M${l - 3} ${ey} q3 2.6 6 0 M${r - 3} ${ey} q3 2.6 6 0" class="lid"/>
    </g>
    <g class="eyes eyes-confused">
      <circle cx="${l}" cy="${ey}" r="2.4" class="pupil"/>
      <path d="M${r - 2.5} ${ey - 2} l5 4 M${r + 2.5} ${ey - 2} l-5 4" class="lid"/>
    </g>
    <path class="mouth mouth-smile" d="M${cx} ${my} q-1.6 2 -3.2 0.6 M${cx} ${my} q1.6 2 3.2 0.6"/>
    <path class="mouth mouth-flat" d="M${cx - 2.2} ${my + 1.5} h4.4"/>
    <ellipse class="mouth mouth-o" cx="${cx}" cy="${my + 1.7}" rx="1.2" ry="1.4"/>
    <path class="mouth mouth-wavy" d="M${cx - 3} ${my + 1.5} q1 -1 2 0 t2 0 t2 0"/>`;
}

const blush = (x1: number, x2: number, y: number) =>
  `<ellipse cx="${x1}" cy="${y}" rx="3.2" ry="2" class="blush"/><ellipse cx="${x2}" cy="${y}" rx="3.2" ry="2" class="blush"/>`;

const zzz = (x: number, y: number) =>
  `<g class="zzz"><text x="${x}" y="${y}" class="z z1">z</text><text x="${x + 7}" y="${y - 7}" class="z z2">z</text></g>`;

const qmark = (x: number, y: number) => `<text x="${x}" y="${y}" class="qmark">?</text>`;

const svg = (skin: SkinId, body: string) =>
  `<svg class="char skin-${skin}" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">${body}</svg>`;

// ---------------------------------------------------------------- Tokki (default rabbit)
const tokki = svg(
  'tokki',
  `
  <g class="ear ear-l">
    <ellipse cx="24" cy="15" rx="5.2" ry="13" class="fur"/>
    <ellipse cx="24" cy="16.5" rx="2.4" ry="9" class="inner"/>
  </g>
  <g class="ear ear-r">
    <ellipse cx="40" cy="15" rx="5.2" ry="13" class="fur"/>
    <ellipse cx="40" cy="16.5" rx="2.4" ry="9" class="inner"/>
  </g>
  <g class="head">
    <ellipse cx="32" cy="57" rx="13" ry="7" class="fur"/>
    <ellipse cx="32" cy="40" rx="17.5" ry="15" class="fur"/>
    ${blush(22.5, 41.5, 45.5)}
    ${face(32, 39.5, 46.1)}
    <path d="M30.4 44.2 h3.2 l-1.6 1.9 z" class="nose"/>
  </g>
  ${zzz(47, 13)}
  ${qmark(51, 35)}`,
);

// ---------------------------------------------------------------- Tió (Catalan Christmas log)
// A smiling log on two stick legs, with a red barretina cap and a striped blanket.
const tio = svg(
  'tio',
  `
  <g class="head">
    <path d="M33 51 l-2 10 M46 52 l2 9" class="tio-leg"/>
    <rect x="3" y="27" width="40" height="26" rx="9" class="tio-bark"/>
    <path d="M9 33 q6 -1.5 12 0 M7 46 q7 1.5 14 -0.5 M14 40 h9" class="tio-grain"/>
    <path d="M4 31 Q15 24 28 28 L28 52 Q15 56 4 50 Z" class="tio-blanket"/>
    <path d="M10 27 L10 53.5 M17 26 L17 54.5 M23 26.5 L23 53.5" class="tio-stripe"/>
    <ellipse cx="42" cy="40" rx="14.5" ry="14.5" class="tio-end"/>
    <circle cx="42" cy="40" r="10.5" class="tio-ring"/>
    ${blush(34.5, 49.5, 44)}
    ${face(42, 38.6, 45, 5.5)}
    <ellipse cx="42" cy="42.6" rx="1.6" ry="1.2" class="tio-nose"/>
    <path d="M29 29.5 Q42 22 55.5 29.5 L54 25 Q48 15.5 40 16 Q32 17.5 30.5 25 Z" class="tio-cap"/>
    <path d="M29.6 28.6 Q42 21.4 55 28.6" class="tio-capband"/>
    <g class="tio-tip">
      <path d="M40 16 Q50 8.5 58 15.5 Q53 18.5 47 21 Z" class="tio-cap"/>
    </g>
  </g>
  ${zzz(8, 21)}
  ${qmark(13, 22)}`,
);

// ---------------------------------------------------------------- Santa Claus
const santa = svg(
  'santa',
  `
  <g class="head">
    <ellipse cx="32" cy="63" rx="19" ry="8" class="santa-coat"/>
    <circle cx="32" cy="38" r="12.5" class="santa-skin"/>
    <path d="M17.5 37 Q15 52 23.5 58.5 Q32 64.5 40.5 58.5 Q49 52 46.5 37 Q44 46.5 32 47.5 Q20 46.5 17.5 37 Z" class="santa-beard"/>
    ${blush(24.5, 39.5, 41)}
    ${face(32, 36.6, 47.2, 5.6)}
    <path d="M32 44.2 q-4.2 -2.6 -8.6 0.8 q3.8 2.6 8.6 -0.1 q4.8 2.7 8.6 0.1 q-4.4 -3.4 -8.6 -0.8 Z" class="santa-stache"/>
    <circle cx="32" cy="41.4" r="1.9" class="santa-nose"/>
    <path d="M23.2 32.6 q3 -1.6 5.6 -0.2 M35.2 32.4 q2.6 -1.4 5.6 0.2" class="santa-brow"/>
    <path d="M18 29.5 Q21 12 35 10.5 Q44 12.5 46 29.5 Z" class="santa-hat"/>
    <g class="santa-tip">
      <path d="M33.5 11 Q45 6.5 50.5 15 Q46 15.5 41.5 15.8 Z" class="santa-hat"/>
      <circle cx="51" cy="16.5" r="3.6" class="santa-fur"/>
    </g>
    <rect x="16" y="26" width="32" height="7" rx="3.5" class="santa-fur"/>
  </g>
  ${zzz(49, 34)}
  ${qmark(50, 38)}`,
);

// ---------------------------------------------------------------- Christmas tree
// Twinkling lights: each bulb has its own colour, delay and speed class.
const BULBS: [number, number][] = [
  [26, 20], [32, 21.6], [38.5, 20],
  [18.5, 31.5], [25, 30.6], [39.5, 30.6], [46, 31.5],
  [12, 49], [19.5, 50.2], [27.5, 51], [36.5, 51], [44.5, 50.2], [52, 49],
];
const bulbs = BULBS.map(
  ([x, y], i) =>
    `<g class="bulb c${i % 6} d${(i * 7) % 6} t${i % 3}"><circle cx="${x}" cy="${y}" r="3.3" class="halo"/><circle cx="${x}" cy="${y}" r="1.9" class="core"/><circle cx="${x - 0.55}" cy="${y - 0.6}" r="0.55" class="spark"/></g>`,
).join('');

const tree = svg(
  'tree',
  `
  <g class="head">
    <rect x="27.5" y="51" width="9" height="7" class="tree-trunk"/>
    <path d="M22 57 h20 l-2.5 6.5 h-15 Z" class="tree-pot"/>
    <path d="M32 23 L7 51.5 Q32 55 57 51.5 Z" class="tree-leaves"/>
    <path d="M32 13 L13.5 33 Q32 36 50.5 33 Z" class="tree-leaves"/>
    <path d="M32 5.5 L20.5 22 Q32 24.5 43.5 22 Z" class="tree-leaves"/>
    <path d="M24 19.5 Q32 23.5 40.5 19.5 M16.5 31 Q32 35 48 31 M10 48.5 Q32 54 54 48.5" class="tree-garland"/>
    ${blush(22.5, 41.5, 43)}
    ${face(32, 38, 44.4, 6)}
    ${bulbs}
    <g class="tree-star">
      <path d="M32 0.4 l1.75 3.6 3.95 .55 -2.85 2.8 .7 3.9 -3.55 -1.85 -3.55 1.85 .7 -3.9 -2.85 -2.8 3.95 -.55 Z" class="star"/>
    </g>
  </g>
  ${zzz(47, 14)}
  ${qmark(48, 16)}`,
);

export const SKIN_SVGS: Record<SkinId, string> = { tokki, tio, santa, tree };
