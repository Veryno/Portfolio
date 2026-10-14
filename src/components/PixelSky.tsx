import React, { useLayoutEffect, useRef } from 'react';

// Size of one rendered "pixel" in CSS px. Both layers are drawn at low
// resolution and scaled up with nearest-neighbour sampling for the crunchy look.
const PIXEL = 3;
// Colour blocks are BLOCK x BLOCK pixels; dithering happens inside each block.
const BLOCK = 5;
const REVEAL_SECONDS = 2.4;
// How far (in CSS px) the dot clouds may drift outside the box. Keep these
// multiples of PIXEL * 2 so the dot lattice lines up with the sky pixels.
const SPILL_X = 96;
const SPILL_Y = 48;
// Sky drift speed in sky pixels per second (left to right, against the dot clouds).
const SKY_SPEED = 9;

// Deep blue -> pale sky, sampled from the reference animation.
const PALETTE: [number, number, number][] = [
  [70, 134, 208],
  [98, 156, 218],
  [140, 182, 226],
  [186, 210, 230],
  [218, 228, 236],
];
const SHADOW: [number, number, number] = [20, 22, 26];
// Width of the dark fringe at the wipe front; content only shows behind it.
const FRINGE = 0.09;
// Past this the wipe has crossed every block, so the text mask can come off.
const REVEAL_DONE = 1.6;

// 4x4 ordered-dither matrix, normalised to [0, 1).
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function skyField(x: number, y: number, t: number) {
  // Wide horizontal bands of cloud drifting left to right.
  const sx = (x - t * SKY_SPEED / BLOCK) * 0.075;
  const sy = y * 0.13;
  let n = valueNoise(sx, sy) * 0.6;
  n += valueNoise(sx * 2.2 + 17, sy * 2.2 - t * 0.03) * 0.28;
  n += valueNoise(sx * 5 - 5, sy * 5 + 9) * 0.12;
  // Stretch contrast so there are bold deep-blue rivers and bright cloud banks.
  return Math.min(1, Math.max(0, (n - 0.28) / 0.44));
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
      speed: fast ? 14 + hash(i, seed + 5) * 12 : 1.5 + hash(i, seed + 5) * 9,
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
  // Element whose contents should appear only where the sky has been revealed.
  revealTarget?: React.RefObject<HTMLElement | null>;
};

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
    const target = reduceMotion ? null : revealTarget?.current ?? null;
    let masking = !!target;

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

    const drawSky = (t: number, reveal: number) => {
      if (!skyImage) return;
      const data = skyImage.data;
      const blockCols = Math.ceil(cols / BLOCK);
      const blockRows = Math.ceil(rows / BLOCK);

      for (let by = 0; by < blockRows; by++) {
        for (let bx = 0; bx < blockCols; bx++) {
          const edge = reveal - revealFront(bx, by, blockCols, blockRows);
          const value = skyField(bx, by, t);
          const level = value * (PALETTE.length - 1);
          const lo = Math.floor(level);
          // Snap most blocks to a solid colour and only dither the in-between ones.
          const raw = level - lo;
          const frac = raw < 0.3 ? 0 : raw > 0.7 ? 1 : (raw - 0.3) / 0.4;

          for (let py = 0; py < BLOCK; py++) {
            const y = by * BLOCK + py;
            if (y >= rows) break;
            for (let px = 0; px < BLOCK; px++) {
              const x = bx * BLOCK + px;
              if (x >= cols) break;
              const i = (y * cols + x) * 4;
              const threshold = BAYER[(y & 3) * 4 + (x & 3)];
              let color: [number, number, number] | null;
              if (edge < 0) {
                color = null;
              } else if (edge < FRINGE) {
                // Dark checkered fringe right at the wipe front.
                color = threshold < (edge < 0.045 ? 0.35 : 0.65) ? SHADOW : null;
              } else {
                color = PALETTE[Math.min(PALETTE.length - 1, frac > threshold ? lo + 1 : lo)];
              }
              if (color) {
                data[i] = color[0];
                data[i + 1] = color[1];
                data[i + 2] = color[2];
                data[i + 3] = 255;
              } else {
                data[i + 3] = 0;
              }
            }
          }
        }
      }
      skyCtx.putImageData(skyImage, 0, 0);
    };

    const drawClouds = (t: number, reveal: number) => {
      if (!cloudImage) return;
      const data = cloudImage.data;
      data.fill(0);
      const appear = Math.min(1, Math.max(0, reveal - 0.4) * 1.5);
      if (appear === 0) return;

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
            data[i] = 255;
            data[i + 1] = 255;
            data[i + 2] = 255;
            data[i + 3] = inside ? 255 : 200;
          }
        }
      }
      cloudCtx.putImageData(cloudImage, 0, 0);
    };

    const clearMask = () => {
      target?.style.removeProperty('clip-path');
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
      drawSky(t, reveal);
      drawClouds(t, reveal);
      drawMask(reveal);
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
