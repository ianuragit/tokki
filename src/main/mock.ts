/** Dev helper: cycle through mock scenarios so every rabbit mood can be seen. */
import type { ProviderId, ProviderView, UsageDetail, UsageResult } from '../shared/types';

const HOUR = 3600_000;

function result(details: UsageDetail[], ageMin = 0): UsageResult {
  const head = details.reduce((a, b) => (b.percent > a.percent ? b : a));
  return {
    percent: head.percent,
    label: head.label,
    resetsAt: head.resetsAt,
    details,
    source: 'mock',
    fetchedAt: Date.now() - ageMin * 60_000,
  };
}

const at = (h: number) => new Date(Date.now() + h * HOUR).toISOString();

type Scenario = { name: string; views: Partial<Record<ProviderId, Partial<ProviderView>>> };

export const SCENARIOS: Scenario[] = [
  {
    name: 'Perky (23% / 41%)',
    views: {
      claude: { status: 'ok', last: result([{ label: '5-hour session', percent: 23, resetsAt: at(3.2) }, { label: 'Weekly (all models)', percent: 11, resetsAt: at(90) }]) },
      chatgpt: { status: 'ok', last: result([{ label: '5-hour limit', percent: 41, resetsAt: at(1.5) }, { label: 'Weekly limit', percent: 18, resetsAt: at(120) }]) },
    },
  },
  {
    name: 'Tired (72% / 55%)',
    views: {
      claude: { status: 'ok', last: result([{ label: '5-hour session', percent: 72, resetsAt: at(2) }, { label: 'Weekly (all models)', percent: 40, resetsAt: at(70) }]) },
      chatgpt: { status: 'ok', last: result([{ label: '5-hour limit', percent: 55, resetsAt: at(0.6) }]) },
    },
  },
  {
    name: 'Sleepy (64% / 93%)',
    views: {
      claude: { status: 'ok', last: result([{ label: '5-hour session', percent: 64, resetsAt: at(4) }]) },
      chatgpt: { status: 'ok', last: result([{ label: '5-hour limit', percent: 93, resetsAt: at(0.3) }, { label: 'Weekly limit', percent: 61, resetsAt: at(50) }]) },
    },
  },
  {
    name: 'Confused (logged out)',
    views: {
      claude: { status: 'login', lastError: 'Logged out' },
      chatgpt: { status: 'ok', last: result([{ label: '5-hour limit', percent: 30 }]) },
    },
  },
  {
    name: 'Stale + parse error',
    views: {
      claude: { status: 'stale', lastError: 'could not find usage on page', last: result([{ label: '5-hour session', percent: 48 }], 42) },
      chatgpt: { status: 'error', lastError: 'could not find usage on page' },
    },
  },
];

let index = -1;

export function nextScenario(): Scenario {
  index = (index + 1) % SCENARIOS.length;
  return SCENARIOS[index];
}
