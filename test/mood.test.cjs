const test = require('node:test');
const assert = require('node:assert');
const { computeMood, levelFor, trayTitle } = require('../dist/lib/mood.js');
const { renderUsageIcon } = require('../dist/lib/pixelIcon.js');

const t = { amber: 60, red: 85 };
const p = (id, status, percent) => ({ id, name: id, short: id[0].toUpperCase(), enabled: true, status, last: percent == null ? undefined : { percent, fetchedAt: 1 } });

test('levels', () => {
  assert.strictEqual(levelFor(59, t), 'green');
  assert.strictEqual(levelFor(60, t), 'amber');
  assert.strictEqual(levelFor(85, t), 'amber');
  assert.strictEqual(levelFor(86, t), 'red');
  assert.strictEqual(levelFor(null, t), 'none');
});

test('moods follow the higher percentage', () => {
  assert.strictEqual(computeMood([p('claude', 'ok', 20), p('chatgpt', 'ok', 40)], t), 'perky');
  assert.strictEqual(computeMood([p('claude', 'ok', 70), p('chatgpt', 'ok', 40)], t), 'tired');
  assert.strictEqual(computeMood([p('claude', 'ok', 70), p('chatgpt', 'stale', 90)], t), 'sleepy');
  assert.strictEqual(computeMood([p('claude', 'login'), p('chatgpt', 'ok', 40)], t), 'confused');
  assert.strictEqual(computeMood([p('claude', 'error'), p('chatgpt', 'ok', 40)], t), 'confused');
  const disabled = { ...p('chatgpt', 'login'), enabled: false };
  assert.strictEqual(computeMood([p('claude', 'ok', 10), disabled], t), 'perky');
});

test('tray title', () => {
  assert.strictEqual(trayTitle({ providers: [p('claude', 'ok', 42.4), p('gpt', 'ok', 67)] }), 'C 42% · G 67%');
});

test('tray icon renders valid PNGs', () => {
  for (const size of [16, 32]) {
    const png = renderUsageIcon([{ text: '100', color: [255, 0, 0, 255] }, { text: '7', color: [0, 255, 0, 255] }], size);
    assert.strictEqual(png.subarray(1, 4).toString(), 'PNG');
    assert.strictEqual(png.readUInt32BE(16), size);
  }
});
