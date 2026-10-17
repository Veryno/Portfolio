import type { AuroraForm } from './aurora';
import { DAY_SECONDS, build, planDay, rollFor, type Crossing, type DayPlan, type Span } from './plan';
import { weatherAt, type Condition, type SkyWeather, type Stretch } from './weather';

// Preview links: ?sky=<name> on the site calls up one sight on a loop, in the
// weather and time of day it needs, so any of them can be seen on demand
// (?sky=aurora-corona, ?sky=sprites, ?sky=snow...). The almanac page runs the
// same scenes.

export type Preview = {
  u: number; // time of day it starts at
  loop: number; // seconds before it starts over
  speed?: number; // how fast the day moves on meanwhile (1 = normal, 0 = held still)
  weather?: Partial<Stretch>;
  setup?: (p: DayPlan, u: number) => void; // switch the sight on
  patch?: (p: DayPlan, e: number, loop: number, elapsed: number) => void; // change it as it plays
  tweak?: (w: SkyWeather, e: number, loop: number) => void; // adjust the weather as it plays
};

// Previews play on one fixed day so they look the same every time.
export const PREVIEW_DAY = 9957001;
const DAY = DAY_SECONDS;

// Fields of a day's plan that aren't sights, kept when the sights are cleared.
const KEEP = new Set(['n', 'base', 'stretches', 'moonPhase', 'constellation']);

// A day with every sight switched off, for a preview to switch one back on.
export function blankPlan(n: number): DayPlan {
  const plan = planDay(n) as Record<string, unknown>;
  for (const key of Object.keys(plan)) {
    if (KEEP.has(key)) continue;
    const v = plan[key];
    plan[key] = Array.isArray(v) ? [] : typeof v === 'boolean' ? false : null;
  }
  return plan as DayPlan;
}

const CALM: Partial<Stretch> = { condition: 'clear', snow: false, hail: false, cold: 0, warm: 0.3, wind: 0.3, windDir: 1, haze: 0 };
const as = (condition: Condition, extra: Partial<Stretch> = {}): Partial<Stretch> => ({ ...CALM, condition, ...extra });
const cross = (at: number, seconds: number, y: number, dir: 1 | -1 = 1, slope = 0.04, seed = 7): Crossing => ({ at, seconds, y, slope, dir, seed });
const span = (from: number, to: number, seed = 11): Span => ({ from, to, seed });

// The dot clouds through every kind of weather, a few seconds each, easing from one to the next.
export const WEATHER_TOUR: { step: number; stops: [Condition, Partial<Stretch>, string][] } = {
  step: 3.2,
  stops: [
    ['clear', {}, 'Clear'], ['fair', {}, 'Fair'], ['partly', {}, 'Partly cloudy'], ['mostly', {}, 'Mostly cloudy'], ['overcast', {}, 'Overcast'],
    ['drizzle', {}, 'Drizzle'], ['rain', { wind: 0.6 }, 'Rain'], ['storm', {}, 'Thunderstorm'], ['rain', { snow: true, cold: 1 }, 'Snow'], ['fog', { wind: 0.05 }, 'Fog'],
  ],
};
export const tourStop = (e: number) => Math.floor(e / WEATHER_TOUR.step) % WEATHER_TOUR.stops.length;

function tourWeather(w: SkyWeather, e: number) {
  const { step, stops } = WEATHER_TOUR;
  const i = tourStop(e);
  const k = Math.max(0, (e % step) / step - 0.7) / 0.3;
  const [ca, xa] = stops[i];
  const [cb, xb] = stops[(i + 1) % stops.length];
  const a = weatherAt(PREVIEW_DAY, 0.1, as(ca, xa));
  const b = weatherAt(PREVIEW_DAY, 0.1, as(cb, xb));
  const ease = k * k * (3 - 2 * k);
  for (const key of ['cover', 'rain', 'snow', 'hail', 'storm', 'fog', 'dark', 'wind', 'windDir', 'cold', 'warm', 'haze'] as const) w[key] = a[key] + (b[key] - a[key]) * ease;
  w.now = ease < 0.5 ? a.now : b.now;
}

// One kind of aurora; theme picks the colours (0 violet tops, 1 red, 2 pink fringe).
const aurora = (form: AuroraForm, theme: number, seed: number): Preview => ({
  u: 0.6, loop: 16, speed: 0, weather: as('clear', { cold: 0.6 }),
  setup: (p) => { p.aurora = { ...span(0.52, 0.71, 4242 + seed * 97), form, theme }; },
});

export const PREVIEWS: Record<string, Preview> = {
  // Weather
  dots: { u: 0.1, loop: WEATHER_TOUR.step * WEATHER_TOUR.stops.length, speed: 0, weather: as('fair'), tweak: (w, e) => tourWeather(w, e) },
  cover: { u: 0.06, loop: 16, speed: 0, weather: as('partly'), tweak: (w, e, loop) => { w.cover = 0.5 - 0.5 * Math.cos((e / loop) * Math.PI * 2); w.dark = w.cover * 0.12; } },
  cirrus: { u: 0.08, loop: 14, speed: 0, weather: as('fair', { haze: 1 }) },
  overcast: { u: 0.08, loop: 14, speed: 0, weather: as('overcast') },
  wind: { u: 0.08, loop: 18, speed: 0, weather: as('partly', { wind: 1 }), tweak: (w, e, loop) => { w.windDir = Math.cos((e / loop) * Math.PI * 2); w.wind = 1; } },
  drizzle: { u: 0.1, loop: 12, speed: 0, weather: as('drizzle') },
  rain: { u: 0.1, loop: 12, speed: 0, weather: as('rain', { wind: 0.6 }) },
  storm: { u: 0.3, loop: 14, speed: 0, weather: as('storm') },
  snow: { u: 0.1, loop: 14, speed: 0, weather: as('rain', { snow: true, cold: 1 }) },
  blizzard: { u: 0.3, loop: 14, speed: 0, weather: as('storm', { snow: true, cold: 1, wind: 1 }) },
  hail: { u: 0.3, loop: 12, speed: 0, weather: as('storm', { hail: true }) },
  fog: { u: 0.76, loop: 14, speed: 0, weather: as('fog', { wind: 0.05 }) },
  heat: { u: 0.6, loop: 12, speed: 0, weather: as('clear', { warm: 1 }), setup: (p) => { p.heatLightning = span(0.5, 0.72); } },
  // Sun and light
  noon: { u: 0.07, loop: 12, speed: 0, weather: as('clear'), setup: (p) => { p.noonSun = { jitter: 0.5 }; } },
  sunrise: { u: 0.78, loop: 16, speed: 2.5, weather: as('fair'), setup: (p) => { p.sunrise = { jitter: 0.5 }; } },
  sunset: { u: 0.22, loop: 16, speed: 2.5, weather: as('fair'), setup: (p) => { p.sunset = { jitter: 0.5 }; } },
  rays: { u: 0.3, loop: 14, speed: 0, weather: as('partly'), setup: (p) => { p.sunset = { jitter: 0.5 }; }, tweak: (w) => { w.cover = 0.42; w.vivid = 0.6; } },
  halo: { u: 0.07, loop: 14, speed: 0, weather: as('fair', { haze: 1 }), setup: (p) => { p.noonSun = { jitter: 0.5 }; p.halo = { dogs: true, arcs: false }; } },
  cross: { u: 0.29, loop: 14, speed: 0, weather: as('fair', { haze: 0.8, cold: 0.8 }), setup: (p) => { p.sunset = { jitter: 0.5 }; p.pillar = true; } },
  arcs: { u: 0.07, loop: 14, speed: 0, weather: as('fair', { haze: 1 }), setup: (p) => { p.noonSun = { jitter: 0.5 }; p.halo = { dogs: true, arcs: true }; } },
  flash: { u: 0.335, loop: 7, speed: 1, weather: as('clear'), setup: (p) => { p.sunset = { jitter: 0.5 }; p.greenFlash = true; } },
  belt: { u: 0.43, loop: 14, speed: 0, weather: as('clear') },
  vivid: { u: 0.34, loop: 14, speed: 0, weather: as('partly'), setup: (p) => { p.sunset = { jitter: 0.5 }; }, tweak: (w) => { w.vivid = 1; w.cover = 0.3; } },
  eclipse: { u: 0.025, loop: 22, speed: 1.15, weather: as('clear'), setup: (p) => { p.noonSun = { jitter: 0.5 }; p.eclipse = true; } },
  // Night
  constellations: {
    u: 0.6, loop: 9, speed: 1, weather: as('clear'),
    setup: (p) => { p.lines = span(0.6, 0.6 + 9 / DAY); },
    patch: (p, _e, loop, elapsed) => { p.constellation = Math.floor(elapsed / loop) % 15; },
  },
  phases: { u: 0.61, loop: 12, speed: 0, weather: as('clear'), setup: (p) => { p.moon = { jitter: 0.5, rising: false }; }, patch: (p, e, loop) => { p.moonPhase = (e / loop + 0.05) % 1; } },
  planets: { u: 0.5, loop: 12, speed: 0, weather: as('clear'), setup: (p) => { p.venusEve = true; p.jupiter = { x: 0.32, y: 0.22 }; p.mars = { x: 0.62, y: 0.36 }; } },
  milkyway: { u: 0.6, loop: 12, speed: 0, weather: as('clear'), setup: (p) => { p.milkyWay = true; } },
  'aurora-curtains': aurora('curtains', 0, 3),
  'aurora-arc': aurora('arc', 0, 1),
  'aurora-bands': aurora('bands', 1, 2),
  'aurora-corona': aurora('corona', 0, 4),
  'aurora-pulsing': aurora('pulsing', 0, 5),
  'aurora-red': aurora('red', 1, 6),
  'aurora-steve': aurora('steve', 0, 7),
  shooting: { u: 0.6, loop: 4, speed: 1, weather: as('clear'), setup: (p, u) => { p.streaks = [{ at: u + 0.003, seed: 5 }]; } },
  shower: { u: 0.6, loop: 12, speed: 1, weather: as('clear'), setup: (p, u) => { p.meteorShower = { x: 0.2, y: 0.1 }; p.fireball = { at: u + 0.02, seed: 21 }; } },
  satellites: {
    u: 0.6, loop: 10, speed: 1, weather: as('clear'),
    setup: (p, u) => { p.satellites = [cross(u + 0.001, 9, 0.25, 1, 0.1), cross(u + 0.005, 9, 0.62, -1, -0.12)]; p.flare = cross(u + 0.002, 8, 0.4, 1, 0.05); },
  },
  starlink: { u: 0.52, loop: 13, speed: 1, weather: as('clear'), setup: (p, u) => { p.starlink = cross(u + 0.002, 12, 0.3, 1, 0.08); } },
  iss: {
    u: 0.58, loop: 14, speed: 1, weather: as('clear'),
    setup: (p, u) => { p.iss = { ...cross(u + 0.004, 12, 0.32, 1, 0.08), fades: false }; },
    patch: (p, _e, loop, elapsed) => { if (p.iss) p.iss.fades = Math.floor(elapsed / loop) % 2 === 1; },
  },
  moonhalo: { u: 0.6, loop: 12, speed: 0, weather: as('fair', { haze: 0.8 }), setup: (p) => { p.moon = { jitter: 0.2, rising: true }; p.moonHalo = true; p.moonPhase = 0.45; } },
  pillars: { u: 0.6, loop: 12, speed: 0, weather: as('clear', { cold: 1 }), setup: (p) => { p.lightPillars = span(0.52, 0.7, 6); } },
  comet: { u: 0.6, loop: 12, speed: 0, weather: as('clear'), setup: (p) => { p.comet = build.comet(rollFor(5).r, 7); } },
  bloodmoon: { u: 0.5, loop: 20, speed: 2, weather: as('clear'), setup: (p) => { p.moon = { jitter: 0.5, rising: false }; p.bloodMoon = true; } },
  // Things that fly
  planes: {
    u: 0.06, loop: 16, speed: 1, weather: as('fair', { haze: 0.4 }),
    setup: (p, u) => { p.planes = [{ ...cross(u + 0.001, 15, 0.22, 1, 0.05), high: true }, { ...cross(u + 0.012, 9, 0.62, -1, -0.04), high: false }]; },
  },
  nightplanes: {
    u: 0.6, loop: 12, speed: 1, weather: as('clear'),
    setup: (p, u) => { p.planes = [{ ...cross(u + 0.001, 11, 0.3, 1, 0.05), high: true }, { ...cross(u + 0.01, 8, 0.6, -1, 0), high: false }]; },
  },
  birds: { u: 0.06, loop: 16, speed: 1, weather: as('fair'), setup: (p, u) => { p.flocks = [cross(u + 0.001, 11, 0.6, -1, 0.02, 9)]; p.vee = cross(u + 0.004, 14, 0.28, 1, 0.03, 12); } },
  murmuration: { u: 0.4, loop: 14, speed: 0, weather: as('fair'), setup: (p) => { p.murmuration = span(0.36, 0.46, 33); } },
  bats: { u: 0.46, loop: 12, speed: 0, weather: as('clear'), setup: (p) => { p.bats = span(0.41, 0.53, 8); } },
  kites: { u: 0.1, loop: 14, speed: 0, weather: as('fair', { wind: 0.6 }), setup: (p) => { p.kites = build.kites(rollFor(3).r); } },
  hotair: { u: 0.78, loop: 20, speed: 2.2, weather: as('clear', { wind: 0.1 }), setup: (p) => { p.hotAir = build.hotAir(rollFor(2).r); } },
  balloons: {
    u: 0.08, loop: 16, speed: 1, weather: as('fair', { wind: 0.2 }),
    setup: (p, u) => { p.partyBalloon = cross(u + 0.001, 14, 0.8, 1, 0, 30); p.balloonBunch = cross(u + 0.03, 12, 0.8, 1, 0, 64); },
  },
  blimp: { u: 0.08, loop: 18, speed: 1, weather: as('fair'), setup: (p, u) => { p.blimp = cross(u + 0.001, 17, 0.3, 1, 0); } },
  owl: {
    u: 0.6, loop: 8, speed: 1, weather: as('clear'),
    setup: (p, u) => { p.moon = { jitter: 0.4, rising: false }; p.moonPhase = 0.5; p.owl = span(u + 0.004, u + 0.004 + 5 / DAY); },
  },
  // Rare clouds
  noctilucent: { u: 0.49, loop: 12, speed: 0, weather: as('clear'), setup: (p) => { p.noctilucent = span(0.45, 0.53); } },
  holepunch: { u: 0.12, loop: 14, speed: 0, weather: as('overcast'), setup: (p) => { p.holePunch = span(0.03, 0.22, 3); } },
  nacreous: { u: 0.45, loop: 14, speed: 0, weather: as('clear', { cold: 1 }), setup: (p) => { p.nacreous = span(0.4, 0.5); } },
  // Storms and legends
  sprites: { u: 0.6, loop: 12, speed: 0, weather: as('fair'), setup: (p) => { p.sprites = span(0.5, 0.72, 77); } },
  ball: { u: 0.3, loop: 9, speed: 1, weather: as('storm'), setup: (p, u) => { p.ballLightning = span(u + 0.002, u + 0.002 + 6.3 / DAY, 9); } },
};

// Shorter names that also work in the link.
const ALIASES: Record<string, string> = {
  aurora: 'aurora-curtains',
  'northern-lights': 'aurora-curtains',
  steve: 'aurora-steve',
  'red-sprites': 'sprites',
  'ball-lightning': 'ball',
  thunder: 'storm',
  lightning: 'storm',
  snowstorm: 'blizzard',
  'shooting-stars': 'shooting',
  meteors: 'shower',
};

// The preview a ?sky= value asks for, if it names one.
export function findPreview(name: string | null): Preview | null {
  if (!name) return null;
  const key = name.trim().toLowerCase();
  return PREVIEWS[ALIASES[key] ?? key] ?? null;
}

// Where a preview is at `elapsed` seconds in: the time of day, the weather, and
// how far through its loop it is. Call setup on the plan once before the first frame.
export function playPreview(p: Preview, plan: DayPlan, elapsed: number) {
  const e = elapsed % p.loop;
  const u = (((p.u + (e * (p.speed ?? 0)) / DAY) % 1) + 1) % 1;
  p.patch?.(plan, e, p.loop, elapsed);
  const weather = weatherAt(PREVIEW_DAY, u, { ...CALM, ...p.weather });
  p.tweak?.(weather, e, p.loop);
  return { n: PREVIEW_DAY, u, weather, e };
}
