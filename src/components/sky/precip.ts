import { cloudAt, tag, within, type Frame } from './context';
import { MORNING } from './weather';
import { dot, hash, lerp3, plot, smooth, valueNoise, type RGB } from './pixel';

// Everything that falls or flashes: rain, snow, hail, fog, lightning, heat
// lightning, red sprites above distant storms, and ball lightning.

const RAIN_DAY: RGB = [206, 218, 238];
const RAIN_NIGHT: RGB = [124, 146, 196];
const MIST: RGB = [200, 206, 216];

// Rain in three depths: a fine far layer of short streaks, a middle layer, and a
// few long bright drops up close, heavier in curtains that drift with the wind,
// splashing along the bottom. Drizzle is only the far layer: fine, slow and misty.
export function drawRain(f: Frame) {
  const amount = f.weather.rain;
  if (amount < 0.03) return;
  const { img, cols, rows, t, weather } = f;
  const night = Math.min(1, f.mix.stars * 1.5);
  const color = lerp3(RAIN_DAY, RAIN_NIGHT, night);
  const heavy = smooth(0.4, 0.75, amount);
  const gust = 1 + 0.25 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1);
  const slant = weather.windDir * (0.1 + weather.wind * 0.45) * gust;
  const curtain = (x: number) => 0.4 + 0.6 * smooth(0.3, 0.7, valueNoise(x * 0.04 - t * 0.15 * weather.windDir, 7));
  // [drops per pixel, length, speed, opacity, slant]
  const layers = [
    [0.04 - heavy * 0.022, 2, 30 + heavy * 30, 0.62, 0.7],
    [0.009 * heavy, 3 + heavy * 2, 70, 0.6, 1],
    [0.0028 * heavy, 6 + heavy * 3, 105, 0.85, 1.3],
  ];
  for (let l = 0; l < 3; l++) {
    const [dens, len, speed, alpha, sl] = layers[l];
    const count = Math.round(cols * rows * dens * amount);
    const s = slant * sl;
    const span = rows + len + 2;
    const widen = Math.abs(s) * rows;
    for (let i = 0; i < count; i++) {
      const key = i * 3 + l;
      const x0 = hash(key, 73) * (cols + widen) - (s > 0 ? widen : 0);
      if (hash(key, 74) > curtain(x0)) continue;
      const y = ((hash(key, 72) * span + t * speed * (0.85 + 0.3 * hash(key, 71))) % span) - len;
      const x = x0 + s * y;
      for (let k = 0; k < len; k++) plot(img, Math.round(x - s * k), Math.round(y - k), color, alpha * (1 - k / (len + 1)));
    }
  }
  // Drizzle hangs a faint mist low in the sky.
  const mist = (1 - heavy) * amount * 0.6;
  if (mist > 0.02) {
    for (let y = Math.floor(rows * 0.45); y < rows; y++) {
      const k = mist * smooth(rows * 0.45, rows, y);
      for (let x = 0; x < cols; x++) dot(img, x, y, lerp3(MIST, RAIN_NIGHT, night), k * (0.6 + 0.4 * valueNoise(x * 0.05 + t * 0.1, y * 0.08)), 0.3);
    }
  }
  // Splashes: a dot, then a little crown spreading out.
  const splashes = Math.round(cols * 0.2 * heavy * amount);
  for (let i = 0; i < splashes; i++) {
    const phase = t / 0.42 + hash(i, 75);
    const cycle = Math.floor(phase);
    const age = phase - cycle;
    const x = Math.round(hash((i * 31 + cycle) & 0xfffff, 76) * cols);
    if (age < 0.25) plot(img, x, rows - 1, color, 0.85);
    else if (age < 0.5) {
      plot(img, x - 1, rows - 2, color, 0.75);
      plot(img, x + 1, rows - 2, color, 0.75);
    } else if (age < 0.75) {
      plot(img, x - 2, rows - 2, color, 0.4);
      plot(img, x + 2, rows - 2, color, 0.4);
      plot(img, x - 2, rows - 1, color, 0.3);
      plot(img, x + 2, rows - 1, color, 0.3);
    }
  }
}

const FLAKE: RGB = [248, 250, 255];
const FLAKE_FAR: RGB = [210, 220, 238];
const WHITEOUT: RGB = [230, 234, 242];

// Snow in three depths: tiny dim flakes far off, brighter ones nearer, and a few
// big soft flakes close up that sway the most. A snowstorm turns it sideways:
// streaks racing on the wind through bands of blowing white.
export function drawSnow(f: Frame) {
  const amount = f.weather.snow;
  if (amount < 0.03) return;
  const storm = smooth(0.4, 0.8, f.weather.storm);
  if (storm < 1) gentleSnow(f, amount * (1 - storm * 0.7));
  if (storm > 0) blizzard(f, amount * storm);
}

function gentleSnow(f: Frame, amount: number) {
  const { img, cols, rows, t, weather } = f;
  const drift = weather.windDir * (0.1 + weather.wind * 0.35);
  const dim = 1 - Math.min(1, f.mix.stars * 1.2) * 0.35;
  // [flakes per pixel, fall speed, sway, size, colour, opacity]
  const layers: [number, number, number, number, RGB, number][] = [
    [0.014, 7, 1, 0, FLAKE_FAR, 0.65],
    [0.007, 12, 2, 0, FLAKE, 0.9],
    [0.002, 19, 3.5, 1, FLAKE, 1],
  ];
  layers.forEach(([dens, speed, sway, size, color, alpha], l) => {
    const count = Math.round(cols * rows * dens * amount);
    const span = rows + 4;
    const c = color.map((v) => v * dim) as RGB;
    for (let i = 0; i < count; i++) {
      const key = i * 3 + l;
      const y = ((hash(key, 82) * span + t * speed * (0.8 + 0.4 * hash(key, 81))) % span) - 2;
      const wave = Math.sin(t * (0.6 + hash(key, 83) * 0.8) + hash(key, 84) * 6.3) * sway;
      const x = (((hash(key, 86) * cols + wave + drift * y * (1 + l * 0.3)) % cols) + cols) % cols;
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (!size) {
        plot(img, xi, yi, c, alpha);
      } else if (hash(key, 87) < 0.5) {
        plot(img, xi, yi, c, alpha);
        plot(img, xi + 1, yi, c, alpha * 0.8);
        plot(img, xi, yi + 1, c, alpha * 0.8);
        plot(img, xi + 1, yi + 1, c, alpha * 0.6);
      } else {
        plot(img, xi, yi, c, alpha);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) plot(img, xi + dx, yi + dy, c, alpha * 0.55);
      }
    }
  });
}

function blizzard(f: Frame, amount: number) {
  const { img, cols, rows, t, weather } = f;
  const dir = weather.windDir >= 0 ? 1 : -1;
  const dim = 1 - Math.min(1, f.mix.stars * 1.2) * 0.4;
  const white = WHITEOUT.map((v) => v * dim) as RGB;
  // Bands of blowing snow racing across.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const band = smooth(0.35, 0.85, valueNoise((x - t * 45 * dir) * 0.03, y * 0.06 + t * 0.15));
      dot(img, x, y, white, band * amount * 0.65, 0.5);
    }
  }
  // Flakes driven almost sideways, drawn as short streaks.
  const count = Math.round(cols * rows * 0.022 * amount);
  for (let i = 0; i < count; i++) {
    const vx = (60 + hash(i, 91) * 50) * dir;
    const vy = 22 + hash(i, 92) * 22;
    const x0 = (((hash(i, 93) * cols + t * vx) % cols) + cols) % cols;
    const y0 = (hash(i, 94) * rows + t * vy) % rows;
    // Gusts: thicker in some stretches than others.
    if (hash(i, 95) > 0.35 + 0.65 * valueNoise((x0 - t * 40 * dir) * 0.025, 3)) continue;
    const len = 2 + Math.floor(hash(i, 96) * 3);
    const n = Math.hypot(vx, vy);
    for (let k = 0; k < len; k++) plot(img, Math.round(x0 - (vx / n) * k), Math.round(y0 - (vy / n) * k), FLAKE.map((v) => v * dim) as RGB, 0.9 * (1 - k / (len + 1)));
  }
  tag(f, 'Snowstorm', cols / 2, rows / 2, cols / 2);
}

const HAIL: RGB = [242, 248, 255];
const HAIL_SHADE: RGB = [170, 192, 224];

// Hail: white stones of a few sizes falling fast and nearly straight, bouncing
// off the bottom edge.
export function drawHail(f: Frame) {
  const amount = f.weather.hail;
  if (amount < 0.05) return;
  const { img, cols, rows, t, weather } = f;
  const count = Math.round(cols * rows * 0.0035 * amount);
  const fall = (rows + 6) / 140;
  const bounce = 0.32;
  for (let i = 0; i < count; i++) {
    const size = hash(i, 97) < 0.15 ? 2 : hash(i, 97) < 0.55 ? 1 : 0;
    const period = fall * (0.85 + 0.3 * hash(i, 98)) + bounce;
    const phase = (hash(i, 99) * period + t) % period;
    const cycle = Math.floor((hash(i, 99) * period + t) / period);
    let x = hash((i * 17 + cycle) & 0xfffff, 100) * cols;
    let y: number;
    const drop = period - bounce;
    if (phase < drop) {
      y = (phase / drop) * (rows + 4) - 4;
      x += weather.windDir * y * 0.15;
    } else {
      // Bouncing: a little hop to one side, then gone.
      const b = (phase - drop) / bounce;
      x += weather.windDir * rows * 0.15 + (hash(i, 101) < 0.5 ? -1 : 1) * b * 4;
      y = rows - 2 - Math.sin(b * Math.PI) * (2 + size * 1.5);
    }
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (size === 0) {
      plot(img, xi, yi, HAIL, 0.95);
    } else if (size === 1) {
      plot(img, xi, yi, HAIL, 1);
      plot(img, xi + 1, yi, HAIL, 0.9);
      plot(img, xi, yi + 1, HAIL, 0.9);
      plot(img, xi + 1, yi + 1, HAIL_SHADE, 0.9);
    } else {
      for (const [dx, dy] of [[0, -1], [-1, 0], [0, 0], [1, 0], [0, 1]]) plot(img, xi + dx, yi + dy, HAIL, 1);
      plot(img, xi + 1, yi + 1, HAIL_SHADE, 0.9);
      plot(img, xi - 1, yi - 1, HAIL, 0.4);
    }
  }
  tag(f, 'Hail', cols / 2, rows * 0.8, cols / 3);
}

const FOG_DAY: RGB = [218, 222, 228];
const FOG_DAWN: RGB = [240, 220, 208];
const FOG_NIGHT: RGB = [72, 80, 98];

// A soft band of fog low in the sky, thickest at dawn, lifting through the morning.
export function drawFog(f: Frame) {
  const amount = f.weather.fog;
  if (amount < 0.03) return;
  const { img, cols, rows, t, u } = f;
  const dawn = f.weather.stretch === MORNING && u < 0.86 ? 1 - (u - 0.73) / 0.13 : 0;
  const color = lerp3(lerp3(FOG_DAY, FOG_DAWN, Math.max(0, dawn) * 0.8), FOG_NIGHT, Math.min(1, f.mix.stars * 1.4));
  const top = rows * (1 - 0.6 * amount);
  for (let y = Math.max(0, Math.floor(top)); y < rows; y++) {
    const k = Math.pow((y - top) / (rows - top), 0.75) * amount;
    for (let x = 0; x < cols; x++) {
      const wisp = 0.55 + 0.45 * valueNoise(x * 0.03 + t * 0.04, y * 0.07);
      dot(img, x, y, color, k * wisp * 1.15, 0.85);
    }
  }
}

const BOLT: RGB = [255, 255, 255];
const BOLT_GLOW: RGB = [190, 178, 255];
const CLOUD_LIT: RGB = [222, 214, 246];
const SLOT = 1.8;

type Pt = [number, number];

// A jagged path from a to b: split every segment at a nudged midpoint, over and over.
function jagged(key: number, ax: number, ay: number, bx: number, by: number, rough: number, levels: number): Pt[] {
  let pts: Pt[] = [[ax, ay], [bx, by]];
  for (let l = 0; l < levels; l++) {
    const next: Pt[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      const off = (hash((key + l * 977 + i * 31) & 0xfffff, 601) - 0.5) * len * rough;
      next.push([(x0 + x1) / 2 - ((y1 - y0) / len) * off, (y0 + y1) / 2 + ((x1 - x0) / len) * off], pts[i + 1]);
    }
    pts = next;
  }
  return pts;
}

// Draw a channel: a white core (two pixels wide where it's thick) in a violet glow.
function channel(f: Frame, pts: Pt[], amount: number, thick: (q: number) => boolean) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
    const wide = thick(i / (pts.length - 1));
    for (let s = 0; s <= steps; s++) {
      const x = Math.round(x0 + ((x1 - x0) * s) / steps);
      const y = Math.round(y0 + ((y1 - y0) * s) / steps);
      plot(f.img, x - 1, y, BOLT_GLOW, amount * 0.4);
      plot(f.img, x + (wide ? 2 : 1), y, BOLT_GLOW, amount * 0.4);
      plot(f.img, x, y, BOLT, amount);
      if (wide) plot(f.img, x + 1, y, BOLT, amount * 0.9);
    }
  }
}

// Light the cloud deck from inside around (cx, cy); cloud banks light up most.
function cloudGlow(f: Frame, cx: number, cy: number, r: number, amount: number) {
  const { img, cols, rows } = f;
  const data = img.data;
  for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(rows, cy + r); y++) {
    for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(cols, cx + r); x++) {
      const d = Math.hypot(x - cx, (y - cy) * 1.3) / r;
      if (d >= 1) continue;
      const k = amount * 0.7 * Math.pow(1 - d, 1.4) * (0.35 + 0.65 * cloudAt(f, x, y));
      const i = (y * cols + x) * 4;
      data[i] += (CLOUD_LIT[0] - data[i]) * k;
      data[i + 1] += (CLOUD_LIT[1] - data[i + 1]) * k;
      data[i + 2] += (CLOUD_LIT[2] - data[i + 2]) * k;
    }
  }
}

// Storm lightning on the shared clock, so everyone sees each strike at once. Most
// flashes stay inside the cloud and light it up from within; some fork down to
// the ground with branches and flicker through a few return strokes; now and then
// one crawls sideways along the cloud base. In snow it's mostly diffuse flashes.
export function drawLightning(f: Frame) {
  const activity = f.weather.storm;
  if (activity < 0.2) return;
  const { cols, rows, sec } = f;
  const snowy = f.weather.snow > 0.3;
  const now = Math.floor(sec / SLOT);
  for (let slot = now - 1; slot <= now; slot++) {
    const key = slot & 0xfffff;
    const kind = hash(key, 601);
    if (kind > 0.85 * activity) continue;
    const age = sec - (slot * SLOT + hash(key, 602) * 0.9);
    if (age < 0 || age > 0.6) continue;
    // Up to three return strokes down the same channel, each fading fast.
    const strokes = 1 + Math.floor(hash(key, 603) * 3);
    let on = 0;
    for (let k = 0; k < strokes; k++) {
      const a = age - k * (0.08 + 0.06 * hash(key, 604 + k));
      if (a >= 0 && a < 0.05) on = 1;
      else if (a >= 0.05 && a < 0.22) on = Math.max(on, 0.55 * (1 - (a - 0.05) / 0.17));
    }
    if (on <= 0.02) continue;
    if (kind > 0.45 * activity || (snowy && hash(key, 605) < 0.8)) {
      cloudGlow(f, cols * (0.15 + 0.7 * hash(key, 606)), rows * (0.06 + 0.3 * hash(key, 607)), cols * (0.28 + 0.22 * hash(key, 608)), on);
      f.flash = Math.max(f.flash, on * 0.35);
      if (snowy) tag(f, 'Thundersnow', cols / 2, rows / 3, cols / 3);
      continue;
    }
    f.flash = Math.max(f.flash, on * 0.9);
    const x0 = cols * (0.12 + 0.76 * hash(key, 610));
    const y0 = rows * (0.03 + 0.08 * hash(key, 611));
    if (hash(key, 609) < 0.15) {
      // A crawler, branching sideways along the cloud base.
      const side = hash(key, 612) < 0.5 ? -1 : 1;
      const main = jagged(key, x0 - side * cols * 0.3, y0 + rows * 0.04, x0 + side * cols * 0.35, y0 + rows * 0.1, 0.35, 6);
      channel(f, main, on * 0.85, () => false);
      for (let b = 0; b < 4; b++) {
        const [bx, by] = main[Math.floor((0.15 + 0.7 * hash(key, 620 + b)) * (main.length - 1))];
        channel(f, jagged(key + b * 101, bx, by, bx + side * cols * 0.12, by + rows * (0.05 + 0.08 * hash(key, 640 + b)), 0.5, 4), on * 0.5, () => false);
      }
      cloudGlow(f, x0, y0 + rows * 0.06, cols * 0.4, on * 0.6);
      tag(f, 'Lightning', x0, y0 + rows * 0.08, cols / 3);
      continue;
    }
    // Cloud to ground.
    const x1 = x0 + (hash(key, 612) - 0.5) * cols * 0.35;
    const main = jagged(key, x0, y0, x1, rows + 1, 0.42, 6);
    cloudGlow(f, x0, y0 + rows * 0.04, cols * 0.3, on * 0.7);
    channel(f, main, on, (q) => on > 0.8 && q < 0.6);
    // Branches show on the first stroke only.
    if (age < 0.15) {
      const branches = 2 + Math.floor(hash(key, 613) * 4);
      for (let b = 0; b < branches; b++) {
        const [bx, by] = main[Math.floor((0.08 + 0.55 * hash(key, 620 + b)) * (main.length - 1))];
        const side = hash(key, 630 + b) < 0.5 ? -1 : 1;
        const len = rows * (0.12 + 0.2 * hash(key, 640 + b));
        const branch = jagged(key + b * 101, bx, by, bx + side * len * (0.5 + 0.4 * hash(key, 650 + b)), by + len * 0.8, 0.5, 4);
        channel(f, branch, on * 0.6, () => false);
        if (hash(key, 660 + b) < 0.5) {
          const [tx, ty] = branch[Math.floor(branch.length / 2)];
          channel(f, jagged(key + b * 211, tx, ty, tx + side * len * 0.3, ty + len * 0.35, 0.5, 3), on * 0.4, () => false);
        }
      }
    }
    // Where it strikes, a bright spot on the horizon.
    for (let dx = -2; dx <= 2; dx++) plot(f.img, Math.round(x1) + dx, rows - 1, BOLT, on * (1 - Math.abs(dx) / 3));
    tag(f, 'Lightning', x1, rows / 2, 10);
  }
}

const HEAT_WARM: RGB = [255, 214, 190];

// Silent flickers along the bottom of the sky from a storm too far away to see.
export function drawHeatLightning(f: Frame) {
  const span = f.plan.heatLightning;
  if (!span || within(f.u, span.from, span.to) < 0) return;
  const { img, cols, rows, sec } = f;
  const now = Math.floor(sec / 1.3);
  for (let slot = now - 1; slot <= now; slot++) {
    const key = (slot + span.seed) & 0xfffff;
    if (hash(key, 621) > 0.55) continue;
    const age = sec - (slot * 1.3 + hash(key, 622) * 0.8);
    if (age < 0 || age > 0.3) continue;
    const k = (age < 0.06 ? 1 : 1 - (age - 0.06) / 0.24) * 0.45;
    const cx = cols * (0.1 + hash(key, 623) * 0.8);
    const w = cols * (0.15 + hash(key, 624) * 0.2);
    for (let y = Math.floor(rows * 0.7); y < rows; y++) {
      const fy = (y - rows * 0.7) / (rows * 0.3);
      for (let x = Math.max(0, Math.floor(cx - w)); x < Math.min(cols, cx + w); x++) {
        const fx = 1 - Math.abs(x - cx) / w;
        dot(img, x, y, HEAT_WARM, k * fx * fy * 1.6, 0.5);
      }
    }
    tag(f, 'Heat lightning', cx, rows * 0.88, w);
  }
}

const STORM_GLOW: RGB = [214, 204, 255];

// The storm under the sprites is out of sight below the horizon; its lightning
// lights up the bottom of the sky around x.
function horizonFlash(f: Frame, flash: number, x: number) {
  if (flash <= 0.02) return;
  const { img, cols, rows } = f;
  const rx = cols * 0.22;
  const ry = rows * 0.2;
  for (let y = Math.floor(rows - ry); y < rows; y++) {
    for (let dx = -Math.ceil(rx); dx <= rx; dx++) {
      const d = Math.hypot(dx / rx, (rows - y) / ry);
      if (d < 1) dot(img, Math.round(x + dx), y, STORM_GLOW, flash * (1 - d) * 1.4, 0.5);
    }
  }
}

// Sprite colours, picked per burst: classic red, a hotter orange, or magenta.
type SpriteColors = { core: RGB; body: RGB; tendril: RGB; tip: RGB; haze: RGB };
const SPRITE_COLORS: SpriteColors[] = [
  { core: [255, 172, 150], body: [240, 50, 80], tendril: [164, 56, 196], tip: [86, 92, 236], haze: [112, 24, 54] },
  { core: [255, 208, 160], body: [255, 94, 64], tendril: [204, 62, 150], tip: [112, 84, 224], haze: [122, 38, 40] },
  { core: [255, 178, 224], body: [236, 52, 142], tendril: [150, 62, 214], tip: [80, 112, 255], haze: [104, 24, 78] },
];
const JET_CORE: RGB = [220, 236, 255];
const JET_BLUE: RGB = [100, 150, 255];
const SPRITE_SLOT = 2.2;
// The form each burst takes, in turn, so one burst never looks like the last.
const DISPLAYS = ['jellyfish', 'cluster', 'columns', 'angel', 'dance'] as const;
const DANCE_STEP = 0.08;

type SpriteKind = 'column' | 'carrot' | 'jellyfish' | 'angel';

// Colour down a sprite: q is 0 at its top and 1 at the tips of its tendrils.
function spriteShade(c: SpriteColors, q: number): RGB {
  if (q < 0.4) return c.body;
  if (q < 0.72) return lerp3(c.body, c.tendril, (q - 0.4) / 0.32);
  return lerp3(c.tendril, c.tip, (q - 0.72) / 0.28);
}

// How bright a sprite is a seconds after it fires: a blink on, a moment at full, then fading.
const flare = (a: number, fade: number) => (a < 0 ? 0 : a < 0.025 ? a / 0.025 : a < 0.08 ? 1 : Math.max(0, 1 - (a - 0.08) / fade));

// A soft red glow around the brightest part of a sprite.
function spriteHaze(img: ImageData, x: number, y: number, rx: number, ry: number, c: RGB, k: number) {
  for (let dy = -Math.ceil(ry); dy <= ry; dy++) {
    for (let dx = -Math.ceil(rx); dx <= rx; dx++) {
      const d = Math.hypot(dx / rx, dy / ry);
      if (d < 1) dot(img, Math.round(x + dx), Math.round(y + dy), c, k * (1 - d) * 1.2, 0.6);
    }
  }
}

// A streak that wanders and forks as it goes, for angel sprites and gigantic jets.
// angle is measured from straight down.
function branch(img: ImageData, x: number, y: number, angle: number, len: number, depth: number, k: number, key: number, c: SpriteColors) {
  let a = angle;
  for (let d = 0; d < len; d++) {
    a += (hash(key & 0xfffff, d) - 0.5) * 0.25;
    x += Math.sin(a);
    y += Math.cos(a);
    const q = d / len;
    plot(img, Math.round(x), Math.round(y), spriteShade(c, 0.2 + q * (Math.cos(a) > 0 ? 0.8 : 0.3)), k * (1 - q * 0.85));
    if (depth > 0 && d > len * 0.3 && hash(key & 0xfffff, 500 + d) < 0.06) {
      branch(img, x, y, a + (hash(key & 0xfffff, 600 + d) < 0.5 ? -0.5 : 0.5), (len - d) * 0.6, depth - 1, k * 0.7, key * 3 + d, c);
    }
  }
}

// One sprite with its top at (x, top), h tall and w wide.
function sprite(img: ImageData, kind: SpriteKind, x: number, top: number, h: number, w: number, k: number, key: number, c: SpriteColors) {
  if (k <= 0.02) return;
  key &= 0xfffff;
  switch (kind) {
    case 'column': {
      // An upright streak, brightest a third of the way down, beaded here and there.
      const lean = (hash(key, 1) - 0.5) * 0.12;
      const knotAt = 0.22 + 0.15 * hash(key, 2);
      spriteHaze(img, x, top + h * knotAt, 3 + w, h * 0.22, c.haze, k * 0.8);
      for (let y = 0; y < h; y++) {
        const q = y / h;
        const knot = Math.exp(-(((q - knotAt) / 0.07) ** 2));
        const b = (q < knotAt ? 0.45 + 0.55 * (q / knotAt) : 1 - ((q - knotAt) / (1 - knotAt)) * 0.85) * (valueNoise(key * 0.37, y * 0.4) > 0.72 ? 1.2 : 1);
        const xx = Math.round(x + lean * y);
        const color = lerp3(q < knotAt ? c.body : spriteShade(c, q), c.core, knot);
        const yy = Math.round(top + y);
        plot(img, xx, yy, color, k * b);
        plot(img, xx + 1, yy, color, k * b * 0.75);
        plot(img, xx - 1, yy, c.body, k * b * 0.3);
        plot(img, xx + 2, yy, c.body, k * b * 0.3);
      }
      return;
    }
    case 'carrot': {
      // A bright head, streamers reaching up, tendrils fanning down like roots.
      const headY = top + h * 0.28;
      const hw = Math.max(1.5, w * 0.5);
      spriteHaze(img, x, headY, hw * 2 + 3, h * 0.18 + 2, c.haze, k);
      for (let dy = -Math.ceil(hw * 1.6); dy <= hw * 1.6; dy++) {
        for (let dx = -Math.ceil(hw); dx <= hw; dx++) {
          const d = Math.hypot(dx / hw, dy / (hw * 1.6));
          if (d <= 1) plot(img, Math.round(x + dx), Math.round(headY + dy), lerp3(c.core, c.body, d), k * (1.1 - d * 0.4));
        }
      }
      const ups = 3 + Math.floor(hash(key, 3) * 3);
      for (let i = 0; i < ups; i++) {
        const off = i / (ups - 1) - 0.5;
        const len = h * (0.15 + 0.15 * hash(key, 10 + i));
        for (let d = 0; d < len; d++) plot(img, Math.round(x + off * (hw + d * 0.35)), Math.round(headY - hw * 1.4 - d), c.body, k * (1 - d / len) * 0.75);
      }
      const roots = 4 + Math.floor(hash(key, 4) * 4);
      for (let i = 0; i < roots; i++) {
        const off = i / (roots - 1) - 0.5;
        const len = h * (0.5 + 0.22 * hash(key, 20 + i));
        for (let d = 0; d < len; d++) {
          const q = d / len;
          plot(img, Math.round(x + off * (hw * 1.4 + d * 0.32) + Math.sin(d * 0.45 + i) * 0.6), Math.round(headY + hw + d), spriteShade(c, 0.3 + q * 0.7), k * (1 - q) * 0.95);
        }
      }
      return;
    }
    case 'jellyfish': {
      // A wide glowing bell, brightest along its rim, with a dense fringe of tendrils.
      const bell = Math.max(3, w * 0.28);
      const bellY = top + bell;
      spriteHaze(img, x, top + bell * 0.3, w * 0.85 + 3, bell * 1.4 + 2, c.haze, k);
      for (let dy = -Math.ceil(bell); dy <= 1; dy++) {
        for (let dx = -Math.ceil(w / 2); dx <= w / 2; dx++) {
          const d = Math.hypot(dx / (w / 2), dy / bell);
          if (d > 1) continue;
          const rim = Math.max(0, 1 - Math.abs(d - 0.75) * 1.6);
          plot(img, Math.round(x + dx), Math.round(bellY + dy), lerp3(c.body, c.core, rim), k * (0.75 + 0.35 * rim));
        }
      }
      const strands = Math.max(6, Math.round(w / 1.6));
      for (let i = 0; i < strands; i++) {
        const off = i / (strands - 1) - 0.5;
        const len = h * (0.45 + 0.5 * hash(key, 30 + i)) - bell;
        for (let d = 0; d < len; d++) {
          const q = d / len;
          plot(img, Math.round(x + off * w * 0.92 + off * d * 0.12 + Math.sin(d * 0.35 + i * 1.3) * 0.7), Math.round(bellY + 1 + d), spriteShade(c, 0.25 + q * 0.75), k * (1 - q) * 0.9);
        }
      }
      return;
    }
    case 'angel': {
      // A bright core with branches spreading down and out like wings, streamers above.
      const coreY = top + h * 0.3;
      spriteHaze(img, x, coreY, w * 0.7 + 3, h * 0.22 + 2, c.haze, k);
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const d = Math.hypot(dx / 2.2, dy / 3.2);
          if (d <= 1) plot(img, Math.round(x + dx), Math.round(coreY + dy), lerp3(c.core, c.body, d), k);
        }
      }
      const arms = 5 + Math.floor(hash(key, 5) * 4);
      for (let i = 0; i < arms; i++) {
        const side = i % 2 ? 1 : -1;
        branch(img, x, coreY + 2, side * (0.25 + 0.95 * hash(key, 40 + i)), h * (0.35 + 0.35 * hash(key, 50 + i)), 2, k * 0.9, key * 7 + i, c);
      }
      for (let i = 0; i < 4; i++) branch(img, x, coreY - 3, Math.PI + (hash(key, 60 + i) - 0.5) * 1.1, h * (0.15 + 0.12 * hash(key, 70 + i)), 1, k * 0.7, key * 11 + i, c);
      return;
    }
  }
}

type SpriteEvent = { key: number; slot: number; age: number };

// The sprite burst on screen now, if any (the shared clock fires one every few seconds).
function spriteEvent(sec: number, seed: number): SpriteEvent | null {
  const now = Math.floor(sec / SPRITE_SLOT);
  let event: SpriteEvent | null = null;
  for (let slot = now - 1; slot <= now; slot++) {
    const key = (slot + seed) & 0xfffff;
    if (hash(key, 631) > 0.55) continue;
    const age = sec - (slot * SPRITE_SLOT + hash(key, 632) * 1.4);
    if (age >= -0.1 && age <= 0.9) event = { key, slot, age };
  }
  return event;
}

// Red sprites: split-second bursts of red light high above a storm far away below
// the horizon. Each burst takes a different form: one giant jellyfish, a mixed
// cluster, a row of thin columns, angels with branching wings, or a run of
// sprites dancing across the sky one after another. Now and then a blue jet or a
// gigantic jet climbs up from the storm, or a faint ring spreads overhead.
export function drawSprites(f: Frame) {
  const span = f.plan.sprites;
  if (!span || within(f.u, span.from, span.to) < 0) return;
  const { img, cols, rows, sec } = f;
  const event = spriteEvent(sec, span.seed);
  const key = event?.key ?? 0;
  const age = event?.age ?? -1;
  const display = DISPLAYS[(((event?.slot ?? 0) + span.seed) % DISPLAYS.length + DISPLAYS.length) % DISPLAYS.length];
  const cx = cols * (0.35 + 0.3 * hash(key, 634));
  const top = rows * (0.03 + hash(key, 636) * 0.09);
  const H = rows * (0.5 + hash(key, 637) * 0.2);
  const c = SPRITE_COLORS[Math.floor(hash(key, 645) * SPRITE_COLORS.length)];
  // Dancing sprites sweep across: where each one fires.
  const n = 4 + Math.floor(hash(key, 638) * 4);
  const dir = hash(key, 639) < 0.5 ? -1 : 1;
  const reach = cols * (0.45 + 0.2 * hash(key, 640));
  const danceX = (e: number) => cx + dir * (e / (n - 1) - 0.5) * reach;
  // The storm flickers now and then, and flashes hard under each sprite as it fires.
  const tick = Math.floor(sec * 9) & 0xfffff;
  let flash = hash(tick, span.seed) < 0.05 ? 0.45 : 0;
  let flashX = cols * (0.35 + 0.3 * hash(tick, span.seed + 1));
  if (event) {
    const steps = display === 'dance' ? n : 1;
    for (let e = 0; e < steps; e++) {
      const k = 1 - Math.abs(age - e * DANCE_STEP + 0.03) / 0.08;
      if (k > flash) {
        flash = k;
        flashX = display === 'dance' ? danceX(e) : cx;
      }
    }
  }
  horizonFlash(f, flash, flashX);
  if (!event || age < 0) return;
  const S = f.scale;
  const smallW = (e: number) => (4.5 + 3 * hash(key, 670 + e)) * S + 2;
  const pick = (r: number): SpriteKind => (r < 0.45 ? 'carrot' : r < 0.75 ? 'column' : r < 0.9 ? 'jellyfish' : 'angel');
  const widthOf = (kind: SpriteKind, e: number, scale = 1) => (kind === 'jellyfish' ? cols * 0.12 * scale : kind === 'angel' ? cols * 0.15 * scale : smallW(e));
  switch (display) {
    case 'jellyfish': {
      const w = cols * (0.18 + 0.1 * hash(key, 641));
      sprite(img, 'jellyfish', cx, top, H, w, flare(age, 0.3), key, c);
      // A couple of smaller carrots beside it, a beat later.
      const extra = Math.floor(hash(key, 642) * 3);
      for (let e = 0; e < extra; e++) {
        sprite(img, 'carrot', cx + (e % 2 ? 1 : -1) * (w * 0.75 + 4), top + rows * 0.06, H * 0.65, smallW(e), flare(age - 0.03 - e * 0.02, 0.25), key + 100 + e, c);
      }
      break;
    }
    case 'cluster': {
      const count = 3 + Math.floor(hash(key, 641) * 4);
      const spacing = cols * (0.07 + 0.04 * hash(key, 642));
      for (let e = 0; e < count; e++) {
        const kind = pick(hash(key, 650 + e));
        const x = cx + (e - (count - 1) / 2) * spacing + (hash(key, 660 + e) - 0.5) * spacing * 0.5;
        const k = flare(age - hash(key, 700 + e) * 0.06, 0.26) * (0.65 + 0.35 * hash(key, 710 + e));
        sprite(img, kind, x, top + hash(key, 680 + e) * rows * 0.08, H * (0.55 + 0.45 * hash(key, 690 + e)), widthOf(kind, e), k, key + e * 13, c);
      }
      break;
    }
    case 'columns': {
      const count = 5 + Math.floor(hash(key, 641) * 5);
      const width = cols * (0.3 + 0.2 * hash(key, 642));
      for (let e = 0; e < count; e++) {
        const x = cx - width / 2 + (width * (e + 0.5 * hash(key, 720 + e))) / count;
        sprite(img, 'column', x, top + hash(key, 730 + e) * rows * 0.1, H * (0.6 + 0.4 * hash(key, 740 + e)), 2, flare(age - hash(key, 750 + e) * 0.08, 0.22), key + e * 17, c);
      }
      break;
    }
    case 'angel': {
      const count = 1 + Math.floor(hash(key, 641) * 2);
      for (let e = 0; e < count; e++) {
        sprite(img, 'angel', cx + (e - (count - 1) / 2) * cols * 0.22, top + e * rows * 0.04, H * (0.8 + 0.2 * hash(key, 760 + e)), cols * (0.14 + 0.08 * hash(key, 770 + e)), flare(age - e * 0.04, 0.3), key + e * 19, c);
      }
      break;
    }
    case 'dance': {
      for (let e = 0; e < n; e++) {
        const kind = pick(hash(key, 780 + e));
        sprite(img, kind, danceX(e), top + hash(key, 800 + e) * rows * 0.1, H * (0.5 + 0.4 * hash(key, 810 + e)), widthOf(kind, e, 0.9), flare(age - e * DANCE_STEP, 0.16), key + e * 23, c);
      }
      break;
    }
  }
  // A faint ring spreading out overhead.
  if (hash(key, 692) < 0.3 && age < 0.14) {
    const R = cols * (0.15 + age * 4);
    for (let a = 0; a < Math.PI * 2; a += 0.015) {
      dot(img, Math.round(cx + Math.cos(a) * R), Math.round(rows * 0.06 + Math.sin(a) * R * 0.18), [255, 120, 90], (1 - age / 0.14) * 0.9, 0.5);
    }
  }
  if (hash(key, 695) < 0.15) {
    // A gigantic jet: blue up from the storm below the horizon, reddening as it climbs,
    // fraying into branches at the top.
    const jx = cx + (hash(key, 696) - 0.5) * cols * 0.2;
    const kj = flare(age - 0.02, 0.4);
    const len = rows - (top + H * 0.15);
    for (let d = 0; d < len; d++) {
      const q = d / len;
      const w = 0.5 + q * 2.5;
      const color = q < 0.5 ? lerp3(JET_CORE, JET_BLUE, q * 2) : lerp3(JET_BLUE, c.body, (q - 0.5) * 2);
      for (let dx = -Math.ceil(w); dx <= w; dx++) plot(img, Math.round(jx + dx + Math.sin(d * 0.2) * 0.8), Math.round(rows - d), color, kj * (1 - Math.abs(dx) / (w + 1)) * (1 - q * 0.4));
    }
    for (let i = 0; i < 5; i++) branch(img, jx, rows - len, Math.PI + (hash(key, 697 + i) - 0.5) * 1.6, rows * 0.1, 1, kj * 0.7, key * 5 + i, c);
    tag(f, 'Gigantic jet', jx, rows - len / 2, 10);
  } else if (hash(key, 693) < 0.35 && age < 0.3) {
    // A blue jet climbing a little way up from the storm below the horizon.
    const jx = cx + (hash(key, 694) - 0.5) * cols * 0.25;
    const len = rows * 0.2;
    const kj = age < 0.05 ? age / 0.05 : 1 - (age - 0.05) / 0.25;
    for (let d = 0; d < len; d++) {
      const w = 0.4 + d * 0.1;
      for (let dx = -Math.ceil(w); dx <= w; dx++) {
        plot(img, Math.round(jx + dx), Math.round(rows - d), Math.abs(dx) < 1 ? JET_CORE : JET_BLUE, kj * (1 - d / len) * (1 - Math.abs(dx) / (w + 1)));
      }
    }
  }
  tag(f, 'Red sprites', cx, top + H * 0.4, cols * 0.2);
}

// Gold, blue-white or violet: [core, ring, glow].
const ORBS: [RGB, RGB, RGB][] = [
  [[255, 250, 232], [255, 198, 100], [255, 146, 64]],
  [[240, 248, 255], [156, 204, 255], [96, 136, 255]],
  [[255, 240, 252], [255, 156, 214], [204, 96, 226]],
];

// Ball lightning: a glowing orb that wanders through a storm for a few seconds,
// crackling, lighting up the rain around it, then pops in a burst of sparks.
export function drawBallLightning(f: Frame) {
  const span = f.plan.ballLightning;
  if (!span) return;
  const p = within(f.u, span.from, span.to);
  if (p < 0) return;
  const { img, cols, rows, sec } = f;
  const s = span.seed % 1000;
  const [core, ring, haze] = ORBS[span.seed % 3];
  const at = (tt: number): [number, number] => [
    cols * (0.25 + 0.5 * valueNoise(tt * 0.22, s)),
    rows * (0.35 + 0.3 * valueNoise(tt * 0.17, s + 9)),
  ];
  const life = 0.9;
  if (p < life) {
    const [x, y] = at(sec);
    const k = Math.min(1, p / 0.05) * (0.85 + 0.15 * Math.sin(sec * 31) * Math.sin(sec * 7));
    // It lights up everything nearby.
    const L = 15 * f.scale + 6;
    for (let dy = -Math.ceil(L); dy <= L; dy++) {
      for (let dx = -Math.ceil(L); dx <= L; dx++) {
        const d = Math.hypot(dx, dy) / L;
        if (d < 1) plot(img, Math.round(x + dx), Math.round(y + dy), haze, k * (1 - d) * (1 - d) * 0.32);
      }
    }
    // A short fading trail.
    for (let i = 1; i <= 6; i++) {
      const [tx, ty] = at(sec - i * 0.06);
      plot(img, Math.round(tx), Math.round(ty), ring, k * (1 - i / 7) * 0.7);
    }
    const R = 3 * f.scale + 1.8;
    for (let dy = -Math.ceil(R + 3); dy <= R + 3; dy++) {
      for (let dx = -Math.ceil(R + 3); dx <= R + 3; dx++) {
        const d = Math.hypot(dx, dy);
        const px = Math.round(x + dx);
        const py = Math.round(y + dy);
        if (d <= R * 0.6) plot(img, px, py, core, k);
        else if (d <= R) plot(img, px, py, ring, k);
        else if (d < R + 3) dot(img, px, py, haze, k * (1 - (d - R) / 3) * 1.2, 0.85);
      }
    }
    // Little filaments crackle off its surface, a new set every few frames.
    const frame = Math.floor(sec * 12) & 0xfffff;
    for (let i = 0; i < 3; i++) {
      if (hash(frame, s + i) > 0.6) continue;
      let a = hash(frame, s + i + 9) * Math.PI * 2;
      let px = x + Math.cos(a) * R;
      let py = y + Math.sin(a) * R;
      const len = 3 + Math.floor(hash(frame, s + i + 19) * 4);
      for (let j = 0; j < len; j++) {
        a += (hash(frame + j, s + i + 29) - 0.5) * 1.4;
        px += Math.cos(a);
        py += Math.sin(a);
        plot(img, Math.round(px), Math.round(py), j < 2 ? core : ring, k * (1 - j / len));
      }
    }
  } else {
    // The pop: sparks flying out from where it was and a quick flash.
    const q = (p - life) / (1 - life);
    const [x, y] = at(sec - (p - life) * (span.to - span.from) * f.dayLength);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + hash(i, s);
      const r = 2 + q * (12 + hash(i, s + 1) * 10) * f.scale;
      plot(img, Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.9), i % 2 ? core : ring, 1 - q);
    }
    if (q < 0.3) f.flash = Math.max(f.flash, (1 - q / 0.3) * 0.3);
  }
  tag(f, 'Ball lightning', cols / 2, rows / 2, cols / 3);
}
