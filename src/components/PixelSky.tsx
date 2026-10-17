import React, { useLayoutEffect, useRef } from 'react';
import { FRINGE, drawBase } from './sky/base';
import { drawFrontClouds, makeCloudPool, type CloudLayer, type DotCloud } from './sky/clouds';
import type { Tag } from './sky/context';
import { mixPhase, skyLuminance, type SkyMix } from './sky/phases';
import { BLOCK, PIXEL, hash, lerp3 } from './sky/pixel';
import { DAY_SECONDS, planDay, type DayPlan } from './sky/plan';
import { PREVIEW_DAY, blankPlan, findPreview, playPreview } from './sky/preview';
import { makeFrame, renderSky } from './sky/render';
import { applyWeather, weatherAt, type SkyWeather } from './sky/weather';

const REVEAL_SECONDS = 2.4;
// How far (in CSS px) the dot clouds may drift outside the box, the same on every
// side. Keep it a multiple of PIXEL * 2 so the dot lattice lines up with the sky pixels.
const SPILL = 96;
// Overall pace of the dot clouds' drift.
const CLOUD_SPEED = 0.8;
// Past this the wipe has crossed every block, so the text mask can come off.
const REVEAL_DONE = 1.6;
// Text on the sky turns white once the sky's average luminance drops below the
// first value and black again above the second (black and white read about
// equally well near 0.18; the gap stops it flickering at the crossover).
const INK_LIGHT_BELOW = 0.19;
const INK_DARK_ABOVE = 0.21;
// A text colour change rolls down the box over this long as a soft-edged
// horizontal front, so everything on the same line turns together.
const INK_SWEEP_SECONDS = 2.5;
// Height of the front's soft edge, as a share of the text block's height.
const INK_FEATHER = 0.15;
// How long a sight's name tag stays up after a tap on a touch screen.
const TAG_SECONDS = 2.5;

function setMask(el: HTMLElement, mask: string | null) {
  for (const prop of ['mask-image', '-webkit-mask-image']) {
    if (mask) el.style.setProperty(prop, mask);
    else el.style.removeProperty(prop);
  }
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

type SkyNow = { n: number; u: number; weather: SkyWeather; plan: DayPlan };

// The sky runs through a day every three minutes on a clock every visitor shares,
// with weather that changes over its own timeline and sights rolled for each day.
// While the sky is dark it marks its parent box data-sky-ink="light" so the text
// on it turns white. Adding ?sky=<name> to the address plays one sight on a loop.
export function PixelSky({ className, revealTarget }: PixelSkyProps) {
  const skyRef = useRef<HTMLCanvasElement>(null);
  const cloudRef = useRef<HTMLCanvasElement>(null);
  const tagRef = useRef<HTMLSpanElement>(null);

  // Layout effect so the text is masked before the first paint.
  useLayoutEffect(() => {
    const sky = skyRef.current;
    const cloudCanvas = cloudRef.current;
    const skyCtx = sky?.getContext('2d');
    const cloudCtx = cloudCanvas?.getContext('2d');
    if (!sky || !cloudCanvas || !skyCtx || !cloudCtx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const preview = findPreview(new URLSearchParams(window.location.search).get('sky'));
    let cols = 0;
    let rows = 0;
    let skyImage: ImageData | null = null;
    let layer: CloudLayer | null = null;
    let field = new Float32Array(1);
    let clouds: DotCloud[] = [];
    let frame = 0;
    const start = performance.now();
    let last = start;
    // How far the background bands and the dot clouds have drifted. The wind sets
    // their pace and turns them around when it changes direction.
    let travel = reduceMotion ? 40 : 0;
    let cloudTravel = reduceMotion ? 40 : 0;
    const content = revealTarget?.current ?? null;
    const target = reduceMotion ? null : content;
    let masking = !!target;
    const box = sky.parentElement;

    // Everyone shares one sky: the day runs off the wall clock, so every visitor
    // sees the same weather and the same sights at the same moment. A preview
    // instead plays its sight on a loop from when the page opened.
    let plan: DayPlan | null = null;
    let planDayNumber = -1;
    if (preview) {
      plan = blankPlan(PREVIEW_DAY);
      preview.setup?.(plan, preview.u);
    }
    const skyNow = (t: number): SkyNow => {
      if (preview && plan) return { ...playPreview(preview, plan, t), plan };
      const days = Date.now() / 1000 / DAY_SECONDS;
      const n = Math.floor(days);
      if (n !== planDayNumber || !plan) {
        plan = planDay(n);
        planDayNumber = n;
      }
      return { n, u: days - n, weather: weatherAt(n, days - n), plan };
    };

    // Open with the text colour that suits the sky right now; later changes sweep.
    const opening = skyNow(0);
    let inkLight = skyLuminance(applyWeather(mixPhase(opening.u), opening.weather)) < INK_LIGHT_BELOW;
    if (inkLight) box?.setAttribute('data-sky-ink', 'light');
    let inkSweep: { light: boolean; start: number; ghost: HTMLElement } | null = null;

    // Name tags: hovering (or tapping) near a sight shows what it is.
    let tags: Tag[] = [];
    let pointer: { x: number; y: number; until: number } | null = null;
    let tagName = '';
    const pointAt = (e: PointerEvent, until: number) => {
      const rect = sky.getBoundingClientRect();
      pointer = { x: ((e.clientX - rect.left) / rect.width) * cols, y: ((e.clientY - rect.top) / rect.height) * rows, until };
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') pointAt(e, Infinity);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') pointAt(e, performance.now() + TAG_SECONDS * 1000);
    };
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') pointer = null;
    };
    box?.addEventListener('pointermove', onMove);
    box?.addEventListener('pointerdown', onDown);
    box?.addEventListener('pointerleave', onLeave);

    const resize = () => {
      const rect = sky.getBoundingClientRect();
      const cloudRect = cloudCanvas.getBoundingClientRect();
      cols = Math.max(1, Math.ceil(rect.width / PIXEL));
      rows = Math.max(1, Math.ceil(rect.height / PIXEL));
      const cloudCols = Math.max(1, Math.ceil(cloudRect.width / PIXEL));
      const cloudRows = Math.max(1, Math.ceil(cloudRect.height / PIXEL));
      const spillX = Math.round((rect.left - cloudRect.left) / PIXEL);
      const spillY = Math.round((rect.top - cloudRect.top) / PIXEL);
      sky.width = cols;
      sky.height = rows;
      cloudCanvas.width = cloudCols;
      cloudCanvas.height = cloudRows;
      skyImage = skyCtx.createImageData(cols, rows);
      field = new Float32Array(Math.ceil(cols / BLOCK) * Math.ceil(rows / BLOCK) + 8);
      layer = { img: cloudCtx.createImageData(cloudCols, cloudRows), cols: cloudCols, rows: cloudRows, spillX, spillY, boxCols: cols, boxRows: rows };
      clouds = makeCloudPool(cloudCols, cloudRows, 11, spillY, CLOUD_SPEED);
    };

    const clearMask = () => {
      target?.style.removeProperty('clip-path');
    };

    const setInk = (light: boolean) => {
      if (light) box?.setAttribute('data-sky-ink', 'light');
      else box?.removeAttribute('data-sky-ink');
    };

    const endSweep = () => {
      if (!inkSweep) return;
      setInk(inkSweep.light);
      inkSweep.ghost.remove();
      if (content) setMask(content, null);
      inkSweep = null;
    };

    // When the sky crosses between light and dark, roll the new text colour down
    // the box. A copy of the text in the new colour sits exactly over the original
    // and is uncovered top to bottom through a soft-edged mask while the original
    // fades out beneath it, so a whole line (both link columns, underlines, icons)
    // turns at once. Then the original takes the new colour and the copy goes.
    const updateInk = (mix: SkyMix, t: number) => {
      const lum = skyLuminance(mix);
      const light = lum < INK_LIGHT_BELOW ? true : lum > INK_DARK_ABOVE ? false : inkLight;
      if (light !== inkLight) {
        inkLight = light;
        endSweep();
        if (!content || !box || masking || reduceMotion) {
          setInk(light);
        } else {
          const ghost = content.cloneNode(true) as HTMLElement;
          const from = content.getBoundingClientRect();
          const parent = box.getBoundingClientRect();
          ghost.setAttribute('aria-hidden', 'true');
          ghost.setAttribute('inert', '');
          Object.assign(ghost.style, {
            position: 'absolute',
            left: `${from.left - parent.left}px`,
            top: `${from.top - parent.top}px`,
            width: `${from.width}px`,
            height: `${from.height}px`,
            margin: '0',
            pointerEvents: 'none',
          });
          ghost.style.setProperty('--sky-ink', light ? '#fff' : '#000');
          content.after(ghost);
          inkSweep = { light, start: t, ghost };
        }
      }
      if (!inkSweep || !content) return;
      const elapsed = t - inkSweep.start;
      const p = Math.min(1, elapsed / INK_SWEEP_SECONDS);
      const front = p * p * (3 - 2 * p) * (1 + INK_FEATHER);
      const solid = `${(front - INK_FEATHER) * 100}%`;
      const edge = `${front * 100}%`;
      setMask(inkSweep.ghost, `linear-gradient(to bottom, #000 ${solid}, transparent ${edge})`);
      setMask(content, `linear-gradient(to bottom, transparent ${solid}, #000 ${edge})`);
      // Once the copy covers everything, hand the colour to the real text, then drop
      // the copy a moment later so any colour transitions on the links have settled.
      if (p >= 1) setInk(inkSweep.light);
      if (elapsed >= INK_SWEEP_SECONDS + 0.3) endSweep();
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
      const rect = sky.getBoundingClientRect();
      const own = target.getBoundingClientRect();
      const ox = rect.left - own.left;
      const oy = rect.top - own.top;
      const points = [`${ox}px ${oy}px`];
      for (let by = 0; by < blockRows; by++) {
        let shown = 0;
        while (shown < blockCols && reveal - revealFront(shown, by, blockCols, blockRows) >= FRINGE) shown++;
        const x = ox + Math.min(shown * blockSize, rect.width);
        const y = oy + by * blockSize;
        points.push(`${x}px ${y}px`, `${x}px ${Math.min(y + blockSize, oy + rect.height)}px`);
      }
      points.push(`${ox}px ${oy + rect.height}px`);
      target.style.clipPath = `polygon(${points.join(', ')})`;
    };

    // Show the name of the sight under the pointer, over the sight itself (or by the
    // pointer for things that fill the sky, like a snowstorm). Once up, a tag
    // follows its sight for a moment even after it drifts out from under the pointer.
    let tagSeen = 0;
    const showTag = (now: number) => {
      const el = tagRef.current;
      if (!el) return;
      if (pointer && now > pointer.until) pointer = null;
      let hit: Tag | null = null;
      if (pointer) {
        let best = Infinity;
        for (const tag of tags) {
          const d = Math.hypot(tag.x - pointer.x, tag.y - pointer.y);
          if (d <= tag.r + 6 && d < best) {
            best = d;
            hit = tag;
          }
        }
        if (hit) tagSeen = now;
        else if (tagName && now - tagSeen < 1200) hit = tags.find((tag) => tag.name === tagName) ?? null;
      }
      if (!hit || !pointer) {
        if (tagName) {
          el.removeAttribute('data-shown');
          tagName = '';
        }
        return;
      }
      if (hit.name !== tagName) {
        el.textContent = hit.name;
        el.setAttribute('data-shown', '');
        tagName = hit.name;
      }
      const wide = hit.r > cols / 5;
      const x = wide ? pointer.x : hit.x;
      const y = wide ? pointer.y - 2 : hit.y - Math.min(hit.r, 12);
      el.style.left = `${(Math.min(cols - 4, Math.max(4, x)) / cols) * 100}%`;
      el.style.top = `${(Math.max(6, y) / rows) * 100}%`;
    };

    const draw = (now: number) => {
      const t = reduceMotion ? 40 : (now - start) / 1000;
      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      const reveal = reduceMotion ? 3 : Math.min(3, (t / REVEAL_SECONDS) * 1.5);
      const { n, u, weather, plan: today } = skyNow(t);
      if (!reduceMotion) {
        travel += dt * (0.6 + weather.wind * 1.6) * (weather.windDir >= 0 ? 1 : -1) * Math.max(0.15, Math.abs(weather.windDir));
        cloudTravel += dt * (0.55 + weather.wind * 1.5) * weather.windDir;
      }
      if (skyImage && layer) {
        const f = makeFrame({ img: skyImage, field, t, sec: Date.now() / 1000, u, n, dayLength: DAY_SECONDS, plan: today, weather, travel });
        const blockCols = Math.ceil(cols / BLOCK);
        const blockRows = Math.ceil(rows / BLOCK);
        drawBase(f, (bx, by) => reveal - revealFront(bx, by, blockCols, blockRows));
        // Reduced motion shows the shared sky as a still frame, without the sights.
        if (!reduceMotion) renderSky(f);
        skyCtx.putImageData(skyImage, 0, 0);
        const appear = Math.min(1, Math.max(0, reveal - 0.4) * 1.5);
        const behind = lerp3(f.mix.top[2], f.mix.bottom[2], 0.5);
        drawFrontClouds(layer, clouds, t, cloudTravel, weather, f.mix.cloud, behind, appear, f.flash);
        cloudCtx.putImageData(layer.img, 0, 0);
        tags = reveal > REVEAL_DONE ? f.tags : [];
        updateInk(f.mix, t);
      }
      drawMask(reveal);
      showTag(now);
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
      box?.removeEventListener('pointermove', onMove);
      box?.removeEventListener('pointerdown', onDown);
      box?.removeEventListener('pointerleave', onLeave);
      clearMask();
      endSweep();
      box?.removeAttribute('data-sky-ink');
    };
  }, [revealTarget]);

  return (
    <>
      <canvas ref={skyRef} className={className} aria-hidden="true" />
      <canvas
        ref={cloudRef}
        className="profile-clouds"
        aria-hidden="true"
        style={{ '--spill': `${SPILL}px` } as React.CSSProperties}
      />
      <span ref={tagRef} className="profile-sky-tag" aria-hidden="true" />
    </>
  );
}
