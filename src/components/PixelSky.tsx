import React, { useLayoutEffect, useRef } from 'react';
import { drawEvents, planCycle } from './sky/events';
import { mixPhase, skyLuminance, type SkyMix } from './sky/phases';
import { BLOCK, PIXEL, SKY_SPEED, STAR, STAR_DIM, bayer, hash, lerp3, put, skyField, type RGB } from './sky/pixel';

const REVEAL_SECONDS = 2.4;
// One full loop of the background: day, sunset, night, sunrise and back to day.
const CYCLE_SECONDS = 180;
// How far (in CSS px) the dot clouds may drift outside the box. Keep these
// multiples of PIXEL * 2 so the dot lattice lines up with the sky pixels.
const SPILL_X = 96;
const SPILL_Y = 48;
// Overall pace of the dot clouds' drift.
const CLOUD_SPEED = 0.8;

const SHADOW: RGB = [20, 22, 26];
// Width of the dark fringe at the wipe front; content only shows behind it.
const FRINGE = 0.09;
// Past this the wipe has crossed every block, so the text mask can come off.
const REVEAL_DONE = 1.6;
// Text on the sky turns white once the sky's average luminance drops below the
// first value and black again above the second (black and white read about
// equally well near 0.18; the gap stops it flickering at the crossover).
const INK_LIGHT_BELOW = 0.19;
const INK_DARK_ABOVE = 0.21;
// A text colour change sweeps across the box over this long, top-left first
// like the reveal, turning one piece of text at a time in reading order.
const INK_SWEEP_SECONDS = 3;
// The pieces of text that turn individually (each fades briefly; see index.css).
const INK_UNITS = 'h1, h3, p, a, .profile-divider';

// A twinkling star at sky pixel (x, y), or null. Keyed to the drifting sky so
// stars travel with it; more of them come out as amount rises toward full night.
function starAt(x: number, y: number, t: number, amount: number): RGB | null {
  if (hash(x * 7 + 3, y * 13 + 5) >= 0.006) return null;
  const twinkle = 0.5 + 0.5 * Math.sin(t * (1.2 + hash(x, y + 77) * 2.5) + hash(x + 9, y) * Math.PI * 2);
  if (amount * (0.35 + 0.65 * twinkle) <= hash(x + 31, y + 41) * 0.5 + 0.35) return null;
  return twinkle > 0.6 ? STAR : STAR_DIM;
}

type DotCloud = {
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  bobAmp: number;
  bobRate: number;
  bobPhase: number;
  // Round puffs [centre x offset, radius]; their union above a flat base is the cloud.
  lobes: [number, number][];
};

function makeClouds(cols: number, rows: number, seed: number): DotCloud[] {
  const clouds: DotCloud[] = [];
  const count = Math.max(6, Math.round((cols * rows) / 2400));
  for (let i = 0; i < count; i++) {
    // Mix of small puffs, mid-size cumulus and a few big banks; squaring the
    // random value keeps small clouds common and large ones rare.
    const size = hash(i, seed + 3);
    const scale = 0.45 + size * size * 1.8;
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
    clouds.push({
      x: hash(i, seed + 1) * (cols + w * 2),
      y: rows * (0.06 + 0.92 * hash(i, seed + 2)),
      w,
      h: Math.max(...lobes.map(([, r]) => r * 1.5)),
      speed: (fast ? 14 + hash(i, seed + 5) * 12 : 1.5 + hash(i, seed + 5) * 9) * CLOUD_SPEED,
      bobAmp: 1 + hash(i, seed + 13) * 6,
      bobRate: 0.15 + hash(i, seed + 14) * 0.5,
      bobPhase: hash(i, seed + 15) * Math.PI * 2,
      lobes: lobes.map(([o, r]) => [o - (left + right) / 2, r]),
    });
  }
  return clouds;
}

// How far inside the cloud a point is: > 0 inside, < 0 outside, ~0 on the outline.
function cloudDepth(cloud: DotCloud, dx: number, up: number) {
  if (up < 0) return -1;
  let depth = -Infinity;
  for (const [offset, r] of cloud.lobes) {
    // Puff centres sit a little above the base so the bottom stays flat.
    const cy = r * 0.5;
    depth = Math.max(depth, r - Math.hypot(dx - offset, up - cy));
  }
  return depth;
}

// Ragged, stair-stepped reveal front sweeping from the top-left.
function revealFront(bx: number, by: number, blockCols: number, blockRows: number) {
  return (bx / blockCols) * 0.75 + (by / blockRows) * 0.55 + hash(by, 99) * 0.12;
}

type PixelSkyProps = {
  className?: string;
  // Element holding the text on the sky: it appears only where the sky has been
  // revealed, and its text changes colour as the sky darkens and brightens.
  revealTarget?: React.RefObject<HTMLElement | null>;
};

// The sky cycles through a day every three minutes, with the occasional sun,
// moon, shooting star or ISS pass. While the sky is dark it marks its parent box
// data-sky-ink="light" so the text on it switches to white.
export function PixelSky({ className, revealTarget }: PixelSkyProps) {
  const skyRef = useRef<HTMLCanvasElement>(null);
  const cloudRef = useRef<HTMLCanvasElement>(null);

  // Layout effect so the text is masked before the first paint.
  useLayoutEffect(() => {
    const sky = skyRef.current;
    const cloudCanvas = cloudRef.current;
    const skyCtx = sky?.getContext('2d');
    const cloudCtx = cloudCanvas?.getContext('2d');
    if (!sky || !cloudCanvas || !skyCtx || !cloudCtx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cols = 0;
    let rows = 0;
    let cloudCols = 0;
    let cloudRows = 0;
    let spillX = 0;
    let spillY = 0;
    let skyImage: ImageData | null = null;
    let cloudImage: ImageData | null = null;
    let clouds: DotCloud[] = [];
    let frame = 0;
    const start = performance.now();
    const content = revealTarget?.current ?? null;
    const target = reduceMotion ? null : content;
    let masking = !!target;
    // Each visit gets its own run of events; the loop always opens on the daytime sky.
    const seed = Math.floor(Math.random() * 10000);
    let cycle = 0;
    let plan = planCycle(seed);
    const box = sky.parentElement;
    let inkLight = false;
    let inkSweep: { light: boolean; start: number; units: { el: HTMLElement; at: number }[] } | null = null;

    const resize = () => {
      const rect = sky.getBoundingClientRect();
      const cloudRect = cloudCanvas.getBoundingClientRect();
      cols = Math.max(1, Math.ceil(rect.width / PIXEL));
      rows = Math.max(1, Math.ceil(rect.height / PIXEL));
      cloudCols = Math.max(1, Math.ceil(cloudRect.width / PIXEL));
      cloudRows = Math.max(1, Math.ceil(cloudRect.height / PIXEL));
      spillX = Math.round((rect.left - cloudRect.left) / PIXEL);
      spillY = Math.round((rect.top - cloudRect.top) / PIXEL);
      sky.width = cols;
      sky.height = rows;
      cloudCanvas.width = cloudCols;
      cloudCanvas.height = cloudRows;
      skyImage = skyCtx.createImageData(cols, rows);
      cloudImage = cloudCtx.createImageData(cloudCols, cloudRows);
      clouds = makeClouds(cloudCols, cloudRows, 11);
    };

    const drawSky = (t: number, reveal: number, mix: SkyMix) => {
      if (!skyImage) return;
      const data = skyImage.data;
      const blockCols = Math.ceil(cols / BLOCK);
      const blockRows = Math.ceil(rows / BLOCK);
      const levels = mix.top.length;
      const shift = Math.floor(t * SKY_SPEED);

      for (let by = 0; by < blockRows; by++) {
        // This row's palette: the phase's top colours fading into its horizon colours.
        const gy = blockRows > 1 ? by / (blockRows - 1) : 0;
        const palette = mix.top.map((c, l) => lerp3(c, mix.bottom[l], gy).map(Math.round) as RGB);
        for (let bx = 0; bx < blockCols; bx++) {
          const edge = reveal - revealFront(bx, by, blockCols, blockRows);
          const value = skyField(bx, by, t);
          const level = value * (levels - 1);
          const lo = Math.floor(level);
          // Snap most blocks to a solid colour and only dither the in-between ones.
          const raw = level - lo;
          const frac = raw < 0.3 ? 0 : raw > 0.7 ? 1 : (raw - 0.3) / 0.4;
          // Stars only show through the darker, clear patches of sky.
          const starry = mix.stars > 0 && value < 0.42;

          for (let py = 0; py < BLOCK; py++) {
            const y = by * BLOCK + py;
            if (y >= rows) break;
            for (let px = 0; px < BLOCK; px++) {
              const x = bx * BLOCK + px;
              if (x >= cols) break;
              const i = (y * cols + x) * 4;
              const threshold = bayer(x, y);
              let color: RGB | null;
              if (edge < 0) {
                color = null;
              } else if (edge < FRINGE) {
                // Dark checkered fringe right at the wipe front.
                color = threshold < (edge < 0.045 ? 0.35 : 0.65) ? SHADOW : null;
              } else {
                color = palette[Math.min(levels - 1, frac > threshold ? lo + 1 : lo)];
                if (starry) color = starAt(x - shift, y, t, mix.stars) ?? color;
              }
              if (color) {
                put(data, i, color);
                data[i + 3] = 255;
              } else {
                data[i + 3] = 0;
              }
            }
          }
        }
      }
    };

    // The dot clouds take on a little of the sky's colour: warm at sunrise and
    // sunset, moonlit blue at night.
    const drawClouds = (t: number, reveal: number, tint: RGB) => {
      if (!cloudImage) return;
      const data = cloudImage.data;
      data.fill(0);
      const appear = Math.min(1, Math.max(0, reveal - 0.4) * 1.5);
      if (appear === 0) return;
      const [r, g, b] = tint.map(Math.round);

      for (let ci = 0; ci < clouds.length; ci++) {
        const cloud = clouds[ci];
        const span = cloudCols + cloud.w * 2;
        const cx = ((((cloud.x - t * cloud.speed) % span) + span) % span) - cloud.w;
        const x0 = Math.floor(cx - cloud.w / 2) - 1;
        const base = Math.round(cloud.y + Math.sin(t * cloud.bobRate + cloud.bobPhase) * cloud.bobAmp);
        for (let x = x0; x <= x0 + cloud.w + 2; x++) {
          if (x < 0 || x >= cloudCols || x & 1) continue;
          const dx = x - cx;
          for (let y = base - Math.ceil(cloud.h); y <= base; y++) {
            if (y < 0 || y >= cloudRows || y & 1) continue;
            const depth = cloudDepth(cloud, dx, base - y);
            if (depth < 0) continue;
            // Solid body with a slightly broken, sparkly outline. The hash is keyed
            // to the cloud's own grid so the pattern doesn't shimmer as it drifts.
            const outline = depth < 1.6;
            const keep = outline ? 0.55 : 0.97;
            if (hash(Math.round(dx) * 31 + ci, base - y) > keep * appear) continue;
            // Dots outside the box are slightly dimmer so they read as spill.
            const sx = x - spillX;
            const sy = y - spillY;
            const inside = sx >= 0 && sy >= 0 && sx < cols && sy < rows;
            const i = (y * cloudCols + x) * 4;
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = inside ? 255 : 200;
          }
        }
      }
      cloudCtx.putImageData(cloudImage, 0, 0);
    };

    const clearMask = () => {
      target?.style.removeProperty('clip-path');
    };

    // When the sky crosses between light and dark, sweep the new text colour across
    // the box: each piece of text takes it as the front passes, then the box takes
    // over the colour once they all have.
    const updateInk = (mix: SkyMix, t: number) => {
      const lum = skyLuminance(mix);
      const light = lum < INK_LIGHT_BELOW ? true : lum > INK_DARK_ABOVE ? false : inkLight;
      if (light !== inkLight) {
        inkLight = light;
        const area = sky.getBoundingClientRect();
        const units = Array.from(content?.querySelectorAll<HTMLElement>(INK_UNITS) ?? [], (el) => {
          // Timed from the element's top-left corner, so text turns as the front reaches it.
          const r = el.getBoundingClientRect();
          const fx = (r.left - area.left) / area.width;
          const fy = (r.top - area.top) / area.height;
          return { el, at: Math.min(1, Math.max(0, (fx * 0.75 + fy * 0.55) / 1.3)) * INK_SWEEP_SECONDS };
        });
        inkSweep = { light, start: t, units };
      }
      if (!inkSweep) return;
      const color = inkSweep.light ? '#fff' : '#000';
      let pending = false;
      for (const unit of inkSweep.units) {
        if (t - inkSweep.start >= unit.at) unit.el.style.setProperty('--sky-ink', color);
        else pending = true;
      }
      if (pending) return;
      if (inkSweep.light) box?.setAttribute('data-sky-ink', 'light');
      else box?.removeAttribute('data-sky-ink');
      for (const unit of inkSweep.units) unit.el.style.removeProperty('--sky-ink');
      inkSweep = null;
    };

    // Clip the text to the revealed area of the sky so it appears with the wipe.
    // The front only moves left to right within a row, so the revealed area is a
    // staircase hugging the left edge and fits in a single polygon.
    const drawMask = (reveal: number) => {
      if (!masking || !target) return;
      if (reveal > REVEAL_DONE) {
        masking = false;
        clearMask();
        return;
      }
      const blockCols = Math.ceil(cols / BLOCK);
      const blockRows = Math.ceil(rows / BLOCK);
      const blockSize = BLOCK * PIXEL;
      const box = sky.getBoundingClientRect();
      const own = target.getBoundingClientRect();
      const ox = box.left - own.left;
      const oy = box.top - own.top;
      const points = [`${ox}px ${oy}px`];
      for (let by = 0; by < blockRows; by++) {
        let shown = 0;
        while (shown < blockCols && reveal - revealFront(shown, by, blockCols, blockRows) >= FRINGE) shown++;
        const x = ox + Math.min(shown * blockSize, box.width);
        const y = oy + by * blockSize;
        points.push(`${x}px ${y}px`, `${x}px ${Math.min(y + blockSize, oy + box.height)}px`);
      }
      points.push(`${ox}px ${oy + box.height}px`);
      target.style.clipPath = `polygon(${points.join(', ')})`;
    };

    const draw = (now: number) => {
      const t = reduceMotion ? 40 : (now - start) / 1000;
      const reveal = reduceMotion ? 3 : Math.min(3, (t / REVEAL_SECONDS) * 1.5);
      // Reduced motion keeps the daytime sky and skips the events.
      const cycles = reduceMotion ? 0 : t / CYCLE_SECONDS;
      if (Math.floor(cycles) !== cycle) {
        cycle = Math.floor(cycles);
        plan = planCycle(seed + cycle);
      }
      const u = cycles - cycle;
      const mix = mixPhase(u);
      drawSky(t, reveal, mix);
      if (skyImage) {
        if (!reduceMotion) drawEvents(skyImage, t, u, mix, plan, CYCLE_SECONDS);
        skyCtx.putImageData(skyImage, 0, 0);
      }
      drawClouds(t, reveal, mix.cloud);
      drawMask(reveal);
      updateInk(mix, t);
      if (!reduceMotion) frame = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion) draw(performance.now());
    });
    observer.observe(sky);
    observer.observe(cloudCanvas);
    resize();
    drawMask(0);
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      clearMask();
      box?.removeAttribute('data-sky-ink');
      inkSweep?.units.forEach((unit) => unit.el.style.removeProperty('--sky-ink'));
    };
  }, [revealTarget]);

  return (
    <>
      <canvas ref={skyRef} className={className} aria-hidden="true" />
      <canvas
        ref={cloudRef}
        className="profile-clouds"
        aria-hidden="true"
        style={{ '--spill-x': `${SPILL_X}px`, '--spill-y': `${SPILL_Y}px` } as React.CSSProperties}
      />
    </>
  );
}
