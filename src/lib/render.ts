import type { Adjustments, CropRect, EffectType, Overlay, PresetFilter } from '../types';
import { buildFilterCss } from './filterCss';
import { computeColorDistortionOffsets, computeEffectTransform } from './effects';

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
 * crop, filters, vignette, sharpen and overlays. Used by live image preview,
 * image export, and per-frame video export so all three stay pixel-identical. */
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

  if (adjustments.sharpen > 0) {
    applySharpen(ctx, outWidth, outHeight, adjustments.sharpen / 100);
  }

  if (effect === 'colorDistortion') {
    applyColorDistortion(ctx, outWidth, outHeight, effectTime);
  }

  if (vignette > 0) {
    drawVignette(ctx, outWidth, outHeight, vignette / 100);
  }

  for (const overlay of overlays) {
    drawOverlay(ctx, overlay, crop, outWidth, outHeight);
  }

  if (fx.flashAlpha > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255,255,255,${fx.flashAlpha})`;
    ctx.fillRect(0, 0, outWidth, outHeight);
    ctx.restore();
  }
}

let scratchCanvas: HTMLCanvasElement | null = null;
function getScratchCanvas(width: number, height: number): HTMLCanvasElement {
  if (!scratchCanvas) scratchCanvas = document.createElement('canvas');
  if (scratchCanvas.width !== width || scratchCanvas.height !== height) {
    scratchCanvas.width = width;
    scratchCanvas.height = height;
  }
  return scratchCanvas;
}

/** Glitchy RGB channel-split, implemented with SVG feColorMatrix filters
 * (see the hidden <svg> in index.html) so red/blue channels can be isolated
 * and screened back on top with a per-cycle jittered offset. */
function applyColorDistortion(ctx: CanvasRenderingContext2D, width: number, height: number, t: number) {
  const scratch = getScratchCanvas(width, height);
  const sctx = scratch.getContext('2d');
  if (!sctx) return;
  sctx.clearRect(0, 0, width, height);
  sctx.drawImage(ctx.canvas, 0, 0);

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
