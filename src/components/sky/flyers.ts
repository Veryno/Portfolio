import { envelope, since, tag, within, type Frame } from './context';
import type { Balloon, Crossing, Kite } from './plan';
import { dot, hash, lerp3, plot, sprite, valueNoise, type RGB } from './pixel';

// Things that fly across the box: planes, birds, bats, kites, balloons, a blimp,
// and the owl that sometimes crosses the full moon.

function crossingAt(f: Frame, c: Crossing, margin = 10) {
  const elapsed = since(f, c.at);
  if (elapsed > c.seconds) return null;
  const p = elapsed / c.seconds;
  const span = f.cols + margin * 2;
  return {
    p,
    x: Math.round(c.dir > 0 ? -margin + p * span : f.cols + margin - p * span),
    y: Math.round(f.rows * c.y + (p - 0.5) * f.rows * c.slope),
  };
}

// Dark silhouettes by day, nearly black against a dusk sky.
function silhouette(f: Frame): RGB {
  return lerp3([52, 56, 68], [22, 20, 30], Math.min(1, f.mix.stars * 2));
}

const CONTRAIL: RGB = [240, 244, 250];
const NAV_RED: RGB = [255, 70, 70];
const NAV_GREEN: RGB = [90, 255, 130];
const STROBE: RGB = [255, 255, 255];
const PLANE_LOW = ['...#..', '#..##.', '######', '...#..'];

export function drawPlanes(f: Frame) {
  const night = f.mix.stars > 0.35;
  for (const plane of f.plan.planes) {
    const at = crossingAt(f, plane, 40);
    if (!at) continue;
    const { img } = f;
    const dir = plane.dir;
    const slopeStep = (f.rows * plane.slope) / (f.cols + 80);
    if (night) {
      // Blinking lights only: red and green wingtips, a white strobe, a red beacon.
      const blink = (f.sec * 1.1 + plane.seed) % 1;
      plot(img, at.x, at.y - 1, NAV_RED, 0.95);
      plot(img, at.x, at.y + 1, NAV_GREEN, 0.95);
      if (blink < 0.08) plot(img, at.x - dir * 2, at.y, STROBE, 1);
      if ((blink + 0.5) % 1 < 0.12) plot(img, at.x + dir, at.y, NAV_RED, 0.8);
      continue;
    }
    const body = silhouette(f);
    if (plane.high) {
      // High and tiny, drawing a contrail that lingers on humid days.
      plot(img, at.x, at.y, body, 0.9);
      plot(img, at.x - dir, at.y, body, 0.7);
      const humid = f.weather.cover > 0.12 || f.weather.haze > 0.2;
      const len = (humid ? 80 : 16) * f.scale;
      const travelled = at.p * (f.cols + 80);
      for (let s = 2; s < Math.min(len, travelled); s++) {
        const fade = (1 - s / len) * 0.75;
        const x = Math.round(at.x - dir * s);
        const y = Math.round(at.y - slopeStep * s * dir);
        plot(img, x, y, CONTRAIL, fade);
        if (s > len * 0.35) dot(img, x, y + 1, CONTRAIL, fade, 0.5);
      }
    } else {
      sprite(img, at.x - 3, at.y - 2, PLANE_LOW, { '#': body }, 0.9, dir < 0);
    }
  }
}

const BIRD_UP = ['#.#', '.#.'];
const BIRD_DOWN = ['.#.', '#.#'];

function bird(f: Frame, x: number, y: number, phase: number, color: RGB, amount = 0.9) {
  sprite(f.img, x - 1, y - 1, Math.floor(phase) % 2 ? BIRD_UP : BIRD_DOWN, { '#': color }, amount);
}

export function drawBirds(f: Frame) {
  const { plan, t } = f;
  const color = silhouette(f);
  for (const flock of plan.flocks) {
    const at = crossingAt(f, flock, 20);
    if (!at) continue;
    const count = 3 + (flock.seed % 6);
    for (let k = 0; k < count; k++) {
      const dx = (hash(flock.seed, k) - 0.5) * 28 + Math.sin(t * 1.3 + k) * 1.5;
      const dy = (hash(flock.seed, k + 50) - 0.5) * 12 + Math.cos(t * 1.1 + k * 2) * 1.2;
      bird(f, Math.round(at.x + dx), Math.round(at.y + dy), t * 6 + k * 0.7, color);
    }
  }
  if (plan.vee) {
    const at = crossingAt(f, plan.vee, 40);
    if (at) {
      // Geese in a V, the leader out front.
      const count = 9 + (plan.vee.seed % 5);
      for (let k = 0; k < count; k++) {
        const rank = Math.ceil(k / 2);
        const side = k % 2 ? -1 : 1;
        const x = at.x - plan.vee.dir * rank * 4;
        const y = at.y + side * rank * 2.4 + Math.sin(t * 2 + k) * 0.6;
        bird(f, Math.round(x), Math.round(y), t * 3.5 + k * 0.4, color);
      }
      tag(f, 'Geese flying south', at.x, at.y, 14);
    }
  }
}

const STARLING: RGB = [26, 24, 34];

// Hundreds of starlings wheeling together into a shape-shifting cloud at dusk.
export function drawMurmuration(f: Frame) {
  const span = f.plan.murmuration;
  if (!span) return;
  const p = within(f.u, span.from, span.to);
  if (p < 0) return;
  const { cols, rows, t } = f;
  const amount = envelope(p, 0.15);
  const s = span.seed % 1000;
  const cx = cols * (0.5 + 0.22 * Math.sin(t * 0.13 + s));
  const cy = rows * (0.42 + 0.08 * Math.cos(t * 0.1 + s));
  const R = rows * 0.13;
  for (let k = 0; k < 240; k++) {
    const a = hash(k, s) * Math.PI * 2;
    const reach = R * (1 + 0.38 * Math.sin(a * 2 + t * 0.55) + 0.26 * Math.sin(a * 3 - t * 0.42));
    const r = Math.sqrt(hash(k, s + 1)) * reach;
    const x = cx + Math.cos(a) * r * 1.6 + (valueNoise(k * 0.1, t * 0.4) - 0.5) * 10;
    const y = cy + Math.sin(a) * r * 0.8 + (valueNoise(k * 0.1 + 40, t * 0.4) - 0.5) * 6;
    plot(f.img, Math.round(x), Math.round(y), STARLING, 0.75 * amount);
  }
  tag(f, 'Starling murmuration', cx, cy, R * 1.4);
}

export function drawBats(f: Frame) {
  const span = f.plan.bats;
  if (!span) return;
  const p = within(f.u, span.from, span.to);
  if (p < 0) return;
  const { cols, rows, t } = f;
  const amount = envelope(p, 0.15);
  const s = span.seed % 1000;
  for (let k = 0; k < 5; k++) {
    const x = cols * (0.12 + 0.76 * valueNoise(t * 0.35 + k * 7.3, s + k)) + Math.sin(t * 9 + k) * 1.5;
    const y = rows * (0.5 + 0.32 * valueNoise(t * 0.5 + k * 3.1, s + k + 11)) + Math.cos(t * 11 + k) * 1.5;
    bird(f, Math.round(x), Math.round(y), t * 14 + k, [20, 16, 26], 0.9 * amount);
  }
}

const KITE_COLORS: [RGB, RGB][] = [
  [[224, 44, 52], [150, 24, 32]],
  [[246, 198, 40], [176, 128, 18]],
  [[60, 122, 224], [30, 70, 150]],
  [[62, 176, 96], [30, 110, 60]],
];
const KITE = ['..a..', '.aba.', 'abbba', '.aba.', '..a..'];
const STRING: RGB = [228, 228, 232];

// Diamond kites bobbing on the breeze, tails waving and strings running down out of view.
export function drawKites(f: Frame) {
  const { plan, cols, rows, t, weather } = f;
  if (!plan.kites.length) return;
  const p = within(f.u, 0.02, 0.25);
  if (p < 0) return;
  const lean = weather.windDir * (4 + weather.wind * 6);
  plan.kites.forEach((kite: Kite) => {
    const s = kite.seed % 1000;
    const x = Math.round(kite.x * cols + Math.sin(t * 0.7 + s) * 4 + (valueNoise(t * 0.4, s) - 0.5) * 8 - lean);
    const y = Math.round(kite.y * rows + Math.cos(t * 0.9 + s) * 2.5);
    const [main, dark] = KITE_COLORS[kite.color % KITE_COLORS.length];
    // The string sags from the kite down to someone below the box.
    const groundX = x + lean * 6;
    const steps = rows - y;
    for (let k = 3; k < steps; k += 2) {
      const q = k / steps;
      const sx = Math.round(x + (groundX - x) * q - Math.sin(q * Math.PI) * lean);
      plot(f.img, sx, y + k, STRING, 0.45);
    }
    // The tail waves downwind in a lazy S, with little bows along it.
    for (let k = 0; k < 14; k++) {
      const tx = Math.round(x + 2 - (k * lean) / 12 + Math.sin(k * 0.7 - t * 5) * 2 * (k / 14));
      const ty = y + 5 + k;
      plot(f.img, tx, ty, k % 3 === 2 ? main : STRING, 0.8);
      if (k % 3 === 2) plot(f.img, tx + 1, ty, main, 0.8);
    }
    sprite(f.img, x, y, KITE, { a: main, b: dark }, 0.95);
  });
}

const BALLOON_COLORS: [RGB, RGB][] = [
  [[230, 62, 62], [250, 212, 72]],
  [[62, 122, 224], [242, 242, 242]],
  [[82, 182, 102], [250, 152, 52]],
  [[160, 82, 202], [250, 202, 230]],
];
const BASKET: RGB = [126, 84, 52];

function hotAirBalloon(f: Frame, cx: number, cy: number, R: number, colors: [RGB, RGB]) {
  const { img } = f;
  for (let dy = -R; dy <= R * 1.3; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      const inside = dy <= 0 ? Math.hypot(dx, dy) <= R : Math.abs(dx) <= R * (1 - dy / (R * 1.35));
      if (!inside) continue;
      const stripe = Math.floor((dx + R) / Math.max(1.5, R / 2.4)) % 2;
      let c = colors[stripe];
      if (dx > R * 0.35) c = lerp3(c, [0, 0, 0], 0.18); // shade the far side
      plot(img, cx + dx, cy + dy, c, 1);
    }
  }
  const by = Math.round(cy + R * 1.35 + 2);
  plot(img, cx - 1, by - 1, BASKET, 0.6);
  plot(img, cx + 1, by - 1, BASKET, 0.6);
  for (let dx = -1; dx <= 1; dx++) for (let dy = 0; dy <= 1; dy++) plot(img, cx + dx, by + dy, BASKET, 1);
}

// Striped balloons drifting slowly up on a calm morning.
export function drawHotAir(f: Frame) {
  const { plan, cols, rows, weather } = f;
  if (!plan.hotAir.length) return;
  const p = within(f.u, 0.77, 0.99);
  if (p < 0) return;
  plan.hotAir.forEach((b: Balloon, k: number) => {
    const R = Math.max(3, Math.round(6 * b.size * f.scale));
    const rise = Math.min(1, p * (0.9 + k * 0.15));
    const cx = Math.round(b.x * cols + rise * 18 * weather.windDir + Math.sin(f.t * 0.3 + k) * 1.5);
    const cy = Math.round(rows * (1.12 - rise * (0.75 + b.size * 0.2)));
    hotAirBalloon(f, cx, cy, R, BALLOON_COLORS[b.colors % BALLOON_COLORS.length]);
  });
}

const PARTY: RGB[] = [[232, 40, 52], [250, 200, 40], [60, 140, 240], [80, 200, 110], [240, 110, 200], [250, 140, 40]];
const SHINE: RGB = [255, 240, 240];

function partyBalloon(f: Frame, x: number, y: number, color: RGB, stringTo?: [number, number]) {
  const { img } = f;
  sprite(img, x - 1, y - 2, ['.#.', '###', '###', '.#.'], { '#': color }, 1);
  plot(img, x - 1, y - 1, SHINE, 0.7);
  if (stringTo) {
    const [sx, sy] = stringTo;
    const steps = Math.max(1, Math.round(Math.hypot(sx - x, sy - y)));
    for (let k = 3; k <= steps; k++) plot(img, Math.round(x + ((sx - x) * k) / steps), Math.round(y + 2 + ((sy - y - 2) * k) / steps), STRING, 0.5);
  } else {
    for (let k = 0; k < 5; k++) plot(img, x + Math.round(Math.sin(f.t * 4 + k) * 0.6), y + 2 + k, STRING, 0.5);
  }
}

function rising(f: Frame, c: Crossing) {
  const elapsed = since(f, c.at);
  if (elapsed > c.seconds) return null;
  const p = elapsed / c.seconds;
  const x0 = f.cols * (0.15 + (c.seed % 70) / 100);
  return {
    x: Math.round(x0 + p * 20 * f.weather.windDir + Math.sin(p * 9) * 3),
    y: Math.round(f.rows * (1.06 - p * 1.2)),
  };
}

export function drawBalloons(f: Frame) {
  const { plan } = f;
  if (plan.partyBalloon) {
    const at = rising(f, plan.partyBalloon);
    if (at) {
      partyBalloon(f, at.x, at.y, PARTY[0]);
      tag(f, 'Lost balloon', at.x, at.y, 5);
    }
  }
  if (plan.balloonBunch) {
    const at = rising(f, plan.balloonBunch);
    if (at) {
      const knot: [number, number] = [at.x, at.y + 12];
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2;
        partyBalloon(f, Math.round(at.x + Math.cos(a) * 4), Math.round(at.y + Math.sin(a) * 3), PARTY[k % PARTY.length], knot);
      }
      tag(f, 'Balloon bunch', at.x, at.y, 8);
    }
  }
}

const BLIMP = [
  '.....aaaaaaa....',
  '..aaaaaaaaaaaa.c',
  '.aaaaaaaaaaaaaac',
  'aaabbbbbbbbbbbbc',
  '.bbbbbbbbbbbbb.c',
  '..bbbbbbbbbbb...',
  '......ddd.......',
];

export function drawBlimp(f: Frame) {
  const c = f.plan.blimp;
  if (!c) return;
  const at = crossingAt(f, c, 20);
  if (!at) return;
  sprite(f.img, at.x - 8, at.y - 3, BLIMP, { a: [182, 186, 194], b: [146, 150, 160], c: [120, 124, 134], d: [80, 82, 92] }, 1, c.dir > 0);
  tag(f, 'Blimp', at.x, at.y, 9);
}

const OWL_UP = ['#.....#', '##.#.##', '..###..'];
const OWL_DOWN = ['..###..', '##.#.##', '#.....#'];

// A tiny owl silhouette gliding across the face of the full moon.
export function drawOwl(f: Frame) {
  const span = f.plan.owl;
  if (!span || !f.moon) return;
  const p = within(f.u, span.from, span.to);
  if (p < 0) return;
  const { moon, t } = f;
  const x = Math.round(moon.x - moon.r * 3 + p * moon.r * 6);
  const y = Math.round(moon.y + Math.sin(p * Math.PI * 2) * 2);
  sprite(f.img, x - 3, y - 1, Math.floor(t * 5) % 2 ? OWL_UP : OWL_DOWN, { '#': [10, 10, 16] }, 1);
  tag(f, 'Owl across the moon', x, y, 6);
}
