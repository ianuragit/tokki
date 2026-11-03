const test = require('node:test');
const assert = require('node:assert');
const { SKIN_SVGS } = require('../dist/lib/skins.js');

const PARTS = ['eyes-open', 'eyes-half', 'eyes-closed', 'eyes-confused', 'mouth-smile', 'mouth-flat', 'mouth-o', 'mouth-wavy', 'class="zzz"', 'class="qmark"', 'class="head"', 'class="blinker"'];

test('every skin has all mood parts', () => {
  assert.deepStrictEqual(Object.keys(SKIN_SVGS), ['tokki', 'tio', 'santa', 'tree']);
  for (const [id, svg] of Object.entries(SKIN_SVGS)) {
    for (const part of PARTS) assert.ok(svg.includes(part), `${id} is missing ${part}`);
    assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'), id);
  }
});

test('the tree has twinkling bulbs in several colours', () => {
  const bulbs = SKIN_SVGS.tree.match(/class="bulb c(\d)/g) ?? [];
  assert.ok(bulbs.length >= 10);
  assert.strictEqual(new Set(bulbs).size, 6);
});
