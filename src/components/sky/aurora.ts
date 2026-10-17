import { envelope, tag, within, type Frame } from './context';
import { bayer, hash, lerp3, smooth, valueNoise, type RGB } from './pixel';

// The northern lights, different every night: a quiet arc, rayed curtains that
// fold and ripple, parallel bands, a corona overhead, pulsing patches, a deep red
// glow, or STEVE's thin violet ribbon over its green picket fence. A substorm
// partway through the night brightens everything and sets the rays racing.

export type AuroraForm = 'curtains' | 'arc' | 'bands' | 'corona' | 'pulsing' | 'red' | 'steve';
export const AURORA_FORMS: AuroraForm[] = ['curtains', 'arc', 'bands', 'corona', 'pulsing', 'red', 'steve'];
// How likely each form is on an aurora night, in the same order.
export const AURORA_ODDS = [0.3, 0.16, 0.12, 0.12, 0.1, 0.1, 0.1];
export const AURORA_NAMES: Record<AuroraForm, string> = {
  curtains: 'Northern lights',
  arc: 'Aurora arc',
  bands: 'Aurora bands',
  corona: 'Aurora corona',
  pulsing: 'Pulsing aurora',
  red: 'Red aurora',
  steve: 'STEVE',
};

export type Aurora = { from: number; to: number; seed: number; form: AuroraForm; theme: number };

const GREEN: RGB = [70, 255, 150];
const GREEN_PALE: RGB = [140, 250, 200];
const PINK: RGB = [255, 80, 190];
const VIOLET: RGB = [160, 90, 255];
const RED: RGB = [240, 50, 80];
const MAUVE: RGB = [226, 130, 255];
const MAUVE_CORE: RGB = [255, 214, 255];
// The colour a curtain fades to at its top: violet, red, or blue.
const TOPS: RGB[] = [VIOLET, RED, [90, 120, 255]];

type Ctx = { f: Frame; data: Uint8ClampedArray; k: number; active: number; theme: number; s: number; t: number };

// Add light to one pixel, snapped to a few steps with ordered dithering.
function glow(c: Ctx, x: number, y: number, color: RGB, k: number) {
  if (k <= 0.02 || x < 0 || y < 0 || x >= c.f.cols || y >= c.f.rows) return;
  const level = Math.min(1.4, k) * 3;
  let lo = Math.floor(level);
  if (level - lo > bayer(x, y)) lo++;
  if (!lo) return;
  const a = (lo / 3) * 0.55;
  const i = (y * c.f.cols + x) * 4;
  const d = c.data;
  d[i] = Math.min(255, d[i] + color[0] * a);
  d[i + 1] = Math.min(255, d[i + 1] + color[1] * a);
  d[i + 2] = Math.min(255, d[i + 2] + color[2] * a);
}

// Colour up a curtain: v is 0 at its sharp lower edge and 1 at its faded top.
function curtainColor(c: Ctx, v: number): RGB {
  let out = GREEN;
  // The lower fringe turns pink when the aurora gets lively.
  if (v < 0.12 && (c.active > 0.45 || c.theme === 2)) out = lerp3(PINK, GREEN, v / 0.12);
  if (v > 0.4) out = lerp3(GREEN, TOPS[c.theme], smooth(0.4, 1, v));
  return out;
}

// Brightness up a curtain: a sharp lower edge, then fading toward the top.
function profile(v: number, height: number) {
  if (v < 0) return Math.exp(v * height * 0.8) * 0.6;
  if (v < 0.08) return 0.75 + (v / 0.08) * 0.25;
  return Math.pow(1 - (v - 0.08) / 0.92, 1.3);
}

// One curtain hanging from a wavy lower edge. ripple sets how much it folds,
// rays how strongly it splits into upright rays.
function curtain(c: Ctx, base0: number, height0: number, ripple: number, rays: number, strength: number, key: number) {
  const { f, t, s } = c;
  const { cols, rows } = f;
  const speed = (0.5 + c.active * 2) * (key % 2 ? -1 : 1);
  const edge = (x: number) => {
    const xs = x * 0.035;
    return base0 + ripple * (Math.sin(xs * 2.2 + t * 0.22 + key * 2) * rows * 0.045 + (valueNoise(xs + t * 0.05, s + key * 7) - 0.5) * rows * 0.14);
  };
  for (let x = 0; x < cols; x++) {
    const base = edge(x);
    // Where the curtain folds back on itself we see it edge-on, so it's brighter.
    const fold = 1 + Math.min(1.8, Math.abs(edge(x + 1) - base) * 1.4 * ripple);
    const height = height0 * (0.7 + 0.6 * valueNoise(x * 0.045 + 3, t * 0.04 + key));
    const ray = 1 - rays + rays * Math.pow(valueNoise(x * 0.5 + t * speed, s + 11 + key), 1.6);
    const along = 0.5 + 0.5 * valueNoise(x * 0.02 - t * 0.03, s + 20 + key);
    const k = c.k * strength * fold * ray * along;
    if (k <= 0.02) continue;
    const y0 = Math.max(0, Math.floor(base - height));
    const y1 = Math.min(rows, Math.ceil(base + 4));
    for (let y = y0; y < y1; y++) {
      const v = (base - y) / height;
      glow(c, x, y, curtainColor(c, v), k * profile(v, height));
    }
  }
}

function drawCurtains(c: Ctx) {
  const { rows } = c.f;
  const count = 1 + (c.s % 3);
  for (let i = 0; i < count; i++) {
    curtain(c, rows * (0.5 + i * 0.12 + (hash(c.s, i) - 0.5) * 0.06), rows * (0.24 - i * 0.04), 1, 0.75, 1.15 - i * 0.2, i);
  }
}

// A single smooth arc, steady and quiet, barely rayed.
function drawArc(c: Ctx) {
  const { cols, rows } = c.f;
  const breathe = 0.8 + 0.2 * Math.sin(c.t * 0.35);
  for (let x = 0; x < cols; x++) {
    const q = (x / cols - 0.5) * 2;
    const base = rows * (0.66 - 0.1 * (1 - q * q));
    const height = rows * 0.2;
    const k = c.k * breathe * (0.85 + 0.15 * valueNoise(x * 0.3 + c.t * 0.3, c.s));
    for (let y = Math.max(0, Math.floor(base - height)); y < Math.min(rows, base + 4); y++) {
      const v = (base - y) / height;
      glow(c, x, y, curtainColor(c, v), k * profile(v, height));
    }
  }
}

// Two or three parallel arcs, fainter the higher they sit.
function drawBands(c: Ctx) {
  const { rows } = c.f;
  const count = 2 + (c.s % 2);
  for (let i = 0; i < count; i++) curtain(c, rows * (0.72 - i * 0.16), rows * (0.14 - i * 0.02), 0.35, 0.35, 1 - i * 0.25, i + 3);
}

// Overhead, the rays seem to burst out from a point high above the top of the sky.
function drawCorona(c: Ctx) {
  const { f, t, s } = c;
  const { cols, rows } = f;
  const cx = cols * (0.5 + (hash(s, 3) - 0.5) * 0.3);
  const cy = -rows * 0.18;
  const spin = t * (0.12 + c.active * 0.3);
  for (let y = 0; y < rows * 0.9; y++) {
    for (let x = 0; x < cols; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dx, dy);
      const ray = Math.pow(valueNoise(a * 24 + spin, s + 5), 2.2) * (0.5 + 0.5 * valueNoise(a * 6 - t * 0.15, s + 6));
      const radial = smooth(rows * 0.15, rows * 0.4, d) * (1 - smooth(rows * 0.65, rows * 1.05, d));
      const color = lerp3(c.theme === 1 ? RED : VIOLET, GREEN, smooth(rows * 0.25, rows * 0.7, d));
      glow(c, x, y, color, c.k * ray * radial * 1.6);
    }
  }
}

// Soft patches that blink on and off, each on its own beat.
function drawPulsing(c: Ctx) {
  const { f, t, s } = c;
  const { cols, rows } = f;
  // A faint diffuse glow low in the sky ties them together.
  for (let y = Math.floor(rows * 0.45); y < rows; y++) {
    const k = c.k * 0.12 * smooth(rows * 0.45, rows, y);
    for (let x = 0; x < cols; x++) glow(c, x, y, GREEN_PALE, k * (0.7 + 0.3 * valueNoise(x * 0.05, y * 0.05 + s)));
  }
  for (let i = 0; i < 10; i++) {
    const key = s + i * 31;
    const px = cols * hash(key, 1);
    const py = rows * (0.18 + 0.6 * hash(key, 2));
    const R = (7 + 10 * hash(key, 3)) * f.scale + 4;
    const period = 3 + 5 * hash(key, 4);
    const phase = (t / period + hash(key, 5)) % 1;
    const on = smooth(0, 0.06, phase) * (1 - smooth(0.32, 0.45, phase));
    if (on <= 0.02) continue;
    for (let dy = -Math.ceil(R); dy <= R; dy++) {
      for (let dx = -Math.ceil(R); dx <= R; dx++) {
        const x = Math.round(px + dx);
        const y = Math.round(py + dy);
        const d = Math.hypot(dx / R, dy / (R * 0.65)) * (0.75 + 0.5 * valueNoise(x * 0.14, y * 0.14 + i));
        if (d < 1) glow(c, x, y, GREEN_PALE, c.k * on * 0.85 * Math.pow(1 - d, 0.6));
      }
    }
  }
}

// A great storm: a deep red glow high up over a faint green arc.
function drawRed(c: Ctx) {
  const { f, t, s } = c;
  const { cols, rows } = f;
  for (let y = 0; y < rows * 0.62; y++) {
    const band = 1 - Math.abs(y - rows * 0.24) / (rows * 0.3);
    if (band <= 0) continue;
    for (let x = 0; x < cols; x++) {
      const n = 0.55 + 0.45 * valueNoise(x * 0.03 + t * 0.03, y * 0.06 + s);
      glow(c, x, y, RED, c.k * band * n * 0.95);
    }
  }
  curtain(c, rows * 0.76, rows * 0.12, 0.3, 0.3, 0.55, 5);
}

// STEVE: a narrow mauve ribbon arching up out of the horizon across the sky, with
// short green streaks hanging beneath it like a picket fence.
function drawSteve(c: Ctx) {
  const { f, t, s } = c;
  const { cols, rows } = f;
  const lean = hash(s, 7) < 0.5 ? 1 : -1;
  const at = (q: number): [number, number] => [
    cols * (lean > 0 ? q * 1.1 - 0.05 : 1.05 - q * 1.1),
    rows * (0.95 - 0.72 * Math.sin(q * Math.PI * 0.5)) + Math.sin(q * 5 + s) * rows * 0.015,
  ];
  const steps = Math.ceil(rows * 2.5);
  for (let i = 0; i <= steps; i++) {
    const q = i / steps;
    const [x, y] = at(q);
    const flow = 0.6 + 0.4 * valueNoise(q * 16 - t * 0.5, s);
    const k = c.k * flow;
    const xi = Math.round(x);
    const yi = Math.round(y);
    glow(c, xi, yi, MAUVE_CORE, k * 0.9);
    glow(c, xi, yi + 1, MAUVE, k * 0.85);
    glow(c, xi, yi - 1, MAUVE, k * 0.5);
    glow(c, xi, yi + 2, MAUVE, k * 0.35);
    glow(c, xi, yi - 2, MAUVE, k * 0.2);
  }
  for (let j = 0; j < 18; j++) {
    const q = 0.1 + j * 0.026 + (hash(s + j, 8) - 0.5) * 0.01;
    const [x, y] = at(q);
    const flicker = 0.55 + 0.45 * valueNoise(j * 3.1, t * 1.5);
    const len = (4 + 6 * hash(s + j, 9)) * f.scale + 2;
    for (let d = 0; d < len; d++) glow(c, Math.round(x), Math.round(y + 4 + d), GREEN, c.k * flicker * (1 - d / len) * 1.1);
  }
}

const DRAW: Record<AuroraForm, (c: Ctx) => void> = {
  curtains: drawCurtains,
  arc: drawArc,
  bands: drawBands,
  corona: drawCorona,
  pulsing: drawPulsing,
  red: drawRed,
  steve: drawSteve,
};

export function drawAurora(f: Frame) {
  const a = f.plan.aurora;
  if (!a) return;
  const p = within(f.u, a.from, a.to);
  if (p < 0) return;
  const k = envelope(p, 0.18) * (1 - smooth(0.3, 0.65, f.weather.cover)) * Math.min(1, f.mix.stars * 1.4 + 0.2);
  if (k <= 0.02) return;
  // A substorm partway through the night: everything brightens and speeds up.
  const burst = smooth(0.38, 0.46, p) * (1 - smooth(0.56, 0.66, p));
  const ctx: Ctx = { f, data: f.img.data, k: k * (1 + burst * 0.6), active: 0.25 + burst * 0.75, theme: a.theme, s: a.seed % 1000, t: f.t };
  DRAW[a.form](ctx);
  tag(f, AURORA_NAMES[a.form], f.cols / 2, f.rows * 0.4, f.cols / 3);
}
