import { CONSTELLATIONS } from './constellations';
import { cloudAt, envelope, since, tag, within, type Frame } from './context';
import type { Crossing } from './plan';
import { STAR, STAR_DIM, bayer, blend, dot, hash, lerp3, plot, smooth, valueNoise, type RGB } from './pixel';

// The night sky: the featured constellation, planets, the Milky Way, the northern
// lights, comets, shooting stars and meteor showers, satellites, the Starlink train
// and the ISS.

const STAR_BRIGHT: RGB = [255, 252, 238];
const LINE: RGB = [150, 172, 232];

// A twinkling background star at sky pixel (x, y), or null. More of them come out
// as amount rises toward full night.
export function starAt(x: number, y: number, t: number, amount: number): RGB | null {
  if (hash(x * 7 + 3, y * 13 + 5) >= 0.006) return null;
  const twinkle = 0.5 + 0.5 * Math.sin(t * (1.2 + hash(x, y + 77) * 2.5) + hash(x + 9, y) * Math.PI * 2);
  if (amount * (0.35 + 0.65 * twinkle) <= hash(x + 31, y + 41) * 0.5 + 0.35) return null;
  return twinkle > 0.6 ? STAR : STAR_DIM;
}

// The featured constellation, in the upper half of the sky, drifting with the stars.
export function drawConstellation(f: Frame) {
  const night = f.mix.stars;
  if (night < 0.15) return;
  const { img, cols, rows, t, plan } = f;
  const c = CONSTELLATIONS[plan.constellation];
  const size = Math.min(cols, rows) * 0.52;
  const ox = cols * 0.5 - size / 2 - f.starShift * 0.4 + ((plan.base % 7) - 3) * 2;
  const oy = rows * 0.08;
  const pts = c.stars.map(([x, y]) => [Math.round(ox + x * size), Math.round(oy + y * size)] as const);

  if (plan.lines) {
    const p = within(f.u, plan.lines.from, plan.lines.to);
    if (p >= 0) {
      // Lines draw in one after another, hold, then fade away.
      const drawn = Math.min(1, p / 0.4) * c.lines.length;
      const fade = p > 0.8 ? (1 - p) / 0.2 : 1;
      c.lines.forEach(([a, b], k) => {
        if (k >= drawn) return;
        const part = Math.min(1, drawn - k);
        const [x0, y0] = pts[a];
        const [x1, y1] = pts[b];
        const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * part);
        for (let s = 2; s < steps - 1; s += 2) {
          const q = s / Math.hypot(x1 - x0, y1 - y0);
          const x = Math.round(x0 + (x1 - x0) * q);
          const y = Math.round(y0 + (y1 - y0) * q);
          plot(img, x, y, LINE, 0.55 * fade * night * (1 - cloudAt(f, x, y)));
        }
      });
      tag(f, c.name, ox + size / 2, oy + size / 2, size / 2);
    }
  }

  c.stars.forEach(([, , mag], k) => {
    const [x, y] = pts[k];
    const clear = night * (1 - cloudAt(f, x, y));
    if (clear < 0.05) return;
    const twinkle = 0.78 + 0.22 * Math.sin(t * (1.5 + (k % 5) * 0.4) + k * 2.1);
    const a = clear * twinkle;
    if (mag <= 0.6) {
      plot(img, x, y, STAR_BRIGHT, a);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) plot(img, x + dx, y + dy, STAR_BRIGHT, a * 0.55);
    } else if (mag <= 1.9) {
      plot(img, x, y, STAR_BRIGHT, a);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) plot(img, x + dx, y + dy, STAR, a * 0.2);
    } else {
      plot(img, x, y, mag <= 3.2 ? STAR : STAR_DIM, a * (mag <= 3.2 ? 0.95 : 0.75));
    }
  });
}

const VENUS: RGB = [255, 250, 228];
const JUPITER: RGB = [255, 238, 206];
const MARS: RGB = [255, 146, 104];

function steadyLight(f: Frame, x: number, y: number, color: RGB, amount: number, big: boolean) {
  // Bright enough to shine through thin cloud.
  const vis = amount * (1 - cloudAt(f, x, y) * 0.6);
  if (vis <= 0.03) return;
  plot(f.img, x, y, color, vis);
  if (big) {
    plot(f.img, x + 1, y, color, vis);
    plot(f.img, x, y + 1, color, vis * 0.85);
    plot(f.img, x + 1, y + 1, color, vis * 0.85);
    for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [1, -1], [-1, 1], [2, 1], [0, 2], [1, 2]]) plot(f.img, x + dx, y + dy, color, vis * 0.25);
  }
}

// Planets shine steadily without twinkling. Venus hangs low near the sun at dusk or dawn.
export function drawPlanets(f: Frame) {
  const { plan, u, cols, rows } = f;
  const clear = 1 - smooth(0.4, 0.75, f.weather.cover);
  if (plan.venusEve) {
    const p = within(u, 0.4, 0.55);
    if (p >= 0) {
      const x = Math.round(cols * 0.78);
      const y = Math.round(rows * (0.46 + p * 0.22));
      steadyLight(f, x, y, VENUS, envelope(p, 0.15) * clear, true);
      tag(f, 'Venus', x, y, 4);
    }
  }
  if (plan.venusMorn) {
    const p = within(u, 0.66, 0.8);
    if (p >= 0) {
      const x = Math.round(cols * 0.22);
      const y = Math.round(rows * (0.68 - p * 0.22));
      steadyLight(f, x, y, VENUS, envelope(p, 0.15) * clear, true);
      tag(f, 'Venus', x, y, 4);
    }
  }
  const night = f.mix.stars;
  if (night > 0.2) {
    if (plan.jupiter) {
      const x = Math.round(plan.jupiter.x * cols - f.starShift * 0.4);
      const y = Math.round(plan.jupiter.y * rows);
      steadyLight(f, x, y, JUPITER, night * 0.95, true);
      tag(f, 'Jupiter', x, y, 4);
    }
    if (plan.mars) {
      const x = Math.round(plan.mars.x * cols - f.starShift * 0.4);
      const y = Math.round(plan.mars.y * rows);
      steadyLight(f, x, y, MARS, night * 0.9, false);
      plot(f.img, x + 1, y, MARS, night * 0.5);
      tag(f, 'Mars', x, y, 3);
    }
  }
}

const MILKY: RGB = [96, 108, 156];
const MILKY_STAR: RGB = [190, 198, 230];

// A grainy band of faint stars across a clear, moonless sky.
export function drawMilkyWay(f: Frame) {
  if (!f.plan.milkyWay) return;
  const night = f.mix.stars;
  if (night < 0.4) return;
  const { img, cols, rows, plan } = f;
  const angle = 0.35 + (plan.base % 100) / 100 * 0.5;
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const cx = cols * 0.5 - f.starShift * 0.4;
  const cy = rows * 0.42;
  const width = rows * 0.14;
  const amount = (night - 0.4) / 0.6 * (1 - f.weather.cover);
  const data = img.data;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.abs((x - cx) * nx + (y - cy) * ny);
      if (d > width) continue;
      const along = (x - cx) * ny - (y - cy) * nx;
      // Brighter in the middle, broken up by clumps and a dark dust lane.
      const clump = valueNoise(along * 0.06 + 3, d * 0.05) * 0.6 + valueNoise(along * 0.18, d * 0.2 + 9) * 0.4;
      const lane = Math.abs(d - width * 0.12) < width * 0.08 ? 0.45 : 1;
      const g = (1 - (d / width) ** 2) * clump * lane * amount * (1 - cloudAt(f, x, y));
      if (g * 1.3 > bayer(x, y)) blend(data, (y * cols + x) * 4, MILKY, 0.42);
      if (hash(x + 9000 + Math.floor(f.starShift * 0.4), y * 3 + 11) < 0.09 * g) plot(img, x, y, MILKY_STAR, 0.8);
    }
  }
  tag(f, 'Milky Way', cx, cy, width);
}

const COMET_HEAD: RGB = [236, 248, 255];
const ION_TAIL: RGB = [170, 214, 255];
const DUST_TAIL: RGB = [255, 236, 196];

export function drawComet(f: Frame) {
  const comet = f.plan.comet;
  if (!comet) return;
  const vis = Math.min(1, f.mix.stars * 1.3) * (1 - smooth(0.45, 0.8, f.weather.cover));
  if (vis <= 0.05) return;
  const { img, cols, rows } = f;
  const hx = comet.x * cols - f.starShift * 0.4;
  const hy = comet.y * rows;
  const len = comet.length * cols;
  const dirX = Math.cos(comet.angle);
  const dirY = Math.sin(comet.angle);
  for (let s = 1; s < len; s++) {
    const w = 1 + s * 0.16;
    for (let o = -Math.ceil(w); o <= w; o++) {
      const k = (1 - s / len) * (1 - Math.abs(o) / (w + 1)) * vis;
      // A straight bluish ion tail and a broader, curving yellowish dust tail.
      const bend = (s / len) ** 2 * len * 0.25;
      dot(img, Math.round(hx + dirX * s - dirY * o), Math.round(hy + dirY * s + dirX * o), ION_TAIL, k * 0.9, 0.5);
      dot(img, Math.round(hx + dirX * s - dirY * (o + bend)), Math.round(hy + dirY * s + dirX * (o + bend)), DUST_TAIL, k * 0.6, 0.4);
    }
  }
  const x = Math.round(hx);
  const y = Math.round(hy);
  plot(img, x, y, COMET_HEAD, vis);
  plot(img, x + 1, y, COMET_HEAD, vis * 0.7);
  plot(img, x, y + 1, COMET_HEAD, vis * 0.7);
  for (const [dx, dy] of [[-1, 0], [0, -1], [1, 1], [2, 0], [0, 2]]) plot(img, x + dx, y + dy, COMET_HEAD, vis * 0.3);
  tag(f, 'Comet', x, y, 6);
}

// A shooting star at progress p: a bright head with a dithered tail that grows, then fades.
function drawStreak(f: Frame, sx: number, sy: number, dirX: number, dirY: number, dist: number, p: number, length = 22, color: RGB = STAR) {
  const { img } = f;
  const travelled = dist * p;
  const hx = sx + dirX * travelled;
  const hy = sy + dirY * travelled;
  const len = Math.min(length, travelled);
  const alpha = Math.min(1, Math.sin(Math.PI * Math.min(1, p)) * 1.5);
  for (let i = 0; i <= len; i++) {
    const x = Math.round(hx - dirX * i);
    const y = Math.round(hy - dirY * i);
    const k = (1 - i / (len + 1)) * alpha;
    if (i < 3 || k > 0.6) plot(img, x, y, color, alpha);
    else if (k > bayer(x, y) * 0.8) plot(img, x, y, STAR_DIM, 0.9);
  }
  return { x: hx, y: hy };
}

function seededStreak(f: Frame, seed: number, p: number) {
  const dir = hash(seed, 505) < 0.5 ? 1 : -1;
  const slope = 0.3 + hash(seed, 506) * 0.35;
  const norm = Math.hypot(1, slope);
  return drawStreak(f, f.cols * (0.05 + hash(seed, 503) * 0.9), f.rows * hash(seed, 504) * 0.55, dir / norm, slope / norm, (40 + hash(seed, 507) * 30) * Math.hypot(1, slope), p);
}

const FIREBALL: RGB = [200, 255, 210];

export function drawMeteors(f: Frame) {
  const { plan, cols, rows } = f;
  const night = f.mix.stars;
  if (night < 0.2) return;
  for (const s of plan.streaks) {
    const elapsed = since(f, s.at);
    if (elapsed < 0.9) {
      const head = seededStreak(f, s.seed, elapsed / 0.9);
      tag(f, 'Shooting star', head.x, head.y, 8);
    }
  }
  if (plan.meteorShower && within(f.u, 0.5, 0.72) >= 0) {
    // During a shower, meteors streak out from one point in the sky every second or two.
    const slotLength = 1.4;
    const now = Math.floor(f.sec / slotLength);
    const rx = plan.meteorShower.x * cols;
    const ry = plan.meteorShower.y * rows;
    for (let slot = now - 1; slot <= now; slot++) {
      if (hash(slot & 0xfffff, 911) > 0.75) continue;
      const start = slot * slotLength + hash(slot & 0xfffff, 912) * 0.8;
      const p = (f.sec - start) / 0.7;
      if (p < 0 || p > 1) continue;
      const sx = cols * (0.1 + hash(slot & 0xfffff, 913) * 0.8);
      const sy = rows * (0.05 + hash(slot & 0xfffff, 914) * 0.5);
      const dx = sx - rx;
      const dy = sy - ry;
      const d = Math.hypot(dx, dy) || 1;
      drawStreak(f, sx, sy, dx / d, dy / d, 30 + hash(slot & 0xfffff, 915) * 30, p, 14);
    }
    tag(f, 'Meteor shower', rx + cols * 0.15, ry + rows * 0.15, cols * 0.2);
  }
  if (plan.fireball) {
    const elapsed = since(f, plan.fireball.at);
    if (elapsed < 2.2) {
      const p = elapsed / 2.2;
      const seed = plan.fireball.seed;
      const dir = hash(seed, 1) < 0.5 ? 1 : -1;
      const head = drawStreak(f, cols * (dir > 0 ? 0.1 : 0.9), rows * (0.1 + hash(seed, 2) * 0.2), dir * 0.9, 0.44, cols * 0.75, p, 34, FIREBALL);
      const x = Math.round(head.x);
      const y = Math.round(head.y);
      const a = Math.sin(Math.PI * p);
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 0], [0, -1]]) plot(f.img, x + dx, y + dy, FIREBALL, a * 0.8);
      // It breaks apart into sparks near the end.
      if (p > 0.75) for (let k = 0; k < 6; k++) plot(f.img, x - Math.round(dir * (2 + k * 2)), y + Math.round((hash(seed, 10 + k) - 0.5) * 6), STAR, (1 - p) * 4 * a);
      tag(f, 'Fireball', head.x, head.y, 8);
    }
  }
}

function crossingAt(f: Frame, c: Crossing) {
  const elapsed = since(f, c.at);
  if (elapsed > c.seconds) return null;
  const p = elapsed / c.seconds;
  const span = f.cols + 16;
  const x = c.dir > 0 ? -8 + p * span : f.cols + 8 - p * span;
  const y = f.rows * c.y + (p - 0.5) * f.rows * c.slope;
  return { p, x: Math.round(x), y: Math.round(y) };
}

const SATELLITE: RGB = [196, 202, 222];

export function drawSatellites(f: Frame) {
  const night = f.mix.stars;
  if (night < 0.3) return;
  const { plan } = f;
  for (const s of plan.satellites) {
    const at = crossingAt(f, s);
    if (at) plot(f.img, at.x, at.y, SATELLITE, night * 0.7 * (1 - cloudAt(f, at.x, at.y)));
  }
  if (plan.flare) {
    const at = crossingAt(f, plan.flare);
    if (at) {
      // An Iridium-style flare: the glint swells for a second, then fades.
      const glint = Math.exp(-(((at.p - 0.5) / 0.07) ** 2));
      plot(f.img, at.x, at.y, STAR_BRIGHT, night * (0.6 + 0.4 * glint));
      if (glint > 0.3) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) plot(f.img, at.x + dx, at.y + dy, STAR_BRIGHT, night * glint * 0.8);
      if (glint > 0.2) tag(f, 'Satellite flare', at.x, at.y, 6);
    }
  }
  if (plan.starlink) {
    const at = crossingAt(f, plan.starlink);
    if (at) {
      // A line of evenly spaced satellites travelling together.
      const dirX = plan.starlink.dir;
      const dirY = plan.starlink.slope / Math.max(1, f.cols / f.rows);
      for (let k = 0; k < 14; k++) {
        const x = Math.round(at.x - dirX * k * 5);
        const y = Math.round(at.y - dirY * k * 5 * 0.2);
        plot(f.img, x, y, SATELLITE, night * 0.75 * (1 - cloudAt(f, x, y)));
      }
      tag(f, 'Starlink train', at.x - dirX * 30, at.y, 30);
    }
  }
}

const ISS_LIGHT: RGB = [255, 250, 232];
const ISS_SHADOW: RGB = [255, 176, 140];
const ISS_PANEL: RGB = [206, 196, 160];
const ISS_TRUSS: RGB = [222, 226, 234];

// The ISS: a small but recognisable station with solar panels and a soft glow. It
// shines steadily, and on some passes it fades orange and vanishes mid-sky as it
// slips into Earth's shadow, like the real thing.
export function drawIss(f: Frame) {
  const iss = f.plan.iss;
  if (!iss) return;
  const at = crossingAt(f, iss);
  if (!at) return;
  const shadowAt = iss.fades ? 0.62 : 2;
  const b = at.p > shadowAt ? Math.max(0, 1 - (at.p - shadowAt) / 0.12) : 1;
  if (b <= 0) return;
  const { img } = f;
  const c = lerp3(ISS_SHADOW, ISS_LIGHT, b);
  const { x, y } = at;
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -6; dx <= 6; dx++) {
      const d = Math.hypot(dx / 1.5, dy);
      if (d > 4.2 || d < 1.2) continue;
      dot(img, x + dx, y + dy, c, (1 - d / 4.2) * b * 0.8, 0.28);
    }
  }
  for (const dx of [-4, -3, -2, 2, 3, 4]) for (const dy of [-1, 0, 1]) plot(img, x + dx, y + dy, ISS_PANEL, 0.9 * b);
  plot(img, x - 1, y, ISS_TRUSS, 0.9 * b);
  plot(img, x + 1, y, ISS_TRUSS, 0.9 * b);
  plot(img, x, y - 1, c, 0.85 * b);
  plot(img, x, y + 1, c, 0.85 * b);
  plot(img, x, y, c, b);
  tag(f, 'ISS', x, y, 8);
}
