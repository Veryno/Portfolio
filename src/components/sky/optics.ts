import { cloudAt, envelope, tag, within, type Frame } from './context';
import { bayer, blend, dot, hash, plot, smooth, valueNoise, type RGB } from './pixel';

// Light playing in the sky: ice-crystal halos around the sun and moon, sun dogs,
// the sun pillar and its crossbar, light arcs, rays through clouds, the Belt of
// Venus after sunset, and light pillars on icy nights.

const HALO_IN: RGB = [255, 196, 170];
const HALO_OUT: RGB = [236, 240, 255];
const DOG_RED: RGB = [255, 150, 120];
const DOG_CORE: RGB = [255, 246, 226];
const DOG_BLUE: RGB = [190, 214, 255];
const ARC_BANDS: RGB[] = [[255, 140, 130], [255, 224, 140], [170, 240, 170], [150, 190, 255]];

export function drawSunOptics(f: Frame) {
  const { sun, plan, weather } = f;
  if (!sun) return;
  const strength = plan.halo || plan.pillar ? Math.max(weather.haze, 0.45) * (1 - smooth(0.55, 0.8, weather.cover)) : 0;
  if (strength <= 0) return;
  const Rh = Math.round(34 * f.scale);
  if (plan.halo) {
    drawRing(f, sun.x, sun.y, Rh, strength * 0.75);
    tag(f, '22° halo', sun.x, sun.y - Rh, 6);
    if (plan.halo.dogs) {
      for (const side of [-1, 1]) drawSunDog(f, sun.x + side * Rh, sun.y, side, strength);
      tag(f, 'Sun dogs', sun.x - Rh, sun.y, 5);
      tag(f, 'Sun dogs', sun.x + Rh, sun.y, 5);
    }
    if (plan.halo.arcs) {
      // A high sun throws a flat band of colour far below it; a low one gets a
      // gull-wing arc on top of its halo.
      if (sun.y < f.rows * 0.12) {
        drawHorizonArc(f, sun.x, sun.y, Rh, strength);
        tag(f, 'Circumhorizontal arc', f.cols / 2, sun.y + Rh * 2.3, 14);
      } else {
        drawTangentArc(f, sun.x, sun.y, Rh, strength);
        tag(f, 'Upper tangent arc', sun.x, sun.y - Rh, 8);
      }
    }
  }
  const low = sun.y > f.rows * 0.15 || f.u > 0.18;
  if (plan.pillar && low) {
    drawPillarCross(f, sun.x, sun.y, sun.r, strength);
    tag(f, 'Sun pillar', sun.x, sun.y - sun.r * 3, 6);
  }
}

function drawRing(f: Frame, cx: number, cy: number, R: number, amount: number) {
  const { cols, rows } = f;
  const steps = Math.ceil(R * Math.PI * 2.4);
  for (let s = 0; s < steps; s++) {
    const a = (s / steps) * Math.PI * 2;
    for (let w = -1; w <= 1; w++) {
      const r = R + w;
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      // Reddish on the inside edge, whiter outside, and patchy like real ice haze.
      const patch = 0.55 + 0.45 * valueNoise(a * 3, f.n * 0.1);
      dot(f.img, x, y, w < 0 ? HALO_IN : HALO_OUT, amount * patch * (w === 0 ? 1 : 0.6), 0.5);
    }
  }
}

function drawSunDog(f: Frame, x: number, y: number, side: number, amount: number) {
  const { img } = f;
  const shimmer = 0.85 + 0.15 * Math.sin(f.t * 2 + side);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d > 3) continue;
      // Red on the side facing the sun, bluish white away from it.
      const c = dx * side < 0 ? DOG_RED : dx * side > 0 ? DOG_BLUE : DOG_CORE;
      plot(img, x + dx, y + dy, d === 0 ? DOG_CORE : c, amount * shimmer * (1 - d * 0.22));
    }
  }
  // A faint tail pointing away from the sun.
  for (let k = 3; k < 12; k++) dot(img, x + side * k, y, DOG_CORE, amount * (1 - k / 12) * 0.9, 0.5);
}

function drawTangentArc(f: Frame, cx: number, cy: number, Rh: number, amount: number) {
  // A gull-wing arc touching the top of the halo, its wings curving upward.
  for (let dx = -Math.round(Rh * 1.1); dx <= Rh * 1.1; dx++) {
    const y = Math.round(cy - Rh - 0.55 * Rh * (1 - Math.cos(dx / Rh)));
    const fade = 1 - Math.abs(dx) / (Rh * 1.1);
    dot(f.img, Math.round(cx + dx), y, HALO_OUT, amount * (0.4 + 0.6 * fade), 0.55);
  }
}

function drawHorizonArc(f: Frame, cx: number, cy: number, Rh: number, amount: number) {
  // A long, nearly flat band of colour well below a high sun, red on top.
  const y0 = cy + Rh * 2.3;
  const half = f.cols * 0.42;
  for (let dx = -half; dx <= half; dx++) {
    const fade = Math.sin(((dx + half) / (half * 2)) * Math.PI);
    const lift = (dx / half) ** 2 * Rh * 0.25;
    ARC_BANDS.forEach((c, band) => {
      dot(f.img, Math.round(cx + dx), Math.round(y0 - lift + band), c, amount * fade * 0.85, 0.45);
    });
  }
}

const PILLAR: RGB = [255, 222, 170];
const PILLAR_BAR: RGB = [255, 248, 226];

// A beam of light standing up out of a low sun, and a faint horizontal bar through
// it: together they make the cross.
function drawPillarCross(f: Frame, cx: number, cy: number, R: number, amount: number) {
  const boost = Math.min(1.6, amount * 1.8);
  const up = R * 5;
  for (let k = R; k < up; k++) {
    const fade = Math.pow(1 - k / up, 0.7);
    for (let w = -1; w <= 1; w++) dot(f.img, cx + w, cy - k, PILLAR, boost * fade * (w === 0 ? 1 : 0.6), 0.7);
  }
  const down = R * 4;
  for (let k = R; k < down; k++) {
    const fade = Math.pow(1 - k / down, 0.7) * 0.85;
    for (let w = -1; w <= 1; w++) dot(f.img, cx + w, cy + k, PILLAR, boost * fade * (w === 0 ? 1 : 0.5), 0.65);
  }
  const bar = R * 3.6;
  for (let k = R; k < bar; k++) {
    const fade = Math.pow(1 - k / bar, 0.7) * 0.85;
    for (const side of [-1, 1]) {
      dot(f.img, cx + side * k, cy, PILLAR_BAR, boost * fade * 1.2, 0.85);
      dot(f.img, cx + side * k, cy - 1, PILLAR_BAR, boost * fade * 0.6, 0.55);
      dot(f.img, cx + side * k, cy + 1, PILLAR_BAR, boost * fade * 0.6, 0.55);
    }
  }
}

// Shafts of light (and shadow) fanning out from behind the clouds around the sun.
export function drawCrepuscular(f: Frame, sunX: number, sunY: number) {
  const { img, cols, rows, weather, t } = f;
  const broken = smooth(0.25, 0.4, weather.cover) * (1 - smooth(0.78, 0.9, weather.cover));
  const amount = Math.max(broken, weather.vivid) * (1 - weather.rain);
  if (amount <= 0.05) return;
  const glow = f.mix.sun[2];
  const reach = Math.hypot(cols, rows) * 1.15;
  const data = img.data;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dx = x - sunX;
      const dy = y - sunY;
      const d = Math.hypot(dx, dy);
      if (d < 6) continue;
      const falloff = 1 - d / reach;
      if (falloff <= 0) continue;
      const a = Math.atan2(dy, dx);
      const shaft = valueNoise(a * 11 + 40, t * 0.05) * 0.7 + valueNoise(a * 27, 7 + t * 0.03) * 0.3;
      const open = 1 - cloudAt(f, x, y);
      const k = (shaft - 0.5) * 2 * falloff * amount;
      if (k > 0.12 && k * open > bayer(x, y) * 0.9) blend(data, (y * cols + x) * 4, glow, 0.22);
      else if (k < -0.2 && -k > bayer(x, y)) blend(data, (y * cols + x) * 4, [0, 0, 0], 0.08);
    }
  }
  tag(f, 'Crepuscular rays', sunX + (cols / 2 - sunX) * 0.3, sunY + (rows / 2 - sunY) * 0.3, 12);
}

const VENUS_BELT: RGB = [238, 176, 198];
const EARTH_SHADOW: RGB = [72, 84, 128];

// After sunset a pink band hangs low in the sky above the blue of Earth's shadow.
export function drawBeltOfVenus(f: Frame) {
  const { img, cols, rows, u, weather } = f;
  const p = within(u, 0.39, 0.49);
  if (p < 0 || weather.cover > 0.5) return;
  const amount = envelope(p, 0.3) * (1 - weather.cover / 0.5) * 0.55;
  for (let y = Math.floor(rows * 0.58); y < rows; y++) {
    const fy = y / rows;
    const pink = Math.max(0, 1 - Math.abs(fy - 0.72) / 0.12);
    const shadow = smooth(0.82, 0.95, fy);
    for (let x = 0; x < cols; x++) {
      const side = 1 - (x / cols) * 0.4; // strongest away from the sunset side
      if (pink > 0) dot(img, x, y, VENUS_BELT, pink * amount * side, 0.35);
      if (shadow > 0) dot(img, x, y, EARTH_SHADOW, shadow * amount * side, 0.3);
    }
  }
  tag(f, 'Belt of Venus', cols * 0.3, rows * 0.72, 10);
}

// Sodium orange is the commonest street light, then white LEDs, with the odd
// green, pink or blue sign.
const PILLAR_COLORS: RGB[] = [[255, 172, 92], [255, 172, 92], [255, 194, 120], [238, 240, 255], [238, 240, 255], [168, 255, 196], [255, 120, 156], [140, 172, 255]];
const TOWN_GLOW: RGB = [255, 166, 106];

// Columns of light standing over a town's street lights on bitterly cold nights,
// when ice crystals hang in the air: brightest at the bottom, fading upward,
// shimmering as the crystals drift.
export function drawLightPillars(f: Frame) {
  const span = f.plan.lightPillars;
  if (!span) return;
  const p = within(f.u, span.from, span.to);
  if (p < 0) return;
  const { img, cols, rows, t } = f;
  const amount = envelope(p, 0.15) * (1 - f.weather.cover);
  if (amount <= 0.02) return;
  // The town's glow along the bottom edge.
  const glowRows = Math.round(rows * 0.08) + 2;
  for (let y = rows - glowRows; y < rows; y++) {
    const q = (y - (rows - glowRows)) / glowRows;
    for (let x = 0; x < cols; x++) plot(img, x, y, TOWN_GLOW, amount * q * q * 0.3 * (0.6 + 0.4 * valueNoise(x * 0.08, 3)));
  }
  const count = 5 + (span.seed % 4);
  for (let k = 0; k < count; k++) {
    const key = span.seed + k * 7;
    const x = Math.round(cols * (0.05 + (0.9 * (k + 0.2 + 0.6 * hash(key, 31))) / count));
    const color = PILLAR_COLORS[Math.floor(hash(key, 33) * PILLAR_COLORS.length)];
    const height = rows * (0.25 + 0.4 * hash(key, 32)) * (0.92 + 0.08 * Math.sin(t * 0.4 + k));
    const bright = 0.6 + 0.4 * hash(key, 34);
    const wide = hash(key, 35) < 0.4 ? 1 : 0;
    for (let y = rows - 1; y > rows - height; y--) {
      const q = (rows - y) / height;
      const sparkle = 0.65 + 0.35 * valueNoise(k * 13.7, (y + t * 5) * 0.2);
      const b = amount * bright * Math.pow(1 - q, 1.3) * sparkle;
      plot(img, x, y, color, b);
      if (wide) plot(img, x + 1, y, color, b * 0.9);
      // A soft glow either side, spreading a little toward the top.
      const spread = 2 + Math.round(q * 1.5);
      for (let g = 1; g <= spread; g++) {
        const side = b * 0.55 * Math.pow(1 - g / (spread + 1), 1.5);
        plot(img, x - g, y, color, side);
        plot(img, x + wide + g, y, color, side);
      }
    }
    // The light itself, just peeking over the horizon.
    plot(img, x, rows - 1, [255, 250, 232], amount);
    tag(f, 'Light pillars', x, rows - height / 2, 6);
  }
}

const MOON_RING: RGB = [204, 214, 240];

export function drawMoonHalo(f: Frame) {
  const { moon, plan, weather } = f;
  if (!moon || !plan.moonHalo) return;
  const amount = (0.4 + weather.haze * 0.4) * (1 - smooth(0.6, 0.85, weather.cover));
  drawRingPlain(f, moon.x, moon.y, Math.round(moon.r * 3.4), MOON_RING, amount);
  tag(f, 'Moon halo', moon.x, moon.y - moon.r * 3.4, 6);
}

function drawRingPlain(f: Frame, cx: number, cy: number, R: number, color: RGB, amount: number) {
  const steps = Math.ceil(R * Math.PI * 2.4);
  for (let s = 0; s < steps; s++) {
    const a = (s / steps) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * R);
    const y = Math.round(cy + Math.sin(a) * R);
    dot(f.img, x, y, color, amount * (0.6 + 0.4 * valueNoise(a * 3, 9)), 0.45);
  }
}

