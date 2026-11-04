const test = require('node:test');
const assert = require('node:assert');
const { parseUsageJson, toResult, normalizeTime, redact, domHitsToDetails, matchesAny } = require('../dist/lib/parse.js');
const cfg = require('../src/config/extractors.json');

const NOW = Date.parse('2026-01-01T00:00:00Z');

test('claude usage JSON → details + highest headline', () => {
  const json = {
    five_hour: { utilization: 42, resets_at: '2026-01-01T03:00:00Z' },
    seven_day: { utilization: 13.5, resets_at: '2026-01-05T00:00:00Z' },
    seven_day_opus: null,
  };
  const d = parseUsageJson(json, cfg.claude, NOW);
  assert.deepStrictEqual(d.map((x) => [x.label, x.percent]), [['5-hour session', 42], ['Weekly (all models)', 13.5]]);
  const r = toResult(d, 'network', NOW);
  assert.strictEqual(r.percent, 42);
  assert.strictEqual(r.resetsAt, '2026-01-01T03:00:00.000Z');
});

test('chatgpt usage JSON with reset_after_seconds and epoch reset_at', () => {
  const json = {
    rate_limit: {
      primary_window: { used_percent: 12, reset_after_seconds: 3600, limit_window_seconds: 18000 },
      secondary_window: { used_percent: 67, reset_at: 1767312000 },
    },
  };
  const d = parseUsageJson(json, cfg.chatgpt, NOW);
  assert.strictEqual(d.length, 2);
  assert.strictEqual(d[0].resetsAt, new Date(NOW + 3600e3).toISOString());
  assert.strictEqual(d[1].resetsAt, new Date(1767312000e3).toISOString());
  assert.strictEqual(toResult(d, 'network', NOW).percent, 67);
});

test('autoScan fallback finds unknown shapes; fractions scaled', () => {
  const d = parseUsageJson({ limits: { daily: { usage_percent: 0.25 } } }, cfg.claude, NOW);
  assert.deepStrictEqual(d.map((x) => [x.label, x.percent]), [['Daily', 25]]);
});

test('empty → error result', () => {
  assert.strictEqual(toResult([], 'network', NOW).percent, null);
});

test('normalizeTime handles ms/s/iso/garbage', () => {
  assert.strictEqual(normalizeTime(1767225600000), '2026-01-01T00:00:00.000Z');
  assert.strictEqual(normalizeTime(1767225600), '2026-01-01T00:00:00.000Z');
  assert.strictEqual(normalizeTime('nope'), undefined);
});

test('redact strips tokens and emails', () => {
  const out = JSON.stringify(redact({ accessToken: 'abc', user: { email: 'a@b.co', note: 'eyJabcdefghij.abcdefghij.abcdefghij' } }));
  assert.ok(!out.includes('abc"') && !out.includes('a@b.co') && !out.includes('eyJ'));
});

test('DOM hits: "remaining" values are inverted', () => {
  const d = domHitsToDetails([{ percent: 30, context: 'Weekly', inverted: true }, { percent: 120, context: 'x' }]);
  assert.deepStrictEqual(d, [{ label: 'Weekly', percent: 70 }]);
});

test('logged-out URL patterns', () => {
  assert.ok(matchesAny('https://claude.ai/login?returnTo=x', cfg.claude.loggedOutUrlPatterns));
  assert.ok(!matchesAny('https://claude.ai/settings/usage', cfg.claude.loggedOutUrlPatterns));
  assert.ok(matchesAny('https://auth.openai.com/log-in', cfg.chatgpt.loggedOutUrlPatterns));
});
