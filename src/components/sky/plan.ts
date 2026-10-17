import { AURORA_FORMS, AURORA_ODDS, type Aurora } from './aurora';
import { DAY_SECONDS } from './clock';
import { hash } from './pixel';
import { isClearish, isWet, rank, stretchAt, type Stretch } from './weather';

// What happens in the sky on a given day. Each day rolls its own set of events
// from the odds below, gated on that day's weather (kites need a breeze, the
// aurora needs a clear night, sprites need a storm...). Everything keys off
// the day number on the shared clock, so every visitor sees the same sky.

// Chance per day once the weather allows it. Tuned so even the legendary sights
// turn up within an hour or two of watching.
export const ODDS = {
  sunrise: 0.55,
  sunset: 0.55,
  noonSun: 0.45,
  dayMoon: 0.15,
  moon: 0.5,
  eclipse: 0.05,
  bloodMoon: 0.35,
  halo: 0.75,
  sunDogs: 0.75,
  arcs: 0.4,
  pillar: 0.45,
  greenFlash: 0.2,
  moonHalo: 0.45,
  lightPillars: 0.4,
  lines: 0.6,
  venusEve: 0.55,
  venusMorn: 0.45,
  jupiter: 0.5,
  mars: 0.3,
  aurora: 0.12,
  auroraCold: 0.22,
  comet: 0.5,
  meteorShower: 0.09,
  streak: 0.55,
  secondStreak: 0.4,
  fireball: 0.05,
  showerFireball: 0.35,
  satellites: 0.8,
  flare: 0.25,
  starlink: 0.14,
  iss: 0.32,
  issFades: 0.5,
  planes: 0.85,
  flocks: 0.65,
  vee: 0.3,
  murmuration: 0.16,
  bats: 0.4,
  kites: 0.7,
  hotAir: 0.6,
  partyBalloon: 0.14,
  balloonBunch: 0.05,
  blimp: 0.1,
  owl: 0.35,
  noctilucent: 0.18,
  holePunch: 0.15,
  nacreous: 0.15,
  sprites: 0.5,
  ballLightning: 0.12,
  heatLightning: 0.3,
};

// Event windows, as fractions of the day (see the keyframes in phases.ts).
export const WINDOWS = {
  noonSun: [0, 0.17],
  dayMoon: [0.02, 0.18],
  sunset: [0.19, 0.4],
  moon: [0.5, 0.72],
  sunrise: [0.74, 0.94],
  night: [0.5, 0.71],
  dusk: [0.4, 0.53],
  evening: [0.36, 0.47],
  midday: [0.02, 0.25],
  morning: [0.77, 0.99],
} as const;

export type Corner = { jitter: number };
export type MoonPass = { jitter: number; rising: boolean };
// Something crossing the box in a straight line: when it starts (fraction of the
// day), how many seconds it takes, where (0..1 down the box), its tilt and direction.
export type Crossing = { at: number; seconds: number; y: number; slope: number; dir: 1 | -1; seed: number };
export type Span = { from: number; to: number; seed: number };
export type Kite = { x: number; y: number; color: number; seed: number };
export type Balloon = { x: number; size: number; colors: number; seed: number };

export type DayPlan = {
  n: number;
  base: number;
  stretches: Stretch[];   // midday, evening, night, morning
  moonPhase: number;      // 0 new, 0.5 full, 1 new again: one lunar month is 29.5 days
  constellation: number;  // which constellation tonight
  sunrise: Corner | null;
  sunset: Corner | null;
  noonSun: Corner | null;
  dayMoon: MoonPass | null;
  moon: MoonPass | null;
  eclipse: boolean;
  bloodMoon: boolean;
  halo: { dogs: boolean; arcs: boolean } | null;
  pillar: boolean;
  greenFlash: boolean;
  moonHalo: boolean;
  lightPillars: Span | null;
  lines: Span | null;
  venusEve: boolean;
  venusMorn: boolean;
  jupiter: { x: number; y: number } | null;
  mars: { x: number; y: number } | null;
  milkyWay: boolean;
  aurora: Aurora | null;
  comet: { x: number; y: number; angle: number; length: number } | null;
  meteorShower: { x: number; y: number } | null;
  streaks: { at: number; seed: number }[];
  fireball: { at: number; seed: number } | null;
  satellites: Crossing[];
  flare: Crossing | null;
  starlink: Crossing | null;
  iss: (Crossing & { fades: boolean }) | null;
  planes: (Crossing & { high: boolean })[];
  flocks: Crossing[];
  vee: Crossing | null;
  murmuration: Span | null;
  bats: Span | null;
  kites: Kite[];
  hotAir: Balloon[];
  partyBalloon: Crossing | null;
  balloonBunch: Crossing | null;
  blimp: Crossing | null;
  owl: Span | null;
  noctilucent: Span | null;
  holePunch: Span | null;
  nacreous: Span | null;
  sprites: Span | null;
  ballLightning: Span | null;
  heatLightning: Span | null;
};

// Every random draw for a day is keyed, so adding an event never reshuffles the others.
export type Roll = (key: number, i?: number) => number;

export function rollFor(n: number): { base: number; r: Roll } {
  // Fold the day number down first: it's too big to feed the hash directly.
  const base = Math.floor(hash(n & 0xffff, n >>> 16) * 1e6);
  return { base, r: (key, i = 0) => hash(key * 37 + i + 4243, base) };
}

const pickIn = (r: number, [from, to]: readonly [number, number]) => from + r * (to - from);

export function crossing(r: Roll, key: number, i: number, window: readonly [number, number], seconds: number, yFrom = 0.08, yTo = 0.6): Crossing {
  const length = seconds * (0.8 + r(key, i + 100) * 0.4);
  return {
    // Late starters set off a little earlier so they're across before the day rolls over.
    at: Math.min(pickIn(r(key, i), window), 0.995 - length / DAY_SECONDS),
    seconds: length,
    y: yFrom + r(key, i + 200) * (yTo - yFrom),
    slope: (r(key, i + 300) - 0.5) * 0.3,
    dir: r(key, i + 400) < 0.5 ? 1 : -1,
    seed: (key * 1000 + i) * 13 + Math.floor(r(key, i + 500) * 997),
  };
}

const span = (r: Roll, key: number, from: number, to: number): Span => ({ from, to, seed: Math.floor(r(key, 900) * 1e5) });

// Builders: each makes one event's details. The planner calls them when the odds
// and weather allow; preview links call them directly to force an event on.
export const build = {
  kites(r: Roll): Kite[] {
    const count = 1 + Math.floor(r(60, 1) * 3);
    return Array.from({ length: count }, (_, i) => ({
      x: (count === 1 ? 0.5 : 0.25 + (i / (count - 1)) * 0.5) + (r(60, 10 + i) - 0.5) * 0.12,
      y: 0.2 + r(60, 20 + i) * 0.22,
      color: i === 0 ? 0 : Math.floor(r(60, 30 + i) * 4),
      seed: Math.floor(r(60, 40 + i) * 1e5),
    }));
  },
  hotAir(r: Roll): Balloon[] {
    const count = 1 + Math.floor(r(61, 1) * 3);
    return Array.from({ length: count }, (_, i) => ({
      x: 0.15 + r(61, 10 + i) * 0.7,
      size: 0.6 + r(61, 20 + i) * 0.5,
      colors: Math.floor(r(61, 30 + i) * 4),
      seed: Math.floor(r(61, 40 + i) * 1e5),
    }));
  },
  aurora(r: Roll): Aurora {
    let pick = r(35, 4);
    let form = AURORA_FORMS[AURORA_FORMS.length - 1];
    for (let i = 0; i < AURORA_FORMS.length; i++) {
      if (pick < AURORA_ODDS[i]) {
        form = AURORA_FORMS[i];
        break;
      }
      pick -= AURORA_ODDS[i];
    }
    return { ...span(r, 35, 0.52, 0.71), form, theme: Math.floor(r(35, 5) * 3) };
  },
  comet(r: Roll, dayInRun: number) {
    return { x: 0.18 + (dayInRun / 14) * 0.55, y: 0.18 + r(62, 1) * 0.12, angle: -2.5 + r(62, 2) * 0.5, length: 0.22 + r(62, 3) * 0.1 };
  },
};

export function planDay(n: number): DayPlan {
  const { base, r } = rollFor(n);
  const stretches = [0, 1, 2, 3].map((k) => stretchAt(n * 4 + k));
  const [mid, eve, night, morn] = stretches;
  const chance = (key: number, odds: number) => r(key) < odds;
  const clear = (s: Stretch) => isClearish(s.condition);
  const dryish = (s: Stretch) => rank(s.condition) <= 3;
  const moonPhase = (((n / 29.5) % 1) + 1) % 1;
  const fullMoon = Math.abs(moonPhase - 0.5) < 0.12;
  const darkMoon = moonPhase < 0.2 || moonPhase > 0.8;

  const moon = chance(5, ODDS.moon) && dryish(night) ? { jitter: r(5, 1), rising: r(5, 2) < 0.5 } : null;
  const sunset = chance(3, ODDS.sunset) && rank(eve.condition) <= 3 ? { jitter: r(3, 1) } : null;
  const sunrise = chance(4, ODDS.sunrise) && rank(morn.condition) <= 3 && morn.condition !== 'fog' ? { jitter: r(4, 1) } : null;
  const noonSun = chance(6, ODDS.noonSun) && rank(mid.condition) <= 2 ? { jitter: r(6, 1) } : null;
  const anySun = !!(sunset || sunrise || noonSun);
  const hazy = stretches.some((s) => s.haze > 0.4);

  // The comet comes back for a run of two weeks in some 60-day blocks.
  const block = Math.floor(n / 60);
  const dayInRun = n - block * 60;
  const cometBlock = hash(block & 0xfffff, 4441) < ODDS.comet;

  const shower = chance(41, ODDS.meteorShower) && dryish(night);
  const streakCount = chance(42, ODDS.streak) ? (r(42, 1) < ODDS.secondStreak ? 2 : 1) : 0;

  const planeCount = chance(50, ODDS.planes) ? 1 + Math.floor(r(50, 1) * 3) : 0;
  const daytime: [number, number] = r(51, 9) < 0.7 ? [0.02, 0.4] : [0.76, 0.98];
  const flockCount = chance(51, ODDS.flocks) ? 1 + Math.floor(r(51, 1) * 2) : 0;
  const satCount = clear(night) && chance(44, ODDS.satellites) ? 1 + Math.floor(r(44, 1) * 3) : 0;

  return {
    n,
    base,
    stretches,
    moonPhase,
    constellation: n % 15,
    sunrise,
    sunset,
    noonSun,
    dayMoon: chance(7, ODDS.dayMoon) && dryish(mid) ? { jitter: r(7, 1), rising: r(7, 2) < 0.5 } : null,
    moon,
    eclipse: !!noonSun && clear(mid) && chance(8, ODDS.eclipse),
    bloodMoon: !!moon && fullMoon && chance(9, ODDS.bloodMoon),
    halo: anySun && hazy && chance(20, ODDS.halo) ? { dogs: r(20, 1) < ODDS.sunDogs, arcs: r(20, 2) < ODDS.arcs } : null,
    pillar: (!!sunset || !!sunrise) && (hazy || stretches.some((s) => s.cold > 0.4)) && chance(21, ODDS.pillar),
    greenFlash: !!sunset && clear(eve) && chance(22, ODDS.greenFlash),
    moonHalo: !!moon && (night.haze > 0.3 || night.condition === 'partly') && chance(23, ODDS.moonHalo),
    lightPillars: night.cold > 0.4 && clear(night) && chance(24, ODDS.lightPillars) ? span(r, 24, 0.52, 0.7) : null,
    lines: clear(night) && chance(30, ODDS.lines) ? span(r, 30, 0.56 + r(30, 1) * 0.04, 0.64 + r(30, 1) * 0.04) : null,
    venusEve: rank(eve.condition) <= 2 && chance(31, ODDS.venusEve),
    venusMorn: rank(morn.condition) <= 2 && chance(32, ODDS.venusMorn),
    jupiter: chance(33, ODDS.jupiter) ? { x: 0.12 + r(33, 1) * 0.76, y: 0.08 + r(33, 2) * 0.3 } : null,
    mars: chance(34, ODDS.mars) ? { x: 0.12 + r(34, 1) * 0.76, y: 0.1 + r(34, 2) * 0.35 } : null,
    milkyWay: clear(night) && darkMoon,
    aurora: clear(night) && chance(35, night.cold > 0.3 ? ODDS.auroraCold : ODDS.aurora) ? build.aurora(r) : null,
    comet: cometBlock && dayInRun < 14 ? build.comet(rollFor(block * 60).r, dayInRun) : null,
    meteorShower: shower ? { x: 0.1 + r(41, 2) * 0.3, y: 0.05 + r(41, 3) * 0.15 } : null,
    streaks: Array.from({ length: streakCount }, (_, k) => ({ at: 0.53 + r(43, k) * 0.16, seed: base * 4 + k })),
    fireball: chance(45, shower ? ODDS.showerFireball : ODDS.fireball) && dryish(night) ? { at: 0.54 + r(45, 1) * 0.14, seed: base * 4 + 3 } : null,
    satellites: Array.from({ length: satCount }, (_, k) => crossing(r, 46, k, [0.5, 0.7], 9, 0.06, 0.5)),
    flare: clear(night) && chance(47, ODDS.flare) ? crossing(r, 47, 0, [0.52, 0.68], 8, 0.08, 0.45) : null,
    starlink: clear(night) && chance(48, ODDS.starlink) ? crossing(r, 48, 0, [0.49, 0.56], 12, 0.12, 0.45) : null,
    iss: dryish(night) && chance(11, ODDS.iss) ? { ...crossing(r, 11, 0, [0.52, 0.66], 12, 0.12, 0.42), fades: r(11, 7) < ODDS.issFades } : null,
    planes: Array.from({ length: planeCount }, (_, k) => ({ ...crossing(r, 52, k, [0.01, 0.97], r(52, 50 + k) < 0.5 ? 26 : 15, 0.05, 0.7), high: r(52, 50 + k) < 0.5 })),
    flocks: Array.from({ length: flockCount }, (_, k) => crossing(r, 53, k, daytime, 11, 0.12, 0.6)),
    vee: chance(54, ODDS.vee) && dryish(mid) ? crossing(r, 54, 0, [0.02, 0.36], 16, 0.12, 0.45) : null,
    murmuration: dryish(eve) && chance(55, ODDS.murmuration) ? span(r, 55, 0.36, 0.46) : null,
    bats: rank(eve.condition) <= 2 && eve.cold < 0.5 && chance(56, ODDS.bats) ? span(r, 56, 0.41, 0.53) : null,
    kites: !isWet(mid.condition) && mid.wind > 0.3 && chance(60, ODDS.kites) ? build.kites(r) : [],
    hotAir: rank(morn.condition) <= 2 && morn.condition !== 'fog' && morn.wind < 0.45 && chance(61, ODDS.hotAir) ? build.hotAir(r) : [],
    partyBalloon: dryish(mid) && chance(63, ODDS.partyBalloon) ? crossing(r, 63, 0, [0.02, 0.3], 22, 0.7, 0.9) : null,
    balloonBunch: dryish(mid) && chance(64, ODDS.balloonBunch) ? crossing(r, 64, 0, [0.02, 0.3], 26, 0.7, 0.9) : null,
    blimp: dryish(mid) && mid.wind < 0.6 && chance(65, ODDS.blimp) ? crossing(r, 65, 0, [0.0, 0.2], 60, 0.15, 0.45) : null,
    owl: !!moon && fullMoon && chance(66, ODDS.owl) ? span(r, 66, 0.55 + r(66, 1) * 0.08, 0.6 + r(66, 1) * 0.08) : null,
    noctilucent: (clear(eve) || clear(morn)) && chance(76, ODDS.noctilucent) ? (clear(eve) ? span(r, 76, 0.45, 0.53) : span(r, 76, 0.67, 0.75)) : null,
    holePunch: (mid.condition === 'mostly' || mid.condition === 'overcast') && chance(77, ODDS.holePunch) ? span(r, 77, 0.03, 0.22) : null,
    nacreous: (eve.cold > 0.3 || morn.cold > 0.3) && (clear(eve) || clear(morn)) && chance(78, ODDS.nacreous) ? (clear(eve) ? span(r, 78, 0.4, 0.5) : span(r, 78, 0.7, 0.8)) : null,
    // Sprites are seen above storms in the distance, so a stormy evening or morning counts.
    sprites: (night.condition === 'storm' || eve.condition === 'storm' || morn.condition === 'storm') && chance(80, ODDS.sprites) ? span(r, 80, 0.5, 0.72) : null,
    ballLightning: stretches.some((s) => s.condition === 'storm') && chance(81, ODDS.ballLightning)
      ? (() => {
          const k = stretches.findIndex((s) => s.condition === 'storm');
          const windows = [[0.04, 0.24], [0.29, 0.45], [0.5, 0.7], [0.75, 0.95]];
          const at = windows[k][0] + r(81, 1) * (windows[k][1] - windows[k][0] - 0.03);
          return { from: at, to: at + 0.035, seed: Math.floor(r(81, 2) * 1e5) };
        })()
      : null,
    heatLightning: (night.warm > 0.4 && clear(night) && chance(82, ODDS.heatLightning)) || (night.condition !== 'storm' && (eve.condition === 'storm' || morn.condition === 'storm'))
      ? span(r, 82, 0.5, 0.72)
      : null,
  };
}

