import { clamp, fbm1, hash, lerp3, mixN, smooth, vnoise1, type RGB } from './pixel';
import type { SkyMix } from './phases';

// Weather runs on its own internal timeline. Each 3-minute day splits into four
// stretches (midday, evening, night, morning) and every stretch's weather comes
// from slow noise over its stretch number on the shared clock. That keeps it the
// same for every visitor, continuous from one stretch to the next (a clear day
// never jumps straight to a downpour), and free of any real calendar: cold and
// warm spells simply come and go every hour or so.

export type Condition = 'clear' | 'fair' | 'partly' | 'mostly' | 'overcast' | 'drizzle' | 'rain' | 'storm' | 'fog';

// Where each stretch starts and ends, as a fraction of the day (lined up with phases.ts).
export const STRETCH_BOUNDS = [0, 0.27, 0.47, 0.73, 1];
export const MIDDAY = 0;
export const EVENING = 1;
export const NIGHT = 2;
export const MORNING = 3;

export type Stretch = {
  g: number;          // stretch number on the shared clock (day * 4 + stretch)
  condition: Condition;
  snow: boolean;      // precipitation falls as snow
  hail: boolean;
  cold: number;       // 0 mild .. 1 freezing
  warm: number;       // 0 mild .. 1 hot
  wind: number;       // 0 calm .. 1 windy
  windDir: 1 | -1;    // which way the clouds travel
  haze: number;       // high, thin ice cloud: halos, sun dogs and pillars
};

// Cover thresholds, set from the noise's own spread so roughly: clear 16%, fair 18%,
// partly cloudy 20%, mostly cloudy 14%, overcast 11%, drizzle 9%, rain 12%.
const COVER_LEVELS: [number, Condition][] = [
  [0.32, 'clear'],
  [0.422, 'fair'],
  [0.519, 'partly'],
  [0.588, 'mostly'],
  [0.647, 'overcast'],
  [0.704, 'drizzle'],
];
const ORDER: Condition[] = ['clear', 'fair', 'partly', 'mostly', 'overcast', 'drizzle', 'rain', 'storm'];
// Evenings run a touch cloudier and nights clearer.
const DIURNAL = [0, 0.02, -0.05, 0];
// Instability a storm needs in each stretch: the afternoon heat makes evening storms
// the most common, and mornings never start with one.
const STORM_AT = [0.82, 0.74, 0.84, 2];
const COLD_BELOW = 0.38;
const WARM_ABOVE = 0.57;

export const isWet = (c: Condition) => c === 'drizzle' || c === 'rain' || c === 'storm';
export const isClearish = (c: Condition) => c === 'clear' || c === 'fair';
export const rank = (c: Condition) => (c === 'fog' ? 2 : ORDER.indexOf(c));

function cover(g: number) {
  return fbm1(g * 0.11, 101) + DIURNAL[g & 3];
}

function rawStorm(g: number) {
  return vnoise1(g * 0.45, 202) > STORM_AT[g & 3] && cover(g) > 0.422;
}

// Storms blow through within two stretches.
function stormAt(g: number) {
  return rawStorm(g) && !(rawStorm(g - 1) && rawStorm(g - 2));
}

function byCover(c: number): Condition {
  for (const [limit, condition] of COVER_LEVELS) if (c < limit) return condition;
  return 'rain';
}

function baseCondition(g: number): Condition {
  if (stormAt(g)) return 'storm';
  // After a storm the sky breaks up.
  return byCover(stormAt(g - 1) ? Math.min(cover(g), 0.5) : cover(g));
}

function conditionAt(g: number): Condition {
  const base = baseCondition(g);
  // Fog forms by morning after a calm, clear night, or after rain, if the air is damp.
  if ((g & 3) === MORNING && rank(base) <= 3) {
    const damp = vnoise1(g * 0.3, 707);
    const calm = fbm1(g * 0.2, 404) < 0.548;
    const afterRain = isWet(baseCondition(g - 1));
    if (calm && ((rank(base) <= 2 && damp > 0.578) || (afterRain && damp > 0.5))) return 'fog';
  }
  return base;
}

export function stretchAt(g: number): Stretch {
  const condition = conditionAt(g);
  const temp = fbm1(g * 0.035, 303);
  let wind = clamp((fbm1(g * 0.2, 404) - 0.33) / 0.38);
  if (condition === 'storm') wind = Math.max(wind, 0.85);
  if (condition === 'fog') wind = Math.min(wind, 0.15);
  const wet = isWet(condition);
  return {
    g,
    condition,
    snow: wet && temp < COLD_BELOW,
    hail: condition === 'storm' && temp >= COLD_BELOW && hash(g & 0xfffff, 808) < 0.3,
    cold: smooth(COLD_BELOW + 0.05, COLD_BELOW - 0.05, temp),
    warm: smooth(WARM_ABOVE - 0.04, WARM_ABOVE + 0.06, temp),
    wind,
    windDir: vnoise1(g * 0.05, 505) > 0.5 ? 1 : -1,
    haze: rank(condition) <= 2 ? smooth(0.72, 0.8, vnoise1(g * 0.25, 606)) : 0,
  };
}

export function stretchOf(u: number) {
  return u < STRETCH_BOUNDS[1] ? MIDDAY : u < STRETCH_BOUNDS[2] ? EVENING : u < STRETCH_BOUNDS[3] ? NIGHT : MORNING;
}

// What a condition looks like, before blending.
const LOOK: Record<Condition, { cover: number; precip: number; storm: number; fog: number; dark: number }> = {
  clear: { cover: 0.02, precip: 0, storm: 0, fog: 0, dark: 0 },
  fair: { cover: 0.16, precip: 0, storm: 0, fog: 0, dark: 0 },
  partly: { cover: 0.34, precip: 0, storm: 0, fog: 0, dark: 0 },
  mostly: { cover: 0.55, precip: 0, storm: 0, fog: 0, dark: 0.04 },
  overcast: { cover: 0.78, precip: 0, storm: 0, fog: 0, dark: 0.1 },
  drizzle: { cover: 0.82, precip: 0.35, storm: 0, fog: 0, dark: 0.16 },
  rain: { cover: 0.9, precip: 0.75, storm: 0, fog: 0, dark: 0.34 },
  storm: { cover: 0.95, precip: 1, storm: 1, fog: 0, dark: 0.62 },
  fog: { cover: 0.3, precip: 0, storm: 0, fog: 1, dark: 0 },
};

// The weather as it looks at one moment: the current stretch blended into the next
// over the last fifth of it, so clouds build and rain sets in gradually.
export type SkyWeather = {
  now: Stretch;
  next: Stretch;
  prev: Stretch;
  stretch: number;
  into: number;     // 0..1 how far the change to the next stretch has got
  cover: number;    // 0 clear .. 1 solid cloud
  rain: number;
  snow: number;
  hail: number;
  storm: number;    // lightning activity
  fog: number;
  dark: number;     // extra darkening under heavy cloud
  wind: number;     // 0 calm .. 1 windy
  windDir: number;  // -1 .. 1, eases through zero when the wind turns
  cold: number;
  warm: number;
  haze: number;
  vivid: number;    // extra colour when a storm has just cleared
};

export function weatherAt(day: number, u: number, force?: Partial<Stretch> | null): SkyWeather {
  const s = stretchOf(u);
  const g = day * 4 + s;
  const pick = (k: number) => (force ? { ...stretchAt(k), ...force } : stretchAt(k));
  const now = pick(g);
  const next = pick(g + 1);
  const prev = pick(g - 1);
  const f = (u - STRETCH_BOUNDS[s]) / (STRETCH_BOUNDS[s + 1] - STRETCH_BOUNDS[s]);
  const into = force ? 0 : smooth(0.8, 1, f);
  const a = LOOK[now.condition];
  const b = LOOK[next.condition];
  const m = (x: number, y: number) => mixN(x, y, into);
  const precip = m(a.precip, b.precip);
  const snowShare = m(now.snow ? 1 : 0, next.snow ? 1 : 0);
  // Morning fog is thickest at dawn and thins as the morning goes on.
  const fogNow = a.fog * (s === MORNING ? 1 - f * 0.55 : 1);
  const clearedNow = isWet(prev.condition) && rank(now.condition) <= 2 ? 1 : 0;
  return {
    now,
    next,
    prev,
    stretch: s,
    into,
    cover: m(a.cover, b.cover),
    rain: precip * (1 - snowShare),
    snow: precip * snowShare,
    hail: m(now.hail ? 1 : 0, next.hail ? 1 : 0) * m(a.storm, b.storm),
    storm: m(a.storm, b.storm),
    fog: m(fogNow, b.fog),
    dark: m(a.dark, b.dark),
    wind: m(now.wind, next.wind),
    windDir: m(now.windDir, next.windDir),
    cold: m(now.cold, next.cold),
    warm: m(now.warm, next.warm),
    haze: m(now.haze, next.haze),
    vivid: clearedNow * (1 - into),
  };
}

const average = (c: RGB) => (c[0] + c[1] + c[2]) / 3;
const MILKY: RGB = [214, 218, 228];
const HAIL_GREEN: RGB = [100, 146, 130];

// Grey the day's palette under cloud, soften its contrast, darken it for rain and
// storms, and saturate it when a storm has just cleared. Snow skies go a bright,
// milky grey; hailstorms take on an eerie green.
export function applyWeather(mix: SkyMix, w: SkyWeather): SkyMix {
  const overcast = Math.pow(w.cover, 1.3) * 0.85;
  const flatten = w.cover * 0.2;
  const darken = 1 - w.dark * 0.6 * (1 - w.snow * 0.5);
  const vivid = 1 + w.vivid * 0.45;
  const daylight = 1 - mix.stars;
  const milky = w.snow * daylight * 0.45;
  const green = w.hail * 0.5;
  const adjust = (palette: RGB[]): RGB[] => {
    const greyed = palette.map((c) => {
      const v = average(c);
      const saturated: RGB = [v + (c[0] - v) * vivid, v + (c[1] - v) * vivid, v + (c[2] - v) * vivid];
      const grey = lerp3(saturated, [v * 0.95, v * 0.98, v * 1.05], overcast);
      return lerp3(lerp3(grey, MILKY, milky), HAIL_GREEN.map((k) => k * (0.4 + 0.6 * daylight)) as RGB, green);
    });
    const mean: RGB = [0, 1, 2].map((k) => greyed.reduce((sum, c) => sum + c[k], 0) / greyed.length) as RGB;
    return greyed.map((c) => lerp3(c, mean, flatten).map((v) => clamp(v * darken, 0, 255)) as RGB);
  };
  const cloudGrey: RGB = [average(mix.cloud) * 0.82, average(mix.cloud) * 0.84, average(mix.cloud) * 0.9];
  return {
    top: adjust(mix.top),
    bottom: adjust(mix.bottom),
    stars: mix.stars * Math.pow(1 - w.cover, 2) * (1 - w.fog * 0.7),
    cloud: lerp3(mix.cloud, cloudGrey, w.cover * 0.8).map((v) => v * (1 - w.dark * 0.45)) as RGB,
    sun: mix.sun,
  };
}
