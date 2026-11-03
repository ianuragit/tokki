import type { Settings } from '../shared/types';

const $ = <T extends HTMLElement = HTMLInputElement>(id: string) => document.getElementById(id) as T;
const status = $<HTMLSpanElement>('status');
let flashTimer: number | undefined;

function fill(s: Settings) {
  $('p-claude').checked = s.providers.claude.enabled;
  $('p-chatgpt').checked = s.providers.chatgpt.enabled;
  $('refreshMinutes').value = String(s.refreshMinutes);
  $('amber').value = String(s.thresholds.amber);
  $('red').value = String(s.thresholds.red);
  $('widgetVisible').checked = s.widgetVisible;
  $('compact').checked = s.compact;
  $('launchAtLogin').checked = s.launchAtLogin;
  $('debug').checked = s.debug;
}

async function save(patch: Partial<Settings>) {
  const s = await window.tokki.saveSettings(patch);
  if (s) fill(s);
  status.textContent = 'Saved';
  clearTimeout(flashTimer);
  flashTimer = window.setTimeout(() => (status.textContent = ''), 1200);
}

const num = (id: string) => Number($(id).value);

$('p-claude').addEventListener('change', (e) =>
  save({ providers: { claude: { enabled: (e.target as HTMLInputElement).checked } } as Settings['providers'] }),
);
$('p-chatgpt').addEventListener('change', (e) =>
  save({ providers: { chatgpt: { enabled: (e.target as HTMLInputElement).checked } } as Settings['providers'] }),
);
$('refreshMinutes').addEventListener('change', () => save({ refreshMinutes: num('refreshMinutes') }));
$('amber').addEventListener('change', () => save({ thresholds: { amber: num('amber'), red: num('red') } }));
$('red').addEventListener('change', () => save({ thresholds: { amber: num('amber'), red: num('red') } }));
for (const id of ['widgetVisible', 'compact', 'launchAtLogin', 'debug'] as const) {
  $(id).addEventListener('change', (e) => save({ [id]: (e.target as HTMLInputElement).checked }));
}
$('close').addEventListener('click', () => window.tokki.closeWindow());

window.tokki.getSettings().then((s) => {
  if (s) fill(s);
  requestAnimationFrame(() => window.tokki.reportSize(document.body.scrollWidth, document.body.scrollHeight));
});
