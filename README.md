# Tokki 🐰

Tokki is a tiny rabbit that sits on your desktop and shows how much of your
**Claude** (Pro/Max) and **ChatGPT** (Plus/Pro) subscription usage you've used.

- An always-on-top floating widget: Tokki on the left, a pill like `C 42% | G 67%` on the right.
- Tokki's mood follows the higher of the two numbers:
  - **under 60%**: perky, ears up, blinks now and then
  - **60–85%**: tired, ears drooping, eyes half-closed
  - **over 85%**: asleep, eyes closed, `z z` floating up
  - **logged out or error**: confused, with a little `?`
- Numbers are coloured green, amber or red. You can change the thresholds in Settings.
- Hover over the widget to see each limit, when it resets, and when it was last updated.
- Live numbers also appear in the menu bar (macOS) or the system tray (Windows and Linux).

> ⚠️ **This relies on undocumented, internal endpoints.** Neither OpenAI nor
> Anthropic offers a public API for consumer subscription usage. Tokki loads
> their web usage pages using your own logged-in session and reads the
> numbers. When those pages change, Tokki may show `?` until the extractor
> config is updated (see [Updating extractors](#updating-extractors-when-the-sites-change)).

## Privacy

- Each service gets its own persistent Electron session partition
  (`persist:claude`, `persist:chatgpt`) stored in Tokki's app data folder,
  so you stay logged in across restarts.
- Tokki never reads, exports, logs or sends your cookies anywhere. The only
  network traffic is the service pages themselves, loaded the same way your browser would.
- The debug log is local only. Before writing, it redacts token, secret,
  cookie and session-key fields, JWTs and email addresses.

## Setup

Requires Node.js 20 or later (22 recommended).

```bash
npm install
```

```bash
npm run dev
```

Other run modes:

| Command | What it does |
| --- | --- |
| `npm run dev` | Build and run with dev menu items |
| `npm run dev:mock` | Run with mock data. Use **Dev: cycle mock data** in the right-click menu to see every mood |
| `npm run dev:debug` | Run with debug logging forced on (also printed to the terminal) |
| `npm test` | Unit tests for parsers, moods and the tray icon renderer |
| `npm run typecheck` | TypeScript check |

## First run and logging in

On first launch Tokki opens two normal browser windows, one for
https://claude.ai and one for https://chatgpt.com. Log in as you usually
would (Google, Apple or Microsoft sign-in pop-ups work). When you close a
login window, Tokki refreshes that service straight away.

To log in again later, right-click Tokki (or open the tray menu) and choose
**Log in to Claude…** or **Log in to ChatGPT…**. If you don't use one of
the services, turn it off in **Settings** so Tokki doesn't look confused about it.

## Using Tokki

- **Drag** the widget anywhere. Its position is saved in `settings.json`.
- **Right-click** for: Refresh now, Hide Tokki, Compact mode, Log in…,
  Debug mode, Launch at login, Settings…, Quit.
- **Tray**: the same menu, plus Show/Hide Tokki. On Windows, a left click toggles the widget.
- **Compact mode** hides the rabbit and shows only the pill.
- The refresh interval defaults to 5 minutes and can be changed in Settings.
  Tokki also refreshes when your computer wakes from sleep.

What the pill shows:

| Display | Meaning |
| --- | --- |
| `42%` | Fresh value (the highest of all limits, e.g. 5-hour vs weekly) |
| `42%?` dimmed | The last refresh failed; this is the last known value. The hover card shows its age |
| `?` | No value could be read |
| `login` | That service is logged out |

Files in the app data folder (`%APPDATA%\Tokki` on Windows,
`~/Library/Application Support/Tokki` on macOS, `~/.config/Tokki` on Linux):

| File | Purpose |
| --- | --- |
| `settings.json` | Settings and widget position |
| `state-cache.json` | Last known values, shown right after start-up |
| `extractors.json` | *(optional)* Your overrides for the extractor config |
| `debug-log.json` | Written only in debug mode |

## Debug mode

Debug mode records every JSON response the usage pages fetch: its URL,
status, and the first 4,000 characters of the body (redacted). It also
records what the DOM fallback found and the final result of each refresh.

To turn it on, use any one of these:

- the **Debug mode** checkbox in the right-click/tray menu or in Settings
- `npm run dev:debug`
- the `--debug` flag on a packaged app (`Tokki.exe --debug`, or `open -a Tokki --args --debug`).
  Unpackaged Electron rejects a bare `--debug` as an obsolete Node flag, so in
  development use `--debug-mode` or `TOKKI_DEBUG=1` instead.

Then choose **Refresh now** and **Open debug log**. Look for the entry whose
`body` contains your usage numbers. Its `url` and the path to the numbers are
what the extractor needs.

## How extraction works

Each provider lives in its own module (`src/providers/claude.ts` and
`src/providers/chatgpt.ts`) behind a common interface:

```ts
{ id, name, loginUrl, usageUrl, extract(win): Promise<UsageResult> }
```

Every N minutes Tokki opens the usage page in a hidden window that uses the
provider's partition, then:

1. **Network capture (preferred).** It attaches `webContents.debugger`, enables
   the CDP `Network` domain, and parses the JSON responses whose URL matches
   `responseUrlPatterns`, using the configured field paths.
2. **DOM fallback.** If no response gave a value, it runs a script on the
   rendered page that reads `role="progressbar"` elements and text such as
   `42% used`. A value phrased as "remaining" or "left" is converted to the amount used.

When there are several limits (for example a 5-hour session limit and a
weekly limit), the highest one becomes the headline. All of them appear in
the hover card.

The usage pages Tokki loads by default (at the time of writing):

| Service | Page | JSON endpoint | Fields |
| --- | --- | --- | --- |
| Claude | `claude.ai/settings/usage` | `/api/organizations/<org>/usage` | `five_hour.utilization`, `seven_day.utilization`, … |
| ChatGPT | `chatgpt.com/codex/settings/usage` | `/backend-api/wham/usage` | `rate_limit.primary_window.used_percent`, `rate_limit.secondary_window.used_percent` |

## Updating extractors when the sites change

All URLs, patterns and field paths are in
[`src/config/extractors.json`](src/config/extractors.json), not in the code.
To change them **without rebuilding**, copy the provider block you want to
change into `extractors.json` in the app data folder (keys are merged per
provider) and restart Tokki:

```json
{
  "claude": {
    "responseUrlPatterns": ["/api/organizations/[^/]+/usage", "/api/new_usage_endpoint"],
    "limits": [
      { "label": "Session", "percentPath": "session.percent_used", "resetsAtPath": "session.reset" }
    ]
  }
}
```

The keys:

| Key | Purpose |
| --- | --- |
| `usageUrl`, `loginUrl` | Pages to load |
| `responseUrlPatterns` | Regexes (case-insensitive) for the JSON responses to parse |
| `limits[]` | `label`, plus either `percentPath`, or `usedPath` and `limitPath`. Optional `resetsAtPath` (ISO or epoch) or `resetsInSecondsPath` |
| `percentScale` | `auto` (values ≤ 1 with decimals are treated as fractions), `percent` or `fraction` |
| `autoKeys` | Keys searched anywhere in matching JSON when no path yields a value |
| `loggedOutUrlPatterns` / `loggedOutStatusCodes` | How the logged-out state is detected |
| `sessionCheck` | *(ChatGPT)* an endpoint whose `loggedInPath` exists only when logged in |
| `dom.progressSelectors`, `dom.textPatterns` | Settings for the DOM fallback |
| `timeoutMs`, `settleMs` | How long to wait for data, and how long to keep collecting after the first hit |

Path syntax: use dots, with numbers for array indices, e.g. `limits.0.used_percent`.

The workflow:

1. Turn on debug mode.
2. Refresh.
3. Find the right response in `debug-log.json`.
4. Update the patterns and paths.
5. Restart Tokki.

If the change should ship, update `src/config/extractors.json` and add a
test case in `test/parse.test.cjs`.

## Troubleshooting

| Symptom | Try |
| --- | --- |
| A service always shows `login` | Use **Log in to …** from the menu, then close the window when you're done |
| `?` after a site update | Turn on debug mode and see [Updating extractors](#updating-extractors-when-the-sites-change) |
| `?` with "could not find usage on page" | Open the login window once. A Cloudflare "verify you are human" check may need solving in a visible window |
| `?` with "could not load page" | Network or DNS problem. Tokki keeps the last known value and tries again next interval |

## Building

```bash
npm run build
```

`npm run build` type-checks and bundles into `dist/`.

```bash
npm run dist:win
```

`npm run dist:win` builds an NSIS installer and a portable `.exe` (x64) into `release/`.

```bash
npm run dist:mac
```

`npm run dist:mac` builds `.dmg` files for arm64 and x64 into `release/`.

```bash
npm run dist:linux
```

`npm run dist:linux` builds an AppImage into `release/`.

Packaged builds turn off the Electron fuses for Node CLI/inspect arguments,
`NODE_OPTIONS` and run-as-node. This is hardening, and it also lets
`--debug` reach the app instead of being rejected as an obsolete Node flag.

Builds are unsigned. On macOS, the first time you open the app, right-click
it and choose **Open**. On Windows, SmartScreen may ask you to confirm with
**More info → Run anyway**.

App icons are generated from the rabbit design and committed. To regenerate
them after editing the SVG in `scripts/gen-icons.mjs`:

```bash
npm run icons
```

### Releases

Pushing a tag such as `v0.1.0` runs `.github/workflows/release.yml`. It builds
on `windows-latest` and `macos-latest` and attaches the installers to a
GitHub Release:

```bash
git tag v0.1.0
```

```bash
git push origin v0.1.0
```

## Project layout

```
src/
  main/        Electron main process: widget, tray, menu, poller, login, settings, debug log
  providers/   claude.ts, chatgpt.ts, the shared CDP/DOM engine, pure parsers
  config/      extractors.json (URL patterns and field paths)
  preload/     the minimal window.tokki IPC bridge
  renderer/    widget, hover card and settings pages (plain HTML/CSS/TS)
  shared/      types and mood/threshold logic shared by main and renderers
scripts/       build.mjs (esbuild), gen-icons.mjs
test/          node:test unit tests
```

The renderers use `contextIsolation: true`, `nodeIntegration: false` and
`sandbox: true`. Each page has a strict CSP, and IPC is accepted only from
Tokki's own `file://` pages.

## License

MIT
