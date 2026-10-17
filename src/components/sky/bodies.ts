import { cloudAt, tag, within, type Frame } from './context';
import { WINDOWS } from './plan';
import { bayer, blend, put, smooth, valueNoise, type RGB } from './pixel';

// The sun and the moon: where they are, how they look through the weather, the
// sun's rays, the moon's phase, and the two eclipses.

const SUN_REACH = 0.72;
const MOON_REACH = 0.56;
const ARC_BEND = 2;

// Point p (0..1) along an arc that climbs out of the left edge and leaves through
// the top, bowing toward the top-left corner. Coordinates are box-relative (0..1);
// reach sets how far into the box it gets. Mirror x for the right-hand corner
// and run p backwards for a setting path.
export function cornerArc(p: number, reach: number, jitter: number): [number, number] {
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

const flip = ([x, y]: [number, number]): [number, number] => [1 - x, y];

// How far through the day's solar eclipse we are: 0 none .. 1 totality.
export function eclipseCover(f: Pick<Frame, 'u' | 'plan'>) {
  if (!f.plan.eclipse) return 0;
  const p = within(f.u, WINDOWS.noonSun[0], WINDOWS.noonSun[1]);
  if (p < 0) return 0;
  // The moon slides across between 15% and 85% of the window.
  const slide = (p - 0.15) / 0.7;
  if (slide <= 0 || slide >= 1) return 0;
  const offset = Math.abs(slide - 0.5) * 2; // 0 at mid-eclipse
  return smooth(1, 0.12, offset);
}

export type SunSpot = { x: number; y: number; r: number; low: boolean; key: 'rise' | 'set' | 'noon'; visible: number };

function sunPosition(f: Frame): { x: number; y: number; low: boolean; key: 'rise' | 'set' | 'noon'; p: number } | null {
  const { plan, u } = f;
  if (plan.sunset) {
    const p = within(u, WINDOWS.sunset[0], WINDOWS.sunset[1]);
    if (p >= 0) {
      const [x, y] = flip(cornerArc(1 - p, SUN_REACH, plan.sunset.jitter));
      return { x, y, low: true, key: 'set', p };
    }
  }
  if (plan.sunrise) {
    const p = within(u, WINDOWS.sunrise[0], WINDOWS.sunrise[1]);
    if (p >= 0) {
      const [x, y] = cornerArc(p, SUN_REACH, plan.sunrise.jitter);
      return { x, y, low: true, key: 'rise', p };
    }
  }
  if (plan.noonSun) {
    const p = within(u, WINDOWS.noonSun[0], WINDOWS.noonSun[1]);
    if (p >= 0) {
      // High overhead, peeking in along the top edge; lower and fully in view on an
      // eclipse day. It slides down into view at the start and back up at the end.
      const x = 0.28 + p * 0.42 + (plan.noonSun.jitter - 0.5) * 0.1;
      const y = plan.eclipse ? 0.2 : plan.halo ? 0.06 : 0.02;
      const shown = smooth(0, 0.12, p) * (1 - smooth(0.88, 1, p));
      return { x, y: -0.3 + (y + 0.3) * shown, low: false, key: 'noon', p };
    }
  }
  return null;
}

// Where the sun is this frame, in sky pixels, and how much of it the cloud lets through.
// Sets f.sun so halos and rays can find it.
export function locateSun(f: Frame): SunSpot | null {
  const pos = sunPosition(f);
  if (!pos) return null;
  // Thick cloud hides the sun; thinner cloud lets it glow through.
  const visible = 1 - smooth(0.42, 0.82, f.weather.cover);
  if (visible <= 0.02) return null;
  const spot = { x: Math.round(pos.x * f.cols), y: Math.round(pos.y * f.rows), r: Math.round(11 * f.scale), low: pos.low, key: pos.key, visible };
  f.sun = { x: spot.x, y: spot.y, r: spot.r };
  return spot;
}

export function drawSun(f: Frame, spot: SunSpot) {
  const { img, cols, rows, t, weather } = f;
  const { visible, r: R, x: cx, y: cy } = spot;
  const pos = spot;
  const [core, rim, glow] = f.mix.sun;
  const data = img.data;
  const eclipse = pos.key === 'noon' ? eclipseCover(f) : 0;

  // Rays: slowly turning spokes on clear days, long and pale overhead, short and warm when low.
  if (weather.cover < 0.55 && eclipse < 0.6) {
    const strength = visible * (1 - weather.cover / 0.55) * (1 - eclipse);
    const rayColor: RGB = [glow[0] + (255 - glow[0]) * 0.45, glow[1] + (255 - glow[1]) * 0.45, glow[2] + (255 - glow[2]) * 0.45];
    const spokes = 16;
    for (let k = 0; k < spokes; k++) {
      const a = (k / spokes) * Math.PI * 2 + t * 0.035;
      const long = k % 2 === 0;
      const reach = R * (pos.low ? 2.6 : 4) * (long ? 1 : 0.62) * (0.8 + 0.25 * Math.sin(t * 0.45 + k * 1.7));
      const steps = Math.ceil(reach);
      for (let s = Math.ceil(R * 1.25); s < steps; s++) {
        const fade = Math.pow(1 - s / steps, 0.8) * strength;
        // Long spokes are two pixels wide near the sun and taper to one.
        const width = long && s < steps * 0.55 ? 2 : 1;
        for (let w = 0; w < width; w++) {
          const x = Math.round(cx + Math.cos(a) * s - Math.sin(a) * w * 0.8);
          const y = Math.round(cy + Math.sin(a) * s + Math.cos(a) * w * 0.8);
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          if (fade * 1.4 > bayer(x, y)) blend(data, (y * cols + x) * 4, rayColor, 0.72);
        }
      }
    }
  }

  const glowR = R * 2.7;
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
      const veil = Math.max(1 - visible, cloudAt(f, x, y) * 0.5);
      if (d <= R) {
        // Behind cloud the disc breaks up into a softer, hazy glow.
        if (veil > threshold) blend(data, i, core, 0.55 * visible);
        else put(data, i, d > R - 1.5 ? rim : core);
      } else {
        const k = 1 - (d - R) / (glowR - R);
        if (k * k * visible > threshold) blend(data, i, glow, (0.2 + 0.5 * k) * (1 - eclipse));
      }
    }
  }

  if (eclipse > 0) drawEclipseMoon(f, cx, cy, R, eclipse);
  if (pos.key === 'set' && f.plan.greenFlash) drawGreenFlash(f, cx, cy, R);
  if (pos.key === 'noon' && eclipse > 0.85) tag(f, 'Total solar eclipse', cx, cy, R * 2);
}

const CORONA: RGB = [236, 240, 255];
const ECLIPSE_MOON: RGB = [14, 14, 24];

function drawEclipseMoon(f: Frame, cx: number, cy: number, R: number, cover: number) {
  const { img, cols, rows, u, plan } = f;
  const p = within(u, WINDOWS.noonSun[0], WINDOWS.noonSun[1]);
  const slide = (p - 0.15) / 0.7;
  const mx = cx + (slide - 0.5) * 2 * R * 2.2;
  const totality = smooth(0.85, 1, cover);
  const coronaR = R * 2.6;
  for (let y = Math.max(0, Math.floor(cy - coronaR)); y <= Math.min(rows - 1, cy + coronaR); y++) {
    for (let x = Math.max(0, Math.floor(cx - coronaR)); x <= Math.min(cols - 1, cx + coronaR); x++) {
      const i = (y * cols + x) * 4;
      const dm = Math.hypot(x + 0.5 - mx, y + 0.5 - cy);
      if (dm <= R + 0.4) {
        put(img.data, i, ECLIPSE_MOON);
        continue;
      }
      if (totality <= 0) continue;
      // The corona: streamers of pearly light around the hidden sun.
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= R || d > coronaR) continue;
      const a = Math.atan2(y - cy, x - cx);
      const streamers = 0.6 + 0.4 * Math.sin(a * 5 + plan.n) * Math.sin(a * 3 - 1);
      const k = (1 - (d - R) / (coronaR - R)) * streamers * totality;
      if (k * k > bayer(x, y) * 0.8) blend(img.data, i, CORONA, 0.75);
    }
  }
}

const GREEN: RGB = [120, 255, 150];

// For about a second, the last sliver of the setting sun turns green.
function drawGreenFlash(f: Frame, cx: number, cy: number, R: number) {
  const { img, cols, rows } = f;
  // The sun "sets" as it slips out past the right edge.
  const left = cols - cx; // how much of the disc is still inside, in pixels from its centre
  if (left > -R * 0.45 || left < -R * 0.85) return;
  for (let y = Math.max(0, cy - R); y <= Math.min(rows - 1, cy + R); y++) {
    for (let x = Math.max(0, cols - 4); x < cols; x++) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= R + 0.5) put(img.data, (y * cols + x) * 4, GREEN);
    }
  }
  tag(f, 'Green flash', cols - 2, cy, R);
}

const MOON_LIT: RGB = [240, 238, 222];
const MOON_MARE: RGB = [204, 204, 194];
const MOON_DARK: RGB = [30, 38, 66];
const MOON_GLOW: RGB = [120, 134, 182];
const GHOST_LIT: RGB = [246, 248, 252];
const GHOST_MARE: RGB = [200, 212, 234];
const BLOOD_LIT: RGB = [196, 82, 58];
const BLOOD_MARE: RGB = [150, 56, 44];
const BLOOD_GLOW: RGB = [120, 52, 52];

// phase: 0 = new, 0.5 = full, 1 = new again.
function moonLit(nx: number, ny: number, phase: number) {
  const terminator = Math.cos(phase * Math.PI * 2) * Math.sqrt(Math.max(0, 1 - ny * ny));
  return phase <= 0.5 ? nx > terminator : -nx > terminator;
}

export function drawMoons(f: Frame) {
  const { plan, u } = f;
  const scale = f.scale;
  const R = Math.round(8 * scale);
  if (plan.dayMoon) {
    const p = within(u, WINDOWS.dayMoon[0], WINDOWS.dayMoon[1]);
    if (p >= 0) {
      const [x, y] = flip(cornerArc(plan.dayMoon.rising ? p : 1 - p, MOON_REACH, plan.dayMoon.jitter));
      drawMoon(f, Math.round(x * f.cols), Math.round(y * f.rows), R, true, 0);
      tag(f, 'Daytime moon', x * f.cols, y * f.rows, R * 1.5);
    }
  }
  if (plan.moon) {
    const p = within(u, WINDOWS.moon[0], WINDOWS.moon[1]);
    if (p >= 0) {
      const [x, y] = flip(cornerArc(plan.moon.rising ? p : 1 - p, MOON_REACH, plan.moon.jitter));
      const cx = Math.round(x * f.cols);
      const cy = Math.round(y * f.rows);
      // A total lunar eclipse: Earth's shadow creeps across, turns the moon copper, then leaves.
      const blood = plan.bloodMoon ? p : -1;
      drawMoon(f, cx, cy, R, false, blood);
      f.moon = { x: cx, y: cy, r: R };
      if (plan.bloodMoon && Math.abs(p - 0.5) < 0.3) tag(f, 'Blood moon', cx, cy, R * 1.6);
    }
  }
}

function drawMoon(f: Frame, cx: number, cy: number, radius: number, ghost: boolean, blood: number) {
  const { img, cols, rows, weather, plan } = f;
  const data = img.data;
  const hidden = smooth(0.5, 0.85, weather.cover);
  if (hidden >= 0.98) return;
  const phase = blood >= 0 ? 0.5 : plan.moonPhase;
  // The shadow's centre slides from left of the moon to right of it.
  const umbraX = blood >= 0 ? cx + (blood - 0.5) * radius * 6 : 0;
  const umbraR = radius * 1.45;
  const glowR = ghost ? radius : radius * 2.2;
  for (let y = Math.max(0, Math.floor(cy - glowR)); y <= Math.min(rows - 1, Math.ceil(cy + glowR)); y++) {
    for (let x = Math.max(0, Math.floor(cx - glowR)); x <= Math.min(cols - 1, Math.ceil(cx + glowR)); x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const d = Math.hypot(dx, dy);
      if (d > glowR) continue;
      const threshold = bayer(x, y);
      const i = (y * cols + x) * 4;
      const cover = Math.max(cloudAt(f, x, y) * 0.5, hidden);
      if (d <= radius) {
        const nx = dx / radius;
        const ny = dy / radius;
        const lit = moonLit(nx, ny, phase);
        const mare = valueNoise(nx * 2.2 + 4, ny * 2.2 + 9) > 0.6;
        if (ghost) {
          if (lit && cover < 0.3 && threshold < 0.8) blend(data, i, mare ? GHOST_MARE : GHOST_LIT, 0.85);
        } else if (cover > threshold) {
          blend(data, i, MOON_GLOW, 0.4);
        } else if (!lit) {
          put(data, i, MOON_DARK);
        } else {
          const inShadow = blood >= 0 && Math.hypot(x + 0.5 - umbraX, dy) < umbraR;
          put(data, i, inShadow ? (mare ? BLOOD_MARE : BLOOD_LIT) : mare ? MOON_MARE : MOON_LIT);
        }
      } else if (!ghost) {
        const k = 1 - (d - radius) / (glowR - radius);
        const deep = blood >= 0 && Math.abs(umbraX - cx) < radius * 0.6;
        if (k * k * 0.7 * (1 - cover) > threshold) blend(data, i, deep ? BLOOD_GLOW : MOON_GLOW, 0.35);
      }
    }
  }
}

