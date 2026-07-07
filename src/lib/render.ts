import type { Adjustments, CropRect, EffectType, Overlay, PresetFilter } from '../types';
import { buildFilterCss } from './filterCss';
import { computeColorDistortionOffsets, computeEffectTransform, cyclePhase, hash } from './effects';

export interface RenderOptions {
  naturalWidth: number;
  naturalHeight: number;
  crop: CropRect | null;
  adjustments: Adjustments;
  preset: PresetFilter;
  vignette: number;
  overlays: Overlay[];
  effect?: EffectType;
  effectTime?: number;
}

function effectiveCrop(crop: CropRect | null): CropRect {
  return crop ?? { x: 0, y: 0, width: 1, height: 1 };
}

/** Renders one frame (image or a video's current frame) into ctx, applying
 * crop, filters, effects, vignette, sharpen and overlays. Used by live image
 * preview, image export, the effect-driven video preview, and video export,
 * so all four stay pixel-identical. */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  opts: RenderOptions,
): void {
  const { naturalWidth, naturalHeight, adjustments, preset, vignette, overlays } = opts;
  const effect = opts.effect ?? 'none';
  const effectTime = opts.effectTime ?? 0;
  const crop = effectiveCrop(opts.crop);
  const outWidth = ctx.canvas.width;
  const outHeight = ctx.canvas.height;

  const sx = crop.x * naturalWidth;
  const sy = crop.y * naturalHeight;
  const sw = crop.width * naturalWidth;
  const sh = crop.height * naturalHeight;

  const fx = computeEffectTransform(effect, effectTime);

  let usedFrozenHeld = false;
  if (effect === 'faultFreeze' && shouldFreeze(effectTime)) {
    const held = getHeld(ctx.canvas, outWidth, outHeight);
    ctx.save();
    ctx.clearRect(0, 0, outWidth, outHeight);
    ctx.drawImage(held, 0, 0);
    ctx.restore();
    usedFrozenHeld = true;
  }

  if (!usedFrozenHeld) {
    ctx.save();
    ctx.clearRect(0, 0, outWidth, outHeight);
    ctx.translate(outWidth / 2, outHeight / 2);
    ctx.scale(fx.scale, fx.scale);
    ctx.translate(fx.translateXFrac * outWidth, fx.translateYFrac * outHeight);
    ctx.translate(-outWidth / 2, -outHeight / 2);
    ctx.filter = fx.blurPx > 0 ? `${buildFilterCss(adjustments, preset)} blur(${fx.blurPx}px)` : buildFilterCss(adjustments, preset);
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outWidth, outHeight);
    ctx.filter = 'none';
    ctx.restore();

    if (effect === 'faultFreeze') {
      const held = getHeld(ctx.canvas, outWidth, outHeight);
      const hctx = held.getContext('2d');
      if (hctx) {
        hctx.clearRect(0, 0, outWidth, outHeight);
        hctx.drawImage(ctx.canvas, 0, 0);
      }
    }
  }

  if (adjustments.sharpen > 0) {
    applySharpen(ctx, outWidth, outHeight, adjustments.sharpen / 100);
  }

  switch (effect) {
    case 'colorDistortion':
      applyColorDistortion(ctx, outWidth, outHeight, effectTime);
      break;
    case 'squareBlur':
      applyPixelation(ctx, outWidth, outHeight, effectTime);
      break;
    case 'twistedFocus':
      applySwirl(ctx, outWidth, outHeight, effectTime);
      break;
    case 'garbledGrid':
      applyGarbledGrid(ctx, outWidth, outHeight, effectTime);
      break;
    case 'datamosh':
      applyDatamosh(ctx, outWidth, outHeight, effectTime);
      break;
    case 'liquidFlip':
      applyLiquidRipple(ctx, outWidth, outHeight, effectTime);
      break;
    case 'curvyBlur':
      applyMotionTrail(ctx, outWidth, outHeight, effectTime, true);
      break;
    case 'slideBlur':
      applyMotionTrail(ctx, outWidth, outHeight, effectTime, false);
      break;
    case 'oldFootage':
      applyFilmLook(ctx, outWidth, outHeight, effectTime, { scratches: true, flicker: true, desaturate: true, grainDensity: 'normal' });
      break;
    case 'superGrain':
      applyFilmLook(ctx, outWidth, outHeight, effectTime, { scratches: false, flicker: false, desaturate: false, grainDensity: 'large' });
      break;
    case 'smartSharpen':
      applySharpen(ctx, outWidth, outHeight, 0.6);
      break;
    case 'faultFreeze':
      if (usedFrozenHeld) applyFaultLines(ctx, outWidth, outHeight, effectTime);
      break;
    default:
      break;
  }

  if (vignette > 0) {
    drawVignette(ctx, outWidth, outHeight, vignette / 100);
  }

  for (const overlay of overlays) {
    drawOverlay(ctx, overlay, crop, outWidth, outHeight);
  }

  if (effect === 'thunderbolt') {
    applyBolt(ctx, outWidth, outHeight, effectTime);
  }

  if (fx.tintAlpha > 0) {
    ctx.save();
    ctx.fillStyle = fx.tintColor;
    ctx.globalAlpha = fx.tintAlpha;
    ctx.fillRect(0, 0, outWidth, outHeight);
    ctx.restore();
  }

  if (fx.sweepAlpha > 0) {
    ctx.save();
    const bandX = fx.sweepPositionFrac * outWidth * 2 - outWidth * 0.5;
    const gradient = ctx.createLinearGradient(bandX - outWidth * 0.25, 0, bandX + outWidth * 0.25, 0);
    gradient.addColorStop(0, 'rgba(255,255,255,0)');
    gradient.addColorStop(0.5, `rgba(255,255,255,${fx.sweepAlpha})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, outWidth, outHeight);
    ctx.restore();
  }

  if (fx.flashAlpha > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${fx.flashAlpha})`;
    ctx.fillRect(0, 0, outWidth, outHeight);
    ctx.restore();
  }
}

// Ephemeral per-frame scratch copies, and persistent "held" frames for
// stateful effects (datamosh, fault freeze) - both keyed by destination
// canvas so the live preview canvas and an export canvas never share state.
const scratchMap = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
const heldMap = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

function getScratch(forCanvas: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  let c = scratchMap.get(forCanvas);
  if (!c) {
    c = document.createElement('canvas');
    scratchMap.set(forCanvas, c);
  }
  if (c.width !== width || c.height !== height) {
    c.width = width;
    c.height = height;
  }
  return c;
}

function getHeld(forCanvas: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  let c = heldMap.get(forCanvas);
  if (!c) {
    c = document.createElement('canvas');
    heldMap.set(forCanvas, c);
  }
  if (c.width !== width || c.height !== height) {
    c.width = width;
    c.height = height;
  }
  return c;
}

function copyCurrentTo(target: HTMLCanvasElement, source: HTMLCanvasElement, width: number, height: number) {
  const tctx = target.getContext('2d');
  if (!tctx) return;
  tctx.clearRect(0, 0, width, height);
  tctx.drawImage(source, 0, 0);
}

function shouldFreeze(t: number): boolean {
  const period = 2.2;
  const phase = cyclePhase(t, period);
  return phase > 0.5 && phase < 0.85;
}

function applyFaultLines(ctx: CanvasRenderingContext2D, width: number, height: number, t: number) {
  const bands = 3;
  ctx.save();
  for (let i = 0; i < bands; i++) {
    const step = Math.floor(t * 10);
    const y = hash(step + i * 17) * height;
    const bandH = 4 + hash(i + 7) * 10;
    const offset = (hash(step + i * 3) - 0.5) * 30;
    ctx.drawImage(ctx.canvas, 0, y, width, bandH, offset, y, width, bandH);
  }
  ctx.restore();
}

/** Glitchy RGB channel-split, implemented with SVG feColorMatrix filters
 * (see the hidden <svg> in index.html) so red/blue channels can be isolated
 * and screened back on top with a per-cycle jittered offset. */
function applyColorDistortion(ctx: CanvasRenderingContext2D, width: number, height: number, t: number) {
  const scratch = getScratch(ctx.canvas, width, height);
  copyCurrentTo(scratch, ctx.canvas, width, height);

  const offsets = computeColorDistortionOffsets(t, 0.02);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = 'url(#effect-channel-red)';
  ctx.drawImage(scratch, offsets.redX * width, offsets.redY * height);
  ctx.filter = 'url(#effect-channel-blue)';
  ctx.drawImage(scratch, offsets.blueX * width, offsets.blueY * height);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

/** Pulsing mosaic/pixelation: downscale then upscale with smoothing off. */
function applyPixelation(ctx: CanvasRenderingContext2D, width: number, height: number, t: number) {
  const period = 3;
  const phase = cyclePhase(t, period);
  const blockSize = 6 + 10 * (0.5 + 0.5 * Math.sin(phase * Math.PI * 2));
  const smallW = Math.max(1, Math.round(width / blockSize));
  const smallH = Math.max(1, Math.round(height / blockSize));
  const small = document.createElement('canvas');
  small.width = smallW;
  small.height = smallH;
  const smctx = small.getContext('2d');
  if (!smctx) return;
  smctx.drawImage(ctx.canvas, 0, 0, width, height, 0, 0, smallW, smallH);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(small, 0, 0, smallW, smallH, 0, 0, width, height);
  ctx.restore();
}

/** Radial swirl distortion, oscillating strength/direction over time. */
function applySwirl(ctx: CanvasRenderingContext2D, width: number, height: number, t: number) {
  const period = 2.4;
  const phase = cyclePhase(t, period);
  const strength = 2.2 * Math.sin(phase * Math.PI * 2);
  const src = ctx.getImageData(0, 0, width, height);
  const dst = ctx.createImageData(width, height);
  const s = src.data;
  const d = dst.data;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) + strength * (1 - r / maxR);
      const srcX = cx + r * Math.cos(angle);
      const srcY = cy + r * Math.sin(angle);
      const i = (y * width + x) * 4;
      if (srcX >= 0 && srcX < width - 1 && srcY >= 0 && srcY < height - 1) {
        const si = ((srcY | 0) * width + (srcX | 0)) * 4;
        d[i] = s[si];
        d[i + 1] = s[si + 1];
        d[i + 2] = s[si + 2];
        d[i + 3] = s[si + 3];
      } else {
        d[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(dst, 0, 0);
}

/** Chops the frame into a grid and randomly offsets a fraction of the tiles
 * each glitch window, for a broken-signal look. */
function applyGarbledGrid(ctx: CanvasRenderingContext2D, width: number, height: number, t: number) {
  const cols = 10;
  const rows = 6;
  const cellW = width / cols;
  const cellH = height / rows;
  const scratch = getScratch(ctx.canvas, width, height);
  copyCurrentTo(scratch, ctx.canvas, width, height);

  const step = Math.floor(t / 0.15);
  ctx.save();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (hash(step * 97 + idx) <= 0.82) continue;
      const offX = (hash(step * 31 + idx) - 0.5) * cellW * 1.4;
      const offY = (hash(step * 53 + idx) - 0.5) * cellH * 0.6;
      const dx = c * cellW;
      const dy = r * cellH;
      ctx.drawImage(scratch, dx + offX, dy + offY, cellW, cellH, dx, dy, cellW, cellH);
    }
  }
  ctx.restore();
}

/** Simulated datamosh: periodically captures a reference frame, then smears
 * blocks of it back over the live frame for a "stuck compression" look. */
function applyDatamosh(ctx: CanvasRenderingContext2D, width: number, height: number, t: number) {
  const period = 1.4;
  const phase = cyclePhase(t, period);
  const held = getHeld(ctx.canvas, width, height);

  if (phase < 0.08) {
    copyCurrentTo(held, ctx.canvas, width, height);
    return;
  }

  const cols = 14;
  const rows = 8;
  const cellW = width / cols;
  const cellH = height / rows;
  const step = Math.floor(t / period);
  ctx.save();
  ctx.globalAlpha = 0.85;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (hash(step * 211 + idx) <= 0.55) continue;
      const jitterX = (hash(step * 13 + idx) - 0.5) * cellW * 0.5;
      const dx = c * cellW;
      const dy = r * cellH;
      ctx.drawImage(held, dx, dy, cellW, cellH, dx + jitterX, dy, cellW, cellH);
    }
  }
  ctx.restore();
}

/** Horizontal-band ripple, like light refracting through liquid. */
function applyLiquidRipple(ctx: CanvasRenderingContext2D, width: number, height: number, t: number) {
  const scratch = getScratch(ctx.canvas, width, height);
  copyCurrentTo(scratch, ctx.canvas, width, height);

  const bandH = Math.max(2, Math.round(height / 180));
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  for (let y = 0; y < height; y += bandH) {
    const wave = Math.sin((y / height) * Math.PI * 6 + t * 3) * 0.03 * width;
    ctx.drawImage(scratch, 0, y, width, bandH, wave, y, width, bandH);
  }
  ctx.restore();
}

/** Cheap motion-blur trail: several fading offset copies along a straight
 * line (slideBlur) or a wobbling curve (curvyBlur). */
function applyMotionTrail(ctx: CanvasRenderingContext2D, width: number, height: number, t: number, curved: boolean) {
  const scratch = getScratch(ctx.canvas, width, height);
  copyCurrentTo(scratch, ctx.canvas, width, height);

  const steps = 7;
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let i = steps; i >= 1; i--) {
    const frac = i / steps;
    const dist = frac * 0.035 * width;
    const angle = curved ? Math.sin(t * 2 + frac * Math.PI) * 0.6 : 0;
    const dx = Math.cos(angle) * dist;
    const dy = curved ? Math.sin(angle) * dist * 0.4 : 0;
    ctx.drawImage(scratch, dx, dy);
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(scratch, 0, 0);
  ctx.restore();
}

interface FilmLookOptions {
  scratches: boolean;
  flicker: boolean;
  desaturate: boolean;
  grainDensity: 'normal' | 'large';
}

/** Vintage film look: optional desaturation pass, brightness flicker, film
 * grain speckling, and occasional vertical scratches. */
function applyFilmLook(ctx: CanvasRenderingContext2D, width: number, height: number, t: number, opts: FilmLookOptions) {
  if (opts.desaturate) {
    const scratch = getScratch(ctx.canvas, width, height);
    copyCurrentTo(scratch, ctx.canvas, width, height);
    ctx.save();
    ctx.filter = 'grayscale(0.85) sepia(0.25) contrast(1.05)';
    ctx.drawImage(scratch, 0, 0);
    ctx.filter = 'none';
    ctx.restore();
  }

  if (opts.flicker) {
    const step = Math.floor(t / 0.08);
    const amt = hash(step) * 0.18;
    ctx.save();
    ctx.fillStyle = `rgba(0,0,0,${amt})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  const grainCount = opts.grainDensity === 'large' ? 60 : 220;
  const grainMin = opts.grainDensity === 'large' ? 2 : 0.5;
  const grainMax = opts.grainDensity === 'large' ? 5 : 1.5;
  ctx.save();
  for (let i = 0; i < grainCount; i++) {
    const gx = hash(t * 1000 + i) * width;
    const gy = hash(t * 1000 + i + 0.5) * height;
    const size = grainMin + hash(i + t * 37) * (grainMax - grainMin);
    const bright = hash(i + t * 71) > 0.5;
    ctx.fillStyle = bright ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)';
    ctx.fillRect(gx, gy, size, size);
  }
  ctx.restore();

  if (opts.scratches) {
    const step = Math.floor(t / 0.5);
    if (hash(step + 7) > 0.6) {
      const scratchX = hash(step) * width;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(scratchX, hash(step + 1) * height * 0.3);
      ctx.lineTo(scratchX + (hash(step + 2) - 0.5) * 10, height * (0.3 + hash(step + 3) * 0.7));
      ctx.stroke();
      ctx.restore();
    }
  }
}

/** A jagged lightning-bolt polyline, drawn briefly in sync with the
 * thunderbolt effect's flash burst. */
function applyBolt(ctx: CanvasRenderingContext2D, width: number, height: number, t: number) {
  const period = 1.8;
  const phase = cyclePhase(t, period);
  if (phase > 0.1) return;
  const step = Math.floor(t / period);
  if (hash(step + 3) < 0.4) return;

  const startX = width * (0.2 + hash(step) * 0.6);
  ctx.save();
  ctx.strokeStyle = 'rgba(220,230,255,0.9)';
  ctx.lineWidth = Math.max(2, width * 0.004);
  ctx.shadowColor = 'rgba(150,180,255,0.8)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  let x = startX;
  ctx.moveTo(x, 0);
  const segments = 8;
  for (let i = 1; i <= segments; i++) {
    const y = (height / segments) * i;
    x += (hash(step * 17 + i) - 0.5) * width * 0.12;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function applySharpen(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) {
  const k = amount * 1.5;
  const kernel = [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0];
  const src = ctx.getImageData(0, 0, width, height);
  const dst = ctx.createImageData(width, height);
  const s = src.data;
  const d = dst.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        d[i] = s[i];
        d[i + 1] = s[i + 1];
        d[i + 2] = s[i + 2];
        d[i + 3] = s[i + 3];
        continue;
      }
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let k_i = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const ni = ((y + ky) * width + (x + kx)) * 4 + c;
            sum += s[ni] * kernel[k_i];
            k_i++;
          }
        }
        d[i + c] = Math.max(0, Math.min(255, sum));
      }
      d[i + 3] = s[i + 3];
    }
  }
  ctx.putImageData(dst, 0, 0);
}

function drawVignette(ctx: CanvasRenderingContext2D, width: number, height: number, amount: number) {
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.sqrt(cx * cx + cy * cy);
  const gradient = ctx.createRadialGradient(cx, cy, outerRadius * (1 - amount * 0.7) * 0.3, cx, cy, outerRadius);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, amount)})`);
  ctx.save();
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function toCanvasSpace(
  normX: number,
  normY: number,
  crop: CropRect,
  outWidth: number,
  outHeight: number,
) {
  const relX = (normX - crop.x) / crop.width;
  const relY = (normY - crop.y) / crop.height;
  return { x: relX * outWidth, y: relY * outHeight };
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: Overlay,
  crop: CropRect,
  outWidth: number,
  outHeight: number,
) {
  const { x, y } = toCanvasSpace(overlay.x, overlay.y, crop, outWidth, outHeight);
  const referenceScale = outHeight / 1080;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((overlay.rotation * Math.PI) / 180);

  if (overlay.kind === 'text') {
    const fontSize = overlay.fontSize * referenceScale;
    ctx.font = `${overlay.bold ? 'bold ' : ''}${fontSize}px ${overlay.fontFamily}`;
    ctx.fillStyle = overlay.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(overlay.text, 0, 0);
  } else {
    const w = (overlay.width / crop.width) * outWidth;
    const h = (overlay.height / crop.height) * outHeight;
    ctx.lineWidth = overlay.strokeWidth * referenceScale;
    ctx.strokeStyle = overlay.color;
    ctx.fillStyle = overlay.color;
    if (overlay.kind === 'rectangle') {
      if (overlay.filled) ctx.fillRect(-w / 2, -h / 2, w, h);
      else ctx.strokeRect(-w / 2, -h / 2, w, h);
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      if (overlay.filled) ctx.fill();
      else ctx.stroke();
    }
  }
  ctx.restore();
}
