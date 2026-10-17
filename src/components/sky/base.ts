import { cloudAt, type Frame } from './context';
import { starAt } from './night';
import { BLOCK, SKY_SPEED, bayer, clamp, lerp3, mixN, put, skyField, smooth, valueNoise, type RGB } from './pixel';

// The background sky: dithered bands of cloud in the day's palette, thickening as
// the cover rises until they merge into a grey deck, with stars showing through
// the clear patches.

const SHADOW: RGB = [20, 22, 26];

// Under a thick cover the banks merge into a deck with a texture of its own: long
// stratus layers with darker rolls, each band drifting at its own pace.
function deckAt(bx: number, by: number, t: number, travel: number) {
  const sx = (bx - travel * (SKY_SPEED / BLOCK) * (0.55 + by * 0.02)) * 0.05;
  const sy = by * 0.34;
  const n = valueNoise(sx, sy) * 0.55 + valueNoise(sx * 2.4 + 7, sy * 1.7 + t * 0.02) * 0.3 + valueNoise(sx * 6 + 3, sy * 3.1) * 0.15;
  return clamp((n - 0.22) / 0.56);
}
// Width of the dark fringe at the reveal's wipe front.
export const FRINGE = 0.09;

// edgeAt(bx, by), when given, says how far past each block the opening reveal has
// got: below 0 the block stays transparent, just past 0 it shows the dark fringe.
export function drawBase(f: Frame, edgeAt?: (bx: number, by: number) => number) {
  const { img, cols, rows, mix, weather, t } = f;
  const data = img.data;
  const blockCols = Math.ceil(cols / BLOCK);
  const blockRows = Math.ceil(rows / BLOCK);
  const levels = mix.top.length;
  const cover = weather.cover;
  const shift = Math.floor(f.starShift);
  const deck = smooth(0.45, 0.85, cover);
  // Rain and storms darken the sky most overhead.
  const heavy = weather.dark * 0.4;

  for (let by = 0; by < blockRows; by++) {
    // This row's palette: the phase's top colours fading into its horizon colours.
    const gy = blockRows > 1 ? by / (blockRows - 1) : 0;
    const palette = mix.top.map((c, l) => lerp3(c, mix.bottom[l], gy).map((v) => Math.round(v * (1 - heavy * (1 - gy)))) as RGB);
    for (let bx = 0; bx < blockCols; bx++) {
      const edge = edgeAt ? edgeAt(bx, by) : 1;
      // More cloud banks as the cover rises, merging into the deck.
      let value = skyField(bx, by, t, f.travel);
      value = clamp(value * (1 - cover * 0.3) + cover * 0.38);
      if (deck > 0) value = mixN(value, 0.28 + deckAt(bx, by, t, f.travel) * 0.62, deck);
      f.field[by * blockCols + bx] = value;
      const level = value * (levels - 1);
      const lo = Math.floor(level);
      // Snap most blocks to a solid colour and only dither the in-between ones.
      const raw = level - lo;
      const frac = raw < 0.3 ? 0 : raw > 0.7 ? 1 : (raw - 0.3) / 0.4;
      // Stars only show through the darker, clear patches of sky.
      const starry = mix.stars > 0 && value < 0.42;

      for (let py = 0; py < BLOCK; py++) {
        const y = by * BLOCK + py;
        if (y >= rows) break;
        for (let px = 0; px < BLOCK; px++) {
          const x = bx * BLOCK + px;
          if (x >= cols) break;
          const i = (y * cols + x) * 4;
          const threshold = bayer(x, y);
          let color: RGB | null;
          if (edge < 0) {
            color = null;
          } else if (edge < FRINGE) {
            // Dark checkered fringe right at the wipe front.
            color = threshold < (edge < 0.045 ? 0.35 : 0.65) ? SHADOW : null;
          } else {
            color = palette[Math.min(levels - 1, frac > threshold ? lo + 1 : lo)];
            if (starry) color = starAt(x - shift, y, t, mix.stars) ?? color;
          }
          if (color) {
            put(data, i, color);
            data[i + 3] = 255;
          } else {
            data[i + 3] = 0;
          }
        }
      }
    }
  }
}

const FLASH: RGB = [216, 216, 238];

// A lightning flash lights up the whole sky for a moment.
export function applyFlash(f: Frame) {
  if (f.flash <= 0.01) return;
  const { img, cols, rows } = f;
  const data = img.data;
  const amount = Math.min(0.6, f.flash * 0.5);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      if (!data[i + 3]) continue;
      // Cloud banks light up more than the gaps between them.
      const k = amount * (0.55 + 0.45 * cloudAt(f, x, y));
      data[i] += (FLASH[0] - data[i]) * k;
      data[i + 1] += (FLASH[1] - data[i + 1]) * k;
      data[i + 2] += (FLASH[2] - data[i + 2]) * k;
    }
  }
}
