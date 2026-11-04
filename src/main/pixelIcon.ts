/**
 * Renders the two usage numbers into a tiny tray icon (Windows/Linux, where
 * the tray can't show text). Pure TS: a 3×5 pixel font + minimal PNG encoder,
 * so no hidden window or canvas is needed.
 */
import zlib from 'node:zlib';

const GLYPHS: Record<string, string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '111', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '001', '001', '001'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '?': ['111', '001', '011', '000', '010'],
  '-': ['000', '000', '111', '000', '000'],
};

export type RGBA = [number, number, number, number];

export interface IconRow {
  text: string; // e.g. "42", "100", "?", "--"
  color: RGBA;
}

class Canvas {
  data: Buffer;
  constructor(public w: number, public h: number) {
    this.data = Buffer.alloc(w * h * 4);
  }
  set(x: number, y: number, c: RGBA) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = c[3];
  }
  rect(x: number, y: number, w: number, h: number, c: RGBA) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  /** Rounded rectangle with radius r (pixel-approximated). */
  roundRect(x: number, y: number, w: number, h: number, r: number, c: RGBA) {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const dx = xx < r ? r - xx - 0.5 : xx >= w - r ? xx - (w - r) + 0.5 : 0;
        const dy = yy < r ? r - yy - 0.5 : yy >= h - r ? yy - (h - r) + 0.5 : 0;
        if (dx * dx + dy * dy <= r * r) this.set(x + xx, y + yy, c);
      }
    }
  }
}

function textWidth(text: string, scale: number): number {
  return text.length * 3 * scale + (text.length - 1) * scale;
}

function drawText(cv: Canvas, text: string, x: number, y: number, scale: number, c: RGBA) {
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS[ch] ?? GLYPHS['?'];
    g.forEach((row, ry) => {
      for (let rx = 0; rx < 3; rx++) if (row[rx] === '1') cv.rect(cx + rx * scale, y + ry * scale, scale, scale, c);
    });
    cx += 4 * scale;
  }
}

/** Draw two rows of numbers on a dark rounded tile. size is 16 or 32 (any multiple of 16 works). */
export function renderUsageIcon(rows: IconRow[], size: number): Buffer {
  const scale = Math.max(1, Math.floor(size / 16));
  const cv = new Canvas(size, size);
  cv.roundRect(0, 0, size, size, 3 * scale, [28, 28, 34, 235]);
  const rowH = 5 * scale;
  const gap = 2 * scale;
  const total = rows.length * rowH + (rows.length - 1) * gap;
  let y = Math.floor((size - total) / 2);
  for (const r of rows) {
    const w = textWidth(r.text, scale);
    drawText(cv, r.text, Math.floor((size - w) / 2), y, scale, r.color);
    y += rowH + gap;
  }
  return encodePng(cv.w, cv.h, cv.data);
}

// --- Minimal PNG encoder (RGBA, 8-bit, no interlace) ---

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

export function encodePng(w: number, h: number, rgba: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
