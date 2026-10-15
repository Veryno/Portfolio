import { BLOCK, STAR, STAR_DIM, bayer, blend, hash, lerp3, put, skyField, smooth, valueNoise, type RGB } from './pixel';
import type { SkyMix } from './phases';

// Rare things that happen in the background sky: the sun clipping a top corner
// as it rises or sets, the moon (now and then in daylight), shooting stars and
// the ISS. Each cycle rolls its own set, so most loops are just sky.

// Chance per cycle. Shooting stars and the ISS are meant to be a rare treat.
const ODDS = { sunrise: 0.35, sunset: 0.35, moon: 0.25, dayMoon: 0.1, iss: 0.15, streak: 0.3, secondStreak: 0.25 };
const MOON_PHASES = [0.18, 0.25, 0.38, 0.5, 0.5, 0.62, 0.75, 0.82];
// When each body crosses the box, as a fraction of the cycle (lined up with the
// keyframes in phases.ts).
const WINDOWS = {
  dayMoon: [0.02, 0.18],
  sunset: [0.19, 0.4],
  moon: [0.5, 0.72],
  sunrise: [0.74, 0.94],
} as const;

type CornerPass = { jitter: number };
type MoonPass = CornerPass & { phase: number; rising: boolean };
type IssPass = { start: number; y: number; slope: number; dir: number; fade: number };
type Streak = { at: number; seed: number };

export type SkyPlan = {
  dayMoon: MoonPass | null;
  sunset: CornerPass | null;
  moon: MoonPass | null;
  iss: IssPass | null;
  sunrise: CornerPass | null;
  streaks: Streak[];
};

export function planCycle(n: number): SkyPlan {
  const r = (k: number) => hash(n * 92821 + k, 4243);
  const moonPhase = (k: number) => MOON_PHASES[Math.floor(r(k) * MOON_PHASES.length)];
  return {
    dayMoon: r(1) < ODDS.dayMoon ? { jitter: r(2), phase: moonPhase(3), rising: r(4) < 0.5 } : null,
    sunset: r(5) < ODDS.sunset ? { jitter: r(6) } : null,
    moon: r(7) < ODDS.moon ? { jitter: r(8), phase: moonPhase(9), rising: r(10) < 0.5 } : null,
    iss: r(11) < ODDS.iss ? { start: 0.52 + r(12) * 0.12, y: r(13), slope: r(14), dir: r(15) < 0.5 ? 1 : -1, fade: r(16) } : null,
    sunrise: r(17) < ODDS.sunrise ? { jitter: r(18) } : null,
    // Usually none; sometimes one, occasionally two, somewhere in the dark stretch.
    streaks: (r(19) < ODDS.streak ? (r(20) < ODDS.secondStreak ? [0, 1] : [0]) : []).map((k) => ({
      at: 0.53 + r(21 + k) * 0.16,
      seed: n * 31 + k,
    })),
  };
}

// How much the brightest cloud banks in the sky field veil whatever is behind
// them at (x, y). Capped at half so the sun and moon always read through.
function skyCover(x: number, y: number, t: number) {
  return smooth(0.85, 1, skyField(Math.floor(x / BLOCK), Math.floor(y / BLOCK), t)) * 0.5;
}

const SUN_REACH = 0.72;
const MOON_REACH = 0.56;
const ARC_BEND = 2;

// Point p (0..1) along an arc that climbs out of the left edge and leaves through
// the top, bowing toward the top-left corner. Coordinates are box-relative (0..1);
// reach sets how far into the box it gets. Mirror x for the right-hand corner
// and run p backwards for a setting path.
function cornerArc(p: number, reach: number, jitter: number): [number, number] {
  const j = (jitter - 0.5) * 0.16;
  const x1 = -0.14;
  const y1 = reach + j;
  const x2 = reach * 0.8 + j;
  const y2 = -0.14;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const len = Math.hypot(y1 - y2, x2 - x1);
  const cx = mx + ((y1 - y2) / len) * ARC_BEND;
  const cy = my + ((x2 - x1) / len) * ARC_BEND;
  const a1 = Math.atan2(y1 - cy, x1 - cx);
  let da = Math.atan2(y2 - cy, x2 - cx) - a1;
  if (da > Math.PI) da -= Math.PI * 2;
  if (da < -Math.PI) da += Math.PI * 2;
  const r = Math.hypot(x1 - cx, y1 - cy);
  return [cx + Math.cos(a1 + da * p) * r, cy + Math.sin(a1 + da * p) * r];
}

function flip([x, y]: [number, number]): [number, number] {
  return [1 - x, y];
}

function drawSun(img: ImageData, cx: number, cy: number, radius: number, [core, rim, glow]: [RGB, RGB, RGB], t: number) {
  const { data, width: cols, height: rows } = img;
  const glowR = radius * 2.7;
  const x0 = Math.max(0, Math.floor(cx - glowR));
  const x1 = Math.min(cols - 1, Math.ceil(cx + glowR));
  const y0 = Math.max(0, Math.floor(cy - glowR));
  const y1 = Math.min(rows - 1, Math.ceil(cy + glowR));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > glowR) continue;
      const threshold = bayer(x, y);
      const i = (y * cols + x) * 4;
      if (d <= radius) {
        // Behind a bright cloud bank the disc breaks up into a softer, hazy glow.
        if (skyCover(x, y, t) > threshold) blend(data, i, core, 0.55);
        else put(data, i, d > radius - 1.5 ? rim : core);
      } else {
        const k = 1 - (d - radius) / (glowR - radius);
        if (k * k > threshold) blend(data, i, glow, 0.2 + 0.5 * k);
      }
    }
  }
}

const MOON_LIT: RGB = [240, 238, 222];
const MOON_MARE: RGB = [204, 204, 194];
const MOON_DARK: RGB = [30, 38, 66];
const MOON_GLOW: RGB = [120, 134, 182];
const GHOST_LIT: RGB = [246, 248, 252];
const GHOST_MARE: RGB = [200, 212, 234];

// phase: 0 = new, 0.5 = full, 1 = new again.
function moonLit(nx: number, ny: number, phase: number) {
  const terminator = Math.cos(phase * Math.PI * 2) * Math.sqrt(Math.max(0, 1 - ny * ny));
  return phase <= 0.5 ? nx > terminator : -nx > terminator;
}

// A ghost moon is the daytime one: faint and broken up so the blue shows through, no glow.
function drawMoon(img: ImageData, cx: number, cy: number, radius: number, phase: number, ghost: boolean, t: number) {
  const { data, width: cols, height: rows } = img;
  const glowR = ghost ? radius : radius * 2.2;
  const x0 = Math.max(0, Math.floor(cx - glowR));
  const x1 = Math.min(cols - 1, Math.ceil(cx + glowR));
  const y0 = Math.max(0, Math.floor(cy - glowR));
  const y1 = Math.min(rows - 1, Math.ceil(cy + glowR));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > glowR) continue;
      const threshold = bayer(x, y);
      const i = (y * cols + x) * 4;
      const cover = skyCover(x, y, t);
      if (d <= radius) {
        const nx = dx / radius;
        const ny = dy / radius;
        const lit = moonLit(nx, ny, phase);
        const mare = valueNoise(nx * 2.2 + 4, ny * 2.2 + 9) > 0.6;
        if (ghost) {
          if (lit && cover < 0.3 && threshold < 0.8) blend(data, i, mare ? GHOST_MARE : GHOST_LIT, 0.85);
        } else if (cover > threshold) {
          blend(data, i, MOON_GLOW, 0.4);
        } else {
          put(data, i, !lit ? MOON_DARK : mare ? MOON_MARE : MOON_LIT);
        }
      } else {
        const k = 1 - (d - radius) / (glowR - radius);
        if (k * k * 0.7 * (1 - cover) > threshold) blend(data, i, MOON_GLOW, 0.35);
      }
    }
  }
}

function plot(img: ImageData, x: number, y: number, c: RGB, amount: number) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  blend(img.data, (y * img.width + x) * 4, c, amount);
}

const STREAK_SECONDS = 0.9;

// Shooting star at progress p: a bright head with a dithered tail that grows, then fades.
function drawStreak(img: ImageData, seed: number, p: number) {
  const startX = img.width * (0.05 + hash(seed, 503) * 0.9);
  const startY = img.height * hash(seed, 504) * 0.55;
  const dir = hash(seed, 505) < 0.5 ? 1 : -1;
  const slope = 0.3 + hash(seed, 506) * 0.35;
  const travelled = (40 + hash(seed, 507) * 30) * p;
  const hx = startX + dir * travelled;
  const hy = startY + slope * travelled;
  const len = Math.min(22, travelled);
  const alpha = Math.min(1, Math.sin(Math.PI * Math.min(1, p)) * 1.5);
  for (let i = 0; i <= len; i++) {
    const x = Math.round(hx - dir * i);
    const y = Math.round(hy - slope * i);
    const k = (1 - i / (len + 1)) * alpha;
    if (i < 3 || k > 0.6) plot(img, x, y, STAR, alpha);
    else if (k > bayer(x, y) * 0.8) plot(img, x, y, STAR_DIM, 0.9);
  }
}

const ISS_SECONDS = 8;
const ISS_LIGHT: RGB = [255, 250, 232];
const ISS_SHADOW: RGB = [255, 176, 140];

// The ISS: a steady (never blinking) bright cross gliding across. Some passes
// fade out mid-sky as it slips into Earth's shadow, like the real thing.
function drawIss(img: ImageData, iss: IssPass, p: number) {
  const span = img.width + 6;
  const x = Math.round(iss.dir > 0 ? -3 + p * span : img.width + 3 - p * span);
  const y = Math.round(img.height * (0.1 + iss.y * 0.4) + (p - 0.5) * img.height * (iss.slope - 0.5) * 0.5);
  const shadowAt = iss.fade < 0.6 ? 0.45 + iss.fade * 0.5 : 2;
  const brightness = p > shadowAt ? Math.max(0, 1 - (p - shadowAt) / 0.15) : 1;
  if (brightness <= 0) return;
  const c = lerp3(ISS_SHADOW, ISS_LIGHT, brightness);
  plot(img, x, y, c, brightness);
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) plot(img, x + ox, y + oy, c, 0.65 * brightness);
}

// Draw this cycle's events at position u (0..1) on top of the sky pixels.
// Pixels the reveal hasn't uncovered yet stay transparent, so nothing shows early.
export function drawEvents(img: ImageData, t: number, u: number, mix: SkyMix, plan: SkyPlan, cycleSeconds: number) {
  const { width: cols, height: rows } = img;
  // Bodies are sized for the desktop box (217 sky pixels across) and shrink a little on phones.
  const scale = Math.min(1, Math.max(0.65, Math.min(cols, rows) / 217));
  const sunR = Math.round(11 * scale);
  const moonR = Math.round(8 * scale);
  const toPx = ([x, y]: [number, number]) => [Math.round(x * cols), Math.round(y * rows)] as const;
  const progress = ([from, to]: readonly [number, number]) => (u >= from && u <= to ? (u - from) / (to - from) : -1);
  // Seconds since the cycle passed `at` (almost a full cycle if it hasn't yet).
  const since = (at: number) => ((u - at + 1) % 1) * cycleSeconds;

  // Moons keep to the top-right corner, away from the name at the top left.
  if (plan.dayMoon) {
    const p = progress(WINDOWS.dayMoon);
    if (p >= 0) {
      const [x, y] = toPx(flip(cornerArc(plan.dayMoon.rising ? p : 1 - p, MOON_REACH, plan.dayMoon.jitter)));
      drawMoon(img, x, y, moonR, plan.dayMoon.phase, true, t);
    }
  }
  if (plan.moon) {
    const p = progress(WINDOWS.moon);
    if (p >= 0) {
      const [x, y] = toPx(flip(cornerArc(plan.moon.rising ? p : 1 - p, MOON_REACH, plan.moon.jitter)));
      drawMoon(img, x, y, moonR, plan.moon.phase, false, t);
    }
  }
  if (plan.sunset) {
    const p = progress(WINDOWS.sunset);
    if (p >= 0) {
      const [x, y] = toPx(flip(cornerArc(1 - p, SUN_REACH, plan.sunset.jitter)));
      drawSun(img, x, y, sunR, mix.sun, t);
    }
  }
  if (plan.sunrise) {
    const p = progress(WINDOWS.sunrise);
    if (p >= 0) {
      const [x, y] = toPx(cornerArc(p, SUN_REACH, plan.sunrise.jitter));
      drawSun(img, x, y, sunR, mix.sun, t);
    }
  }
  if (plan.iss) {
    const elapsed = since(plan.iss.start);
    if (elapsed < ISS_SECONDS) drawIss(img, plan.iss, elapsed / ISS_SECONDS);
  }
  for (const streak of plan.streaks) {
    const elapsed = since(streak.at);
    if (elapsed < STREAK_SECONDS) drawStreak(img, streak.seed, elapsed / STREAK_SECONDS);
  }
}
