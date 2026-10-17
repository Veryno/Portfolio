import { lerp3, type RGB } from './pixel';

// The background sky's colours through one day. Each phase has a 5-step palette
// (deep sky -> bright cloud bank) for the top of the box and one for the bottom
// (the horizon), blended per row. stars is how much of the starfield shows,
// cloud tints the white dot clouds in front, and sun is [core, rim, glow].
export type SkyMix = {
  top: RGB[];
  bottom: RGB[];
  stars: number;
  cloud: RGB;
  sun: [RGB, RGB, RGB];
};

// Deep blue -> pale sky, sampled from the reference animation.
const DAY: RGB[] = [[70, 134, 208], [98, 156, 218], [140, 182, 226], [186, 210, 230], [218, 228, 236]];
const DUSK_SUN: [RGB, RGB, RGB] = [[255, 214, 170], [236, 120, 90], [200, 120, 150]];
const DAWN_SUN: [RGB, RGB, RGB] = [[255, 226, 184], [248, 148, 112], [226, 152, 176]];

const PHASES: Record<string, SkyMix> = {
  day: {
    top: DAY,
    bottom: DAY,
    stars: 0,
    cloud: [255, 255, 255],
    sun: [[255, 253, 238], [255, 238, 168], [255, 250, 220]],
  },
  afternoon: {
    top: [[58, 120, 200], [84, 144, 212], [128, 172, 222], [180, 204, 228], [222, 228, 232]],
    bottom: [[80, 138, 204], [110, 160, 214], [156, 186, 220], [208, 212, 218], [242, 234, 220]],
    stars: 0,
    cloud: [255, 252, 244],
    sun: [[255, 251, 230], [255, 230, 150], [255, 244, 206]],
  },
  golden: {
    top: [[78, 118, 186], [110, 140, 196], [160, 168, 196], [214, 196, 184], [244, 222, 190]],
    bottom: [[122, 128, 176], [178, 150, 158], [228, 176, 128], [248, 204, 128], [255, 228, 168]],
    stars: 0,
    cloud: [255, 238, 204],
    sun: [[255, 244, 204], [255, 204, 110], [255, 216, 150]],
  },
  sunset: {
    top: [[132, 110, 198], [166, 124, 204], [202, 146, 206], [230, 178, 212], [246, 210, 226]],
    bottom: [[216, 96, 144], [238, 122, 146], [249, 154, 146], [253, 188, 160], [255, 222, 196]],
    stars: 0,
    cloud: [255, 226, 232],
    sun: [[255, 238, 200], [255, 158, 100], [255, 176, 150]],
  },
  afterglow: {
    top: [[112, 84, 170], [140, 98, 180], [172, 112, 182], [204, 132, 182], [228, 160, 188]],
    bottom: [[176, 70, 116], [212, 88, 110], [236, 118, 102], [250, 154, 106], [255, 190, 130]],
    stars: 0,
    cloud: [255, 212, 214],
    sun: [[255, 222, 176], [248, 128, 84], [236, 132, 128]],
  },
  dusk: {
    top: [[46, 42, 106], [64, 56, 132], [90, 72, 154], [122, 94, 172], [154, 122, 188]],
    bottom: [[104, 60, 134], [140, 74, 146], [178, 98, 156], [210, 128, 162], [232, 164, 174]],
    stars: 0.3,
    cloud: [228, 212, 238],
    sun: DUSK_SUN,
  },
  blueHour: {
    top: [[16, 24, 72], [24, 36, 96], [36, 54, 120], [54, 76, 142], [78, 100, 162]],
    bottom: [[40, 46, 108], [58, 60, 128], [86, 78, 144], [118, 102, 158], [148, 126, 170]],
    stars: 0.7,
    cloud: [178, 188, 226],
    sun: DUSK_SUN,
  },
  night: {
    top: [[8, 12, 30], [14, 20, 46], [22, 32, 66], [38, 52, 96], [60, 76, 124]],
    bottom: [[14, 20, 48], [22, 32, 68], [34, 48, 92], [54, 70, 120], [82, 98, 146]],
    stars: 1,
    cloud: [146, 160, 204],
    sun: DUSK_SUN,
  },
  preDawn: {
    top: [[10, 16, 40], [16, 26, 58], [26, 40, 80], [42, 60, 104], [64, 84, 128]],
    bottom: [[22, 38, 72], [32, 52, 92], [48, 72, 112], [72, 96, 132], [100, 122, 152]],
    stars: 0.8,
    cloud: [164, 178, 212],
    sun: DAWN_SUN,
  },
  dawn: {
    top: [[28, 30, 80], [46, 44, 108], [70, 62, 138], [102, 86, 162], [134, 114, 184]],
    bottom: [[72, 58, 132], [112, 80, 158], [158, 110, 172], [202, 146, 172], [234, 186, 172]],
    stars: 0.35,
    cloud: [218, 210, 238],
    sun: DAWN_SUN,
  },
  sunrise: {
    top: [[120, 104, 200], [150, 124, 208], [188, 150, 206], [222, 188, 196], [246, 222, 206]],
    bottom: [[160, 108, 184], [208, 134, 164], [242, 178, 122], [252, 212, 122], [255, 240, 172]],
    stars: 0,
    cloud: [255, 242, 212],
    sun: [[255, 246, 208], [255, 198, 98], [255, 222, 156]],
  },
  morning: {
    top: [[92, 148, 214], [120, 168, 222], [162, 194, 228], [206, 220, 232], [236, 238, 238]],
    bottom: [[112, 156, 212], [150, 180, 220], [196, 204, 218], [234, 222, 212], [252, 238, 222]],
    stars: 0,
    cloud: [255, 250, 238],
    sun: [[255, 252, 232], [255, 236, 162], [255, 246, 212]],
  },
};

// Keyframes as % of the cycle. Two keys with the same phase are a hold; the
// stretch between two holds eases in and out as one run, so the phases it
// passes through blend straight on instead of stalling at each one.
const KEYS: [number, string][] = [
  [0, 'day'], [16, 'day'],
  [22, 'afternoon'],
  [27, 'golden'],
  [31, 'sunset'], [39, 'sunset'],
  [43, 'afterglow'],
  [47, 'dusk'],
  [51, 'blueHour'],
  [55, 'night'], [65, 'night'],
  [69, 'preDawn'],
  [73, 'dawn'],
  [77, 'sunrise'], [85, 'sunrise'],
  [90, 'morning'],
  [96, 'day'], [100, 'day'],
];

// Keys that start or end a hold.
const ANCHORS = KEYS.map((_, i) => i).filter(
  (i) => (i > 0 && KEYS[i - 1][1] === KEYS[i][1]) || (i < KEYS.length - 1 && KEYS[i + 1][1] === KEYS[i][1]),
);

function easedPosition(s: number) {
  let a = 0;
  while (a < ANCHORS.length - 2 && s >= KEYS[ANCHORS[a + 1]][0]) a++;
  const from = KEYS[ANCHORS[a]][0];
  const to = KEYS[ANCHORS[a + 1]][0];
  const f = Math.min(1, Math.max(0, (s - from) / (to - from)));
  return from + f * f * (3 - 2 * f) * (to - from);
}

// The sky at position u (0..1) through the cycle.
export function mixPhase(u: number): SkyMix {
  const s = easedPosition((((u % 1) + 1) % 1) * 100);
  let i = 0;
  while (i < KEYS.length - 2 && s >= KEYS[i + 1][0]) i++;
  const [t0, a] = KEYS[i];
  const [t1, b] = KEYS[i + 1];
  const f = Math.min(1, Math.max(0, (s - t0) / (t1 - t0)));
  const from = PHASES[a];
  const to = PHASES[b];
  return {
    top: from.top.map((c, l) => lerp3(c, to.top[l], f)),
    bottom: from.bottom.map((c, l) => lerp3(c, to.bottom[l], f)),
    stars: from.stars + (to.stars - from.stars) * f,
    cloud: lerp3(from.cloud, to.cloud, f),
    sun: [lerp3(from.sun[0], to.sun[0], f), lerp3(from.sun[1], to.sun[1], f), lerp3(from.sun[2], to.sun[2], f)],
  };
}

function channel(v: number) {
  v /= 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

// Relative luminance of a colour (0 black .. 1 white), as used for contrast ratios.
export function luminance(c: RGB) {
  return 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
}

// Average relative luminance of the sky's palette, used to pick the text colour.
export function skyLuminance(mix: SkyMix) {
  let sum = 0;
  for (let l = 0; l < mix.top.length; l++) sum += luminance(mix.top[l]) + luminance(mix.bottom[l]);
  return sum / (mix.top.length * 2);
}
