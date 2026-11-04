/**
 * The floating Tokki widget: a small frameless, transparent, always-on-top
 * window with no taskbar entry, plus a hover "tooltip" window for details.
 *
 * The whole widget is a `-webkit-app-region: drag` region (draggable anywhere).
 * Drag regions swallow mouse events on some platforms, so:
 *  - right-click is handled both via the renderer `contextmenu` event and the
 *    window's `system-context-menu` event (Windows/Linux);
 *  - hover is detected by cheaply polling the cursor position (4×/s, only
 *    while the widget is visible).
 */
import { BrowserWindow, screen, type Rectangle } from 'electron';
import { preloadFile, rendererFile } from './paths';
import { settings } from './settings';

const FULL = { width: 180, height: 70 };
const COMPACT = { width: 116, height: 70 };
const TOOLTIP_WIDTH = 264;

const secureWebPreferences = () => ({
  preload: preloadFile(),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
  spellcheck: false,
});

function onScreen(r: Rectangle): boolean {
  return screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return r.x + r.width - 20 > a.x && r.x + 20 < a.x + a.width && r.y + 10 > a.y && r.y + 20 < a.y + a.height;
  });
}

export class Widget {
  win: BrowserWindow;
  private tip: BrowserWindow | null = null;
  private tipHeight = 120;
  private hoverTicks = 0;
  private poll: NodeJS.Timeout | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  private lastMenuAt = 0;

  constructor(private onContextMenu: (win: BrowserWindow) => void) {
    const s = settings.get();
    const size = s.compact ? COMPACT : FULL;
    const wa = screen.getPrimaryDisplay().workArea;
    let pos = s.widgetPosition ?? { x: wa.x + wa.width - size.width - 24, y: wa.y + wa.height - size.height - 24 };
    if (!onScreen({ ...pos, ...size })) pos = { x: wa.x + wa.width - size.width - 24, y: wa.y + wa.height - size.height - 24 };

    this.win = new BrowserWindow({
      ...size,
      ...pos,
      frame: false,
      transparent: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      show: false,
      title: 'Tokki',
      backgroundColor: '#00000000',
      webPreferences: secureWebPreferences(),
    });
    this.win.setAlwaysOnTop(true, 'floating');
    if (process.platform === 'darwin') this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.win.loadFile(rendererFile('widget.html'));
    this.win.once('ready-to-show', () => {
      if (settings.get().widgetVisible) this.win.showInactive();
    });

    this.win.on('moved', () => this.savePosition());
    this.win.on('move', () => {
      this.hideTip();
      if (this.saveTimer) clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => this.savePosition(), 600);
    });
    // Right-click on the drag region (Windows/Linux).
    this.win.on('system-context-menu', (e) => {
      e.preventDefault();
      this.popupMenu();
    });
    this.win.on('show', () => this.startHoverPoll());
    this.win.on('hide', () => this.stopHoverPoll());
    this.win.on('closed', () => this.stopHoverPoll());
  }

  /** Called for renderer `contextmenu` events too; de-duplicated. */
  popupMenu() {
    if (Date.now() - this.lastMenuAt < 300) return;
    this.lastMenuAt = Date.now();
    this.hideTip();
    this.onContextMenu(this.win);
  }

  private savePosition() {
    if (this.win.isDestroyed()) return;
    const [x, y] = this.win.getPosition();
    const cur = settings.get().widgetPosition;
    if (!cur || cur.x !== x || cur.y !== y) settings.update({ widgetPosition: { x, y } });
  }

  isVisible() {
    return !this.win.isDestroyed() && this.win.isVisible();
  }

  setVisible(v: boolean) {
    if (v) {
      this.win.showInactive();
      this.win.setAlwaysOnTop(true, 'floating');
    } else {
      this.hideTip();
      this.win.hide();
    }
  }

  setCompact(compact: boolean) {
    const size = compact ? COMPACT : FULL;
    const [w] = this.win.getSize();
    // Keep the right edge anchored so the pill doesn't jump.
    const [x, y] = this.win.getPosition();
    this.win.setBounds({ x: x + (w - size.width), y, ...size });
  }

  // ---- hover tooltip ----

  private startHoverPoll() {
    if (this.poll) return;
    this.poll = setInterval(() => this.checkHover(), 250);
  }

  private stopHoverPoll() {
    if (this.poll) clearInterval(this.poll);
    this.poll = null;
    this.hideTip();
  }

  private checkHover() {
    if (this.win.isDestroyed() || !this.win.isVisible()) return;
    const p = screen.getCursorScreenPoint();
    const b = this.win.getBounds();
    const inside = p.x >= b.x && p.x < b.x + b.width && p.y >= b.y && p.y < b.y + b.height;
    if (inside) {
      this.hoverTicks++;
      if (this.hoverTicks === 3) this.showTip(); // ~0.6s dwell
    } else if (this.hoverTicks) {
      this.hoverTicks = 0;
      this.hideTip();
    }
  }

  private ensureTip(): BrowserWindow {
    if (this.tip && !this.tip.isDestroyed()) return this.tip;
    this.tip = new BrowserWindow({
      width: TOOLTIP_WIDTH,
      height: this.tipHeight,
      frame: false,
      transparent: true,
      resizable: false,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      alwaysOnTop: true,
      show: false,
      backgroundColor: '#00000000',
      webPreferences: secureWebPreferences(),
    });
    this.tip.setAlwaysOnTop(true, 'pop-up-menu');
    this.tip.setIgnoreMouseEvents(true);
    if (process.platform === 'darwin') this.tip.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    this.tip.loadFile(rendererFile('tooltip.html'));
    return this.tip;
  }

  /** The tooltip renderer reports its content height. */
  setTipHeight(h: number) {
    this.tipHeight = Math.max(40, Math.min(400, Math.ceil(h)));
    if (this.tip && !this.tip.isDestroyed()) {
      this.tip.setSize(TOOLTIP_WIDTH, this.tipHeight);
      if (this.tip.isVisible()) this.positionTip();
    }
  }

  private positionTip() {
    const tip = this.ensureTip();
    const b = this.win.getBounds();
    const wa = screen.getDisplayMatching(b).workArea;
    let x = b.x + b.width - TOOLTIP_WIDTH;
    x = Math.max(wa.x + 4, Math.min(x, wa.x + wa.width - TOOLTIP_WIDTH - 4));
    let y = b.y + b.height + 4;
    if (y + this.tipHeight > wa.y + wa.height) y = b.y - this.tipHeight - 4;
    tip.setBounds({ x: Math.round(x), y: Math.round(Math.max(wa.y, y)), width: TOOLTIP_WIDTH, height: this.tipHeight });
  }

  private showTip() {
    const tip = this.ensureTip();
    this.positionTip();
    if (tip.webContents.isLoading()) tip.webContents.once('did-finish-load', () => this.hoverTicks && tip.showInactive());
    else tip.showInactive();
  }

  hideTip() {
    if (this.tip && !this.tip.isDestroyed() && this.tip.isVisible()) this.tip.hide();
  }

  allWindows(): BrowserWindow[] {
    return [this.win, this.tip].filter((w): w is BrowserWindow => !!w && !w.isDestroyed());
  }
}

export { secureWebPreferences };
