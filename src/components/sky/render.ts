import { applyFlash } from './base';
import { drawMoons, drawSun, eclipseCover, locateSun } from './bodies';
import { drawCirrus, drawRareClouds } from './clouds';
import type { Frame } from './context';
import { drawBalloons, drawBats, drawBirds, drawBlimp, drawHotAir, drawKites, drawMurmuration, drawOwl, drawPlanes } from './flyers';
import { drawAurora } from './aurora';
import { drawComet, drawConstellation, drawIss, drawMeteors, drawMilkyWay, drawPlanets, drawSatellites } from './night';
import { drawBeltOfVenus, drawCrepuscular, drawLightPillars, drawMoonHalo, drawSunOptics } from './optics';
import { mixPhase, type SkyMix } from './phases';
import { lerp3 } from './pixel';
import type { DayPlan } from './plan';
import { drawBallLightning, drawFog, drawHail, drawHeatLightning, drawLightning, drawRain, drawSnow, drawSprites } from './precip';
import { applyWeather, type SkyWeather } from './weather';

// Stars drift slowly across the night, in sky pixels per second.
const STAR_SPEED = 0.35;
const NIGHT = mixPhase(0.6);

// During a total solar eclipse the day sky dims toward night and stars come out.
function eclipseMix(mix: SkyMix, k: number): SkyMix {
  const dim = k * 0.85;
  return {
    ...mix,
    top: mix.top.map((c, l) => lerp3(c, NIGHT.top[l], dim)),
    bottom: mix.bottom.map((c, l) => lerp3(c, NIGHT.bottom[l], dim)),
    stars: Math.max(mix.stars, k * 0.8),
  };
}

export type FrameInput = {
  img: ImageData;
  field: Float32Array;
  t: number;
  sec: number;
  u: number;
  n: number;
  dayLength: number;
  plan: DayPlan;
  weather: SkyWeather;
  travel: number;
  scaleBase?: number;
};

export function makeFrame(input: FrameInput): Frame {
  const { img, u, plan, weather } = input;
  const cols = img.width;
  const rows = img.height;
  const clearMix = mixPhase(u);
  let mix = applyWeather(clearMix, weather);
  const eclipse = eclipseCover({ u, plan });
  if (eclipse > 0) mix = eclipseMix(mix, eclipse);
  return {
    img,
    cols,
    rows,
    // Sized for the desktop box (217 sky pixels across); a little smaller on phones.
    scale: Math.min(1, Math.max(0.65, Math.min(cols, rows) / (input.scaleBase ?? 217))),
    t: input.t,
    sec: input.sec,
    u,
    n: input.n,
    dayLength: input.dayLength,
    mix,
    clearMix,
    weather,
    plan,
    field: input.field,
    blockCols: Math.ceil(cols / 5),
    starShift: u * input.dayLength * STAR_SPEED,
    travel: input.travel,
    sun: null,
    moon: null,
    flash: 0,
    tags: [],
  };
}

// Everything drawn over the background sky, back to front.
export function renderSky(f: Frame) {
  // The night sky, behind any cloud.
  drawMilkyWay(f);
  drawAurora(f);
  drawConstellation(f);
  drawPlanets(f);
  drawComet(f);
  drawCirrus(f);
  drawRareClouds(f);
  drawBeltOfVenus(f);
  drawLightPillars(f);
  // The sun, with rays fanning out from behind the clouds first so the disc sits on top.
  const sun = locateSun(f);
  if (sun) {
    drawCrepuscular(f, sun.x, sun.y);
    drawSun(f, sun);
    drawSunOptics(f);
  }
  drawMoons(f);
  drawMoonHalo(f);
  // Things moving across the sky.
  drawMeteors(f);
  drawSatellites(f);
  drawIss(f);
  drawPlanes(f);
  drawBirds(f);
  drawMurmuration(f);
  drawBats(f);
  drawKites(f);
  drawHotAir(f);
  drawBalloons(f);
  drawBlimp(f);
  drawOwl(f);
  // Weather in front of it all.
  drawRain(f);
  drawSnow(f);
  drawHail(f);
  drawFog(f);
  drawLightning(f);
  drawHeatLightning(f);
  drawSprites(f);
  drawBallLightning(f);
  applyFlash(f);
}
