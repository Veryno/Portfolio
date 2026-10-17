import { envelope, tag, within, type Frame } from './context';
import { clamp, dot, hash, lerp3, plot, smooth, valueNoise, type RGB } from './pixel';
import type { SkyWeather } from './weather';

// The dot clouds in front of the sky, and the rare cloud formations drawn into it.

// ---------- Front dot clouds ----------

type CloudKind = 'cumulus' | 'stratus' | 'scud';

export type DotCloud = {
  kind: CloudKind;
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  bobAmp: number;
  bobRate: number;
  bobPhase: number;
  rank: number; // clouds show in rank order as the cover rises
  seed: number; // for each cloud's own ragged edges
  // Round puffs [centre x offset, radius]; their union above a flat base is the cloud.
  lobes: [number, number][];
};

// One puffy cloud, number i, with its flat base at row y. growth sets how big the
// largest get and bob how far they drift up and down.
function cumulus(i: number, seed: number, cols: number, y: number, growth: number, bob: number, speedScale: number): DotCloud {
  // Mix of small puffs, mid-size cumulus and a few big banks; squaring the
  // random value keeps small clouds common and large ones rare.
  const size = hash(i, seed + 3);
  const scale = 0.45 + size * size * growth;
  const lobeCount = 3 + Math.floor(hash(i, seed + 6) * (scale > 1 ? 4 : 2));
  const spacing = 5.5 * scale;
  const lobes: [number, number][] = [];
  for (let l = 0; l < lobeCount; l++) {
    // Spread puffs across the cloud: big ones in the middle tapering to the ends,
    // with the tallest puff nudged off-centre so clouds aren't symmetric.
    const pos = l - (lobeCount - 1) / 2;
    const norm = lobeCount > 1 ? pos / ((lobeCount - 1) / 2) : 0;
    const peak = (hash(i, seed + 7) - 0.5) * 0.8;
    const falloff = 1 - Math.min(1, Math.abs(norm - peak)) * 0.55;
    const jitter = 0.8 + hash(i * 11 + l, seed + 9) * 0.4;
    lobes.push([pos * spacing + (hash(i * 11 + l, seed + 8) - 0.5) * 2, 7 * scale * falloff * jitter]);
  }
  const left = Math.min(...lobes.map(([o, r]) => o - r));
  const right = Math.max(...lobes.map(([o, r]) => o + r));
  // Speeds range from a lazy crawl to a quick dash; a few clouds are much faster.
  const fast = hash(i, seed + 12) > 0.8;
  const w = right - left;
  return {
    kind: 'cumulus',
    x: hash(i, seed + 1) * (cols + w * 2),
    y,
    w,
    h: Math.max(...lobes.map(([, r]) => r * 1.5)),
    speed: (fast ? 14 + hash(i, seed + 5) * 12 : 1.5 + hash(i, seed + 5) * 9) * speedScale,
    bobAmp: 1 + hash(i, seed + 13) * bob,
    bobRate: 0.15 + hash(i, seed + 14) * 0.5,
    bobPhase: hash(i, seed + 15) * Math.PI * 2,
    rank: hash(i, seed + 16),
    seed: Math.floor(hash(i, seed + 17) * 1000),
    lobes: lobes.map(([o, r]) => [o - (left + right) / 2, r]),
  };
}

function plain(kind: CloudKind, i: number, seed: number, cols: number, y: number, w: number, h: number, speed: number): DotCloud {
  return {
    kind,
    x: hash(i, seed + 1) * (cols + w * 2),
    y,
    w,
    h,
    speed,
    bobAmp: 1 + hash(i, seed + 13) * 2,
    bobRate: 0.1 + hash(i, seed + 14) * 0.3,
    bobPhase: hash(i, seed + 15) * Math.PI * 2,
    rank: hash(i, seed + 16),
    seed: Math.floor(hash(i, seed + 17) * 1000),
    lobes: [],
  };
}

// band is how far the layer reaches above and below the box, in sky pixels.
// speedScale sets the overall pace of the drift.
export function makeCloudPool(cols: number, rows: number, seed: number, band: number, speedScale: number): DotCloud[] {
  const clouds: DotCloud[] = [];
  const inner = Math.max(1, rows - band * 2);
  // Enough puffs for an overcast day; fewer show when it's clearer.
  const count = Math.max(10, Math.round((cols * inner) / 1100));
  for (let i = 0; i < count; i++) {
    clouds.push(cumulus(i, seed, cols, band + inner * (0.06 + 0.92 * hash(i, seed + 2)), 1.8, 6, speedScale));
  }
  // The margins above and below get their own smaller clouds, based near the box
  // edge so each body fills its band instead of being cut off by the canvas.
  if (band >= 12) {
    const perBand = Math.max(2, Math.round((cols * band) / 700));
    for (let k = 0; k < perBand * 2; k++) {
      const i = count + k;
      const spot = hash(i, seed + 2);
      const y = k < perBand ? band * (0.55 + 0.5 * spot) : rows - band * (0.05 + 0.45 * spot);
      clouds.push(cumulus(i, seed, cols, y, 1, 3, speedScale));
    }
  }
  // Long flat layers for grey days.
  const s2 = seed + 500;
  const layers = Math.max(6, Math.round(rows / 22));
  for (let k = 0; k < layers; k++) {
    const i = k + 20;
    clouds.push(plain('stratus', i, s2, cols, band + inner * (0.12 + 0.84 * hash(i, s2 + 2)), cols * (0.4 + hash(i, s2 + 3) * 0.5), 10 + hash(i, s2 + 4) * 8, (2 + hash(i, s2 + 5) * 3) * speedScale));
  }
  // Ragged scraps of scud that race along low under rain and storms.
  const s3 = seed + 900;
  for (let k = 0; k < 8; k++) {
    const i = k + 40;
    clouds.push(plain('scud', i, s3, cols, band + inner * (0.35 + 0.6 * hash(i, s3 + 2)), 12 + hash(i, s3 + 3) * 22, 3 + hash(i, s3 + 4) * 3, (7 + hash(i, s3 + 5) * 8) * speedScale));
  }
  return clouds;
}

// How the dot clouds look in this weather: small white puffs on fair days, big
// grey-bottomed heaps as it clouds over, long flat layers when it's overcast,
// dark heaps trailing rain with ragged scud racing beneath, towering dark storm
// clouds, faint wisps in fog, and everything stretched out on a strong wind.
type Look = { grow: number; tall: number; dark: number; stratus: number; scud: number; thin: number; stretch: number; rain: number; snow: number };

function lookOf(w: SkyWeather): Look {
  return {
    grow: 0.9 + w.cover * 0.25 + w.storm * 0.3,
    tall: 1 + w.storm * 0.5,
    dark: clamp(w.dark * 1.4 * (1 - w.snow * 0.6) + w.rain * 0.2),
    stratus: smooth(0.5, 0.82, w.cover),
    scud: Math.max(w.rain, w.storm, w.snow * 0.6),
    thin: w.fog * 0.8,
    stretch: 1 + w.wind * 0.3,
    rain: w.rain,
    snow: w.snow,
  };
}

// How far along a cloud is, 0 (not there) to 1 (full size). Heaps form as the
// cover rises past their rank, starting as small puffs and swelling, and shrink
// away again as it clears; under a solid overcast most give way to the layers.
function growth(cloud: DotCloud, w: SkyWeather, look: Look) {
  switch (cloud.kind) {
    case 'stratus':
      return smooth(0.45 + cloud.rank * 0.3, 0.62 + cloud.rank * 0.3, w.cover);
    case 'scud':
      return clamp((look.scud - cloud.rank * 0.7) * 3);
    default: {
      const shown = 0.2 + w.cover * 0.85;
      return smooth(cloud.rank - 0.04, cloud.rank + 0.22, shown) * (1 - look.stratus * 0.5 * cloud.rank);
    }
  }
}

// How far inside the cloud a point is: > 0 inside, < 0 outside, ~0 on the outline.
// s scales the cloud, tall stretches it upward and stretch widens it.
function cloudDepth(cloud: DotCloud, dx: number, up: number, s: number, tall: number, stretch: number) {
  if (up < 0) return -1;
  switch (cloud.kind) {
    case 'stratus': {
      // A long layer, wavy along its top and bottom, tapering and fraying at the ends.
      const half = (cloud.w / 2) * s * stretch;
      const ax = Math.abs(dx);
      if (ax > half) return -1;
      const th = cloud.h * s * tall * smooth(half, half * 0.6, ax) * (0.55 + 0.45 * valueNoise(dx * 0.06 + cloud.seed, 1.7));
      const u = up - 1.6 * valueNoise(dx * 0.025 + cloud.seed, 4.2);
      if (u < 0 || u > th) return -1;
      return Math.min(u + 1, th - u, (half - ax) * 0.3);
    }
    case 'scud': {
      const half = (cloud.w / 2) * s * stretch;
      const h = cloud.h * s;
      if (Math.abs(dx) > half || up > h) return -1;
      const edge = (1 - Math.abs(dx) / half) * (1 - Math.abs(up - h / 2) / (h / 2 + 0.01));
      return (valueNoise((dx + cloud.seed) * 0.25, up * 0.5 + cloud.seed * 0.1) * edge - 0.15) * 8;
    }
    default: {
      let depth = -Infinity;
      const ux = dx / stretch;
      const uy = up / tall;
      // Puff centres sit a little above the base so the bottom stays flat.
      for (const [offset, r] of cloud.lobes) depth = Math.max(depth, r * s - Math.hypot(ux - offset * s, uy - r * s * 0.5));
      return depth;
    }
  }
}

export type CloudLayer = {
  img: ImageData;
  cols: number; // whole layer, spill included
  rows: number;
  spillX: number; // where the box starts inside the layer
  spillY: number;
  boxCols: number;
  boxRows: number;
};

const CLOUD_DARK: RGB = [44, 48, 62];
const RAIN_DOT: RGB = [198, 212, 238];
const SNOW_DOT: RGB = [244, 246, 252];

// Draw the front clouds. travel is how far they've drifted (wind-adjusted seconds),
// tint is the clouds' colour for the time of day and sky the background behind
// them, appear fades them in during the opening reveal, flash lights them up.
export function drawFrontClouds(layer: CloudLayer, pool: DotCloud[], t: number, travel: number, w: SkyWeather, tint: RGB, sky: RGB, appear: number, flash: number, clear = true) {
  const { img, cols, rows, spillX, spillY, boxCols, boxRows } = layer;
  const data = img.data;
  if (clear) data.fill(0);
  if (appear <= 0) return;
  const look = lookOf(w);
  // A lit top, a mid body and a shadowed base. On grey days the tones are set
  // against the sky behind, lighter on top and darker below, so the dots still
  // read; the wetter it gets, the darker the clouds.
  const grey = smooth(0.4, 0.85, w.cover);
  const fair = lerp3(tint, [255, 255, 255], 0.1 + grey * 0.25);
  const wetLit = lerp3(lerp3(sky, [255, 255, 255], 0.25), tint, 0.25);
  const lit = lerp3(lerp3(fair, wetLit, look.dark), [236, 236, 250], Math.min(1, flash * 0.8));
  const shadow = lerp3(sky, CLOUD_DARK, 0.4 + grey * 0.15 + look.dark * 0.25);
  const mid = lerp3(lit, shadow, 0.2 + grey * 0.15 + look.dark * 0.2);
  const base = lerp3(lit, shadow, 0.4 + grey * 0.2 + look.dark * 0.3);
  const scudColor = lerp3(sky, CLOUD_DARK, (0.5 + look.dark * 0.2) * (1 - look.snow * 0.5));
  const wet = Math.max(look.rain, look.snow);
  const fallColor = look.snow > look.rain ? SNOW_DOT : lerp3(sky, RAIN_DOT, 0.7);
  const put = (x: number, y: number, c: RGB) => {
    const sx = x - spillX;
    const sy = y - spillY;
    const inside = sx >= 0 && sy >= 0 && sx < boxCols && sy < boxRows;
    if (clear) {
      const i = (y * cols + x) * 4;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
      // Dots outside the box are slightly dimmer so they read as spill.
      data[i + 3] = inside ? 255 : 200;
    } else {
      plot(img, x, y, c, 1);
    }
  };
  for (let ci = 0; ci < pool.length; ci++) {
    const cloud = pool[ci];
    const g = growth(cloud, w, look);
    if (g <= 0.02) continue;
    const show = Math.min(1, g * 3) * appear * (1 - look.thin);
    if (show <= 0.01) continue;
    let s = 0.6 + 0.4 * g;
    let tall = 1;
    if (cloud.kind === 'cumulus') {
      s = (0.3 + 0.7 * g) * look.grow;
      tall = look.tall;
    } else if (cloud.kind === 'stratus') {
      s = 0.4 + 0.6 * g;
      tall = 1 + look.dark * 0.6;
    }
    const stretch = look.stretch;
    const width = cloud.w * s * stretch;
    const height = Math.ceil(cloud.h * s * tall * (cloud.kind === 'cumulus' ? 1 : 1.2)) + 2;
    // Wrap on the largest size the cloud can reach so changing weather never makes it jump.
    const reach = cloud.w * 0.95 + 2;
    const span = cols + reach * 2;
    const cx = ((((cloud.x - travel * cloud.speed) % span) + span) % span) - reach;
    const x0 = Math.floor(cx - width / 2) - 1;
    const bottom = Math.round(cloud.y + Math.sin(t * cloud.bobRate + cloud.bobPhase) * cloud.bobAmp);
    const top = cloud.h * s * tall;
    for (let x = x0; x <= x0 + width + 2; x++) {
      if (x < 0 || x >= cols || x & 1) continue;
      const dx = x - cx;
      for (let y = bottom - height; y <= bottom; y++) {
        if (y < 0 || y >= rows || y & 1) continue;
        const up = bottom - y;
        const depth = cloudDepth(cloud, dx, up, s, tall, stretch);
        if (depth < 0) continue;
        // Solid body with a slightly broken, sparkly outline. The hash is keyed
        // to the cloud's own grid so the pattern doesn't shimmer as it drifts.
        const keep = depth < 1.6 ? 0.55 : 0.97;
        if (hash(Math.round(dx) * 31 + ci, up) > keep * show) continue;
        const frac = up / top;
        const shaded = cloud.kind === 'stratus' ? (frac < 0.3 ? mid : lit) : frac < 0.22 ? base : frac < 0.5 ? mid : lit;
        put(x, y, cloud.kind === 'scud' ? scudColor : shaded);
      }
    }
    // Rain or snow falling from the darker heaps and layers, in dotted streaks.
    if (wet > 0.2 && cloud.kind !== 'scud' && (look.dark > 0.3 || look.snow > 0.2)) {
      const snowy = look.snow > look.rain;
      const step = Math.floor(t * (snowy ? 5 : 13));
      const len = Math.round((10 + 22 * wet) / 2);
      for (let x = x0; x <= x0 + width + 2; x++) {
        if (x < 0 || x >= cols || x & 1) continue;
        const dx = x - cx;
        if (cloudDepth(cloud, dx, 1, s, tall, stretch) < 0) continue;
        const key = Math.round(dx) * 13 + ci;
        if (hash(key, 98) > 0.5 * wet * show) continue;
        const lag = Math.floor(hash(key, 99) * 3);
        for (let k = 0; k < len; k++) {
          if ((k - step - lag + 3000) % 3) continue;
          if (hash(key + k * 7, 97) > 1 - k / len) continue;
          const y = (bottom + 2 + k * 2) & ~1;
          const xx = (x + Math.round(w.windDir * k * (snowy ? 0.6 : 0.4)) * 2) & ~1;
          if (y < rows && xx >= 0 && xx < cols) put(xx, y, fallColor);
        }
      }
    }
  }
}

// ---------- Rare clouds in the sky itself ----------

function fade(f: Frame, span: { from: number; to: number } | null, edge = 0.15) {
  if (!span) return 0;
  return envelope(within(f.u, span.from, span.to), edge);
}

const NOCTI: RGB = [150, 212, 255];
const NOCTI_BRIGHT: RGB = [214, 238, 255];

// Electric-blue, silvery wisps glowing in deep twilight.
export function drawNoctilucent(f: Frame) {
  const amount = fade(f, f.plan.noctilucent, 0.2);
  if (amount <= 0) return;
  const { cols, rows, t } = f;
  for (let y = Math.round(rows * 0.5); y < rows * 0.86; y++) {
    const band = Math.sin(((y - rows * 0.5) / (rows * 0.36)) * Math.PI);
    for (let x = 0; x < cols; x++) {
      // Fine ripples, bent and broken up by slow noise so they read as wisps, not stripes.
      const warp = 3.2 * valueNoise(x * 0.04, y * 0.06 + t * 0.02) + 1.5 * valueNoise(x * 0.11 + 9, y * 0.13);
      const k = Math.sin(x * (0.22 + 0.12 * valueNoise(y * 0.05, 3)) + y * 0.8 + warp);
      const patch = valueNoise(x * 0.03 + 5, y * 0.04 + t * 0.01);
      if (k > 0.78 && patch > 0.35) dot(f.img, x, y, k > 0.94 ? NOCTI_BRIGHT : NOCTI, amount * band * 1.4 * patch, 0.75);
    }
  }
  tag(f, 'Noctilucent clouds', cols / 2, rows * 0.68, cols / 3);
}

const ICE: RGB = [232, 238, 246];

// A round hole punched in a cloud layer, blue sky showing through and ice falling from it.
export function drawHolePunch(f: Frame) {
  const amount = fade(f, f.plan.holePunch, 0.2);
  if (amount <= 0) return;
  const { cols, rows, plan, clearMix } = f;
  const s = plan.holePunch!.seed;
  const cx = cols * (0.4 + hash(s, 1) * 0.25);
  const cy = rows * (0.25 + hash(s, 2) * 0.1);
  const R = 17 * f.scale + 3;
  for (let dy = -R - 3; dy <= R + 3; dy++) {
    for (let dx = -R * 1.5; dx <= R * 1.5; dx++) {
      const a = Math.atan2(dy, dx);
      const ragged = R * (1 + 0.12 * Math.sin(a * 5 + s) + 0.08 * Math.sin(a * 9));
      const d = Math.hypot(dx / 1.4, dy);
      if (d > ragged) continue;
      const y = Math.round(cy + dy);
      const gy = Math.min(1, Math.max(0, y / rows));
      const sky = lerp3(clearMix.top[1], clearMix.bottom[1], gy);
      dot(f.img, Math.round(cx + dx), y, sky, amount * (d > ragged - 2 ? 0.6 : 1.1), 1);
    }
  }
  // Wisps of ice falling from the middle.
  for (let k = 0; k < 7; k++) {
    const x0 = cx + (k - 3) * 2.5;
    for (let dy = 0; dy < R * 0.9; dy++) dot(f.img, Math.round(x0 + Math.sin(dy * 0.3 + k) * 1.2), Math.round(cy - R * 0.3 + dy), ICE, amount * (1 - dy / (R * 0.9)), 0.7);
  }
  tag(f, 'Hole-punch cloud', cx, cy, R);
}

const PEARL: RGB[] = [[255, 176, 206], [190, 255, 214], [172, 202, 255], [255, 236, 172]];

// Very high clouds shimmering in pastel colours at twilight.
export function drawNacreous(f: Frame) {
  const amount = fade(f, f.plan.nacreous, 0.2);
  if (amount <= 0) return;
  const { cols, rows, t } = f;
  const lenses = [
    [0.32, 0.18, 30],
    [0.7, 0.26, 24],
  ];
  for (const [lx, ly, size] of lenses) {
    const a = size * f.scale + 4;
    const b = a * 0.22;
    const cx = lx * cols;
    const cy = ly * rows;
    for (let dy = -Math.ceil(b); dy <= b; dy++) {
      for (let dx = -Math.ceil(a); dx <= a; dx++) {
        const d = (dx / a) ** 2 + (dy / b) ** 2;
        if (d > 1) continue;
        const phase = (dx * 0.08 + dy * 0.3 + t * 0.12) % PEARL.length;
        const k = Math.floor(((phase % PEARL.length) + PEARL.length) % PEARL.length);
        const c = lerp3(PEARL[k], PEARL[(k + 1) % PEARL.length], phase - Math.floor(phase));
        dot(f.img, Math.round(cx + dx), Math.round(cy + dy), c, amount * (1.2 - d), 0.8);
      }
    }
  }
  tag(f, 'Mother-of-pearl clouds', cols / 2, rows * 0.22, cols / 3);
}

const CIRRUS: RGB = [246, 248, 252];

// Thin, high cirrus wisps on fair days: long gently rising streaks with a hooked
// head and a frayed, fading tail, drifting slowly with the sky.
export function drawCirrus(f: Frame) {
  const { weather, cols, rows, plan } = f;
  const amount = Math.min(1, weather.haze * 1.1 + (weather.cover < 0.45 ? 0.3 : 0)) * (1 - smooth(0.5, 0.75, weather.cover)) * (1 - weather.rain);
  if (amount <= 0.05) return;
  const color = lerp3(CIRRUS, f.mix.cloud, 0.25);
  const count = 5 + (plan.base % 3);
  for (let k = 0; k < count; k++) {
    const len = cols * (0.25 + 0.22 * hash(k, plan.base + 1));
    const wrap = cols + len + 40;
    const x0 = ((((hash(k, plan.base + 2) * wrap + f.travel * (1.2 + hash(k, plan.base + 3))) % wrap) + wrap) % wrap) - len - 20;
    const y0 = rows * (0.08 + 0.42 * hash(k, plan.base + 4));
    const slope = 0.12 + 0.12 * hash(k, plan.base + 5);
    for (let s = 0; s < len; s++) {
      const q = s / len;
      // The head droops into a little hook; the tail rises and frays.
      const hook = q < 0.15 ? (1 - q / 0.15) ** 2 * 6 : 0;
      const x = Math.round(x0 + s);
      const y = Math.round(y0 - s * slope + hook);
      const fade = (1 - q) ** 0.6 * amount;
      dot(f.img, x, y, color, fade * 1.2, 0.6);
      if (q < 0.55) dot(f.img, x, y + 1, color, fade * 0.8, 0.45);
      for (const off of [-2, 2]) if (valueNoise(s * 0.25, k * 7 + off) > 0.55) dot(f.img, x, y + off, color, fade * 0.7, 0.4);
    }
  }
}

export function drawRareClouds(f: Frame) {
  drawNacreous(f);
  drawNoctilucent(f);
  drawHolePunch(f);
}
