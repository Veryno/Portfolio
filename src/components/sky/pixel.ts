// Shared pixel-art primitives for the sky canvas.

// Size of one rendered "pixel" in CSS px. Both layers are drawn at low
// resolution and scaled up with nearest-neighbour sampling for the crunchy look.
export const PIXEL = 3;
// Colour blocks are BLOCK x BLOCK pixels; dithering happens inside each block.
export const BLOCK = 5;
// Sky drift speed in sky pixels per second (left to right, against the dot clouds).
export const SKY_SPEED = 9;

export type RGB = [number, number, number];

export const STAR: RGB = [255, 250, 228];
export const STAR_DIM: RGB = [168, 178, 214];

// 4x4 ordered-dither matrix, normalised to [0, 1).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

export function bayer(x: number, y: number) {
  return BAYER[(y & 3) * 4 + (x & 3)];
}

export function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function valueNoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Sky brightness for block (x, y): 0 = deep sky, 1 = bright cloud bank. drift is
// how far the bands have travelled (in seconds at the normal speed), so the wind
// can speed them up, slow them down or turn them around.
export function skyField(x: number, y: number, t: number, drift = t) {
  // Wide horizontal bands of cloud drifting left to right.
  const sx = (x - drift * SKY_SPEED / BLOCK) * 0.075;
  const sy = y * 0.13;
  let n = valueNoise(sx, sy) * 0.6;
  n += valueNoise(sx * 2.2 + 17, sy * 2.2 - t * 0.03) * 0.28;
  n += valueNoise(sx * 5 - 5, sy * 5 + 9) * 0.12;
  // Stretch contrast so there are bold deep-blue rivers and bright cloud banks.
  return Math.min(1, Math.max(0, (n - 0.28) / 0.44));
}

export function lerp3(a: RGB, b: RGB, f: number): RGB {
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}

export function smooth(edge0: number, edge1: number, v: number) {
  const x = Math.min(1, Math.max(0, (v - edge0) / (edge1 - edge0)));
  return x * x * (3 - 2 * x);
}

export function put(data: Uint8ClampedArray, i: number, c: RGB) {
  data[i] = c[0];
  data[i + 1] = c[1];
  data[i + 2] = c[2];
}

// Move the pixel at i a fraction of the way toward c.
export function blend(data: Uint8ClampedArray, i: number, c: RGB, amount: number) {
  data[i] += (c[0] - data[i]) * amount;
  data[i + 1] += (c[1] - data[i + 1]) * amount;
  data[i + 2] += (c[2] - data[i + 2]) * amount;
}

export function clamp(v: number, lo = 0, hi = 1) {
  return Math.min(hi, Math.max(lo, v));
}

export function mixN(a: number, b: number, f: number) {
  return a + (b - a) * f;
}

// 1D value noise for slow timelines. Lattice positions are folded so huge inputs
// (stretch numbers on the shared clock) still hash without losing precision.
export function vnoise1(x: number, seed: number) {
  const xi = Math.floor(x);
  const f = x - xi;
  const u = f * f * (3 - 2 * f);
  const a = hash(xi & 0xfffff, seed);
  const b = hash((xi + 1) & 0xfffff, seed);
  return a + (b - a) * u;
}

// Layered 1D noise: smooth spells with a little short-term wobble.
export function fbm1(x: number, seed: number) {
  return vnoise1(x, seed) * 0.6 + vnoise1(x * 2.13 + 17.3, seed + 1) * 0.28 + vnoise1(x * 4.37 + 5.1, seed + 2) * 0.12;
}

// Blend one pixel toward c, ignoring anything off the canvas.
export function plot(img: ImageData, x: number, y: number, c: RGB, amount: number) {
  if (amount <= 0 || x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  blend(img.data, (y * img.width + x) * 4, c, Math.min(1, amount));
}

// Ordered-dither plot: the pixel takes c (at strength) when amount beats its threshold.
export function dot(img: ImageData, x: number, y: number, c: RGB, amount: number, strength = 1) {
  if (amount > bayer(x, y)) plot(img, x, y, c, strength);
}

// Bresenham line, blending every pixel on it.
export function line(img: ImageData, x0: number, y0: number, x1: number, y1: number, c: RGB, amount: number) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 2000; guard++) {
    plot(img, x0, y0, c, amount);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// Draw a sprite from rows of characters; each character maps to a colour (or is skipped).
export function sprite(img: ImageData, x: number, y: number, rows: string[], palette: Record<string, RGB>, amount = 1, flip = false) {
  const w = rows[0]?.length ?? 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length; c++) {
      const color = palette[row[c]];
      if (color) plot(img, x + (flip ? w - 1 - c : c), y + r, color, amount);
    }
  }
}
