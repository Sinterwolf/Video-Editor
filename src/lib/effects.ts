import type { EffectType } from '../types';

export interface EffectTransform {
  scale: number;
  translateXFrac: number; // fraction of frame width
  translateYFrac: number; // fraction of frame height
  blurPx: number;
  flashAlpha: number; // 0..1, full-frame white flash
}

const IDENTITY: EffectTransform = { scale: 1, translateXFrac: 0, translateYFrac: 0, blurPx: 0, flashAlpha: 0 };

function cyclePhase(t: number, period: number): number {
  return (((t % period) + period) % period) / period;
}

/** Computes the whole-frame transform for a given effect at time `t` (seconds,
 * relative to the trim start). Shared by the live preview (applied via CSS)
 * and export (applied via canvas transforms) so both stay in sync. */
export function computeEffectTransform(effect: EffectType, t: number): EffectTransform {
  if (effect === 'none' || effect === 'colorDistortion') return IDENTITY;

  if (effect === 'throb') {
    const period = 0.6;
    return { ...IDENTITY, scale: 1 + 0.07 * Math.sin((2 * Math.PI * t) / period) };
  }

  if (effect === 'whiplash') {
    const period = 1.1;
    const phase = cyclePhase(t, period);
    const burst = phase < 0.18 ? Math.sin((phase / 0.18) * Math.PI) : 0;
    return { ...IDENTITY, scale: 1 + 0.2 * burst, blurPx: 10 * burst };
  }

  if (effect === 'blink') {
    const period = 1.4;
    const phase = cyclePhase(t, period);
    const burst = phase < 0.09 ? Math.sin((phase / 0.09) * Math.PI) : 0;
    return { ...IDENTITY, flashAlpha: burst };
  }

  if (effect === 'slideLeft' || effect === 'slideRight') {
    const period = 1.6;
    const inFrac = 0.3;
    const phase = cyclePhase(t, period);
    const progress = phase < inFrac ? phase / inFrac : 1;
    const eased = 1 - Math.pow(1 - progress, 3);
    const dir = effect === 'slideLeft' ? -1 : 1;
    return { ...IDENTITY, translateXFrac: dir * (1 - eased) };
  }

  return IDENTITY;
}

function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export interface ColorDistortionOffsets {
  redX: number;
  redY: number;
  blueX: number;
  blueY: number;
}

/** Glitchy, intermittently-bursting RGB channel offsets (in fractions of
 * frame width/height) for the color-distortion effect. */
export function computeColorDistortionOffsets(t: number, maxOffsetFrac: number): ColorDistortionOffsets {
  const period = 0.35;
  const phase = cyclePhase(t, period);
  const burst = phase < 0.4 ? 1 : 0.15;
  const cycleIndex = Math.floor(t / period);
  return {
    redX: (hash(cycleIndex) - 0.5) * 2 * maxOffsetFrac * burst,
    redY: (hash(cycleIndex + 100) - 0.5) * 2 * maxOffsetFrac * burst * 0.4,
    blueX: (hash(cycleIndex + 200) - 0.5) * 2 * maxOffsetFrac * burst,
    blueY: (hash(cycleIndex + 300) - 0.5) * 2 * maxOffsetFrac * burst * 0.4,
  };
}

/** Cheap CSS-only approximation of the color-distortion effect for the live
 * DOM video preview (true per-channel RGB split is applied on export via the
 * canvas pipeline instead, see render.ts). */
export function colorDistortionPreviewFilter(t: number): string {
  const phase = cyclePhase(t, 0.35);
  const hue = Math.sin(phase * Math.PI * 2) * 45;
  return `hue-rotate(${hue}deg) saturate(1.6)`;
}
