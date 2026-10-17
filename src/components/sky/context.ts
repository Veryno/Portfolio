import type { SkyMix } from './phases';
import type { DayPlan } from './plan';
import { BLOCK, smooth } from './pixel';
import type { SkyWeather } from './weather';

// A named sight on screen this frame, for the hover/tap name tags (sky pixels).
export type Tag = { name: string; x: number; y: number; r: number };

export type Body = { x: number; y: number; r: number };

// Everything a sky layer needs to draw one frame into the box's pixels.
export type Frame = {
  img: ImageData;
  cols: number;
  rows: number;
  scale: number;        // 1 on the 650px desktop box, down to 0.65 on phones
  t: number;            // seconds since the page opened: drift, twinkle, flapping
  sec: number;          // shared-clock seconds, the same for every visitor
  u: number;            // how far through the day, 0..1
  n: number;            // day number on the shared clock
  dayLength: number;    // seconds in one sky day
  mix: SkyMix;          // the day's palette after the weather
  clearMix: SkyMix;     // the same palette under a clear sky (seen through holes in the cloud)
  weather: SkyWeather;
  plan: DayPlan;
  field: Float32Array;  // sky-field value per block, so things can hide behind cloud banks
  blockCols: number;
  starShift: number;    // how far the stars have drifted, in sky pixels
  travel: number;       // how far the background cloud bands have drifted (wind-adjusted seconds)
  sun: Body | null;     // set once the sun is drawn, for halos and rays
  moon: Body | null;
  flash: number;        // lightning flash this frame, 0..1
  tags: Tag[];
};

// How much bright cloud covers sky pixel (x, y): 0 clear .. 1 behind a cloud bank.
export function cloudAt(f: Frame, x: number, y: number) {
  const bx = Math.floor(x / BLOCK);
  const by = Math.floor(y / BLOCK);
  if (bx < 0 || by < 0 || bx >= f.blockCols) return 0;
  const v = f.field[by * f.blockCols + bx] ?? 0;
  return smooth(0.6, 0.92, v);
}

// Progress through a window of the day, or -1 outside it.
export function within(u: number, from: number, to: number) {
  return u >= from && u <= to ? (u - from) / (to - from) : -1;
}

// Seconds since the day passed `at` (almost a full day if it hasn't yet).
export function since(f: Frame, at: number) {
  return ((f.u - at + 1) % 1) * f.dayLength;
}

// Fade in over the first part of a window and out over the last.
export function envelope(p: number, edge = 0.12) {
  return p < 0 || p > 1 ? 0 : Math.min(1, p / edge, (1 - p) / edge);
}

export function tag(f: Frame, name: string, x: number, y: number, r: number) {
  if (x + r < 0 || y + r < 0 || x - r > f.cols || y - r > f.rows) return;
  f.tags.push({ name, x, y, r });
}
