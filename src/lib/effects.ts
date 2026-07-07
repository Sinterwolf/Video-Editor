import type { EffectType } from '../types';

export interface EffectTransform {
  scale: number;
  translateXFrac: number; // fraction of frame width
  translateYFrac: number; // fraction of frame height
  blurPx: number;
  flashAlpha: number; // 0..1, full-frame white flash
  tintAlpha: number; // 0..1, full-frame colored flash
  tintColor: string;
  sweepAlpha: number; // 0..1, intensity of a moving bright band (flash2)
  sweepPositionFrac: number; // 0..1, x position of the sweep band center
}

const IDENTITY: EffectTransform = {
  scale: 1,
  translateXFrac: 0,
  translateYFrac: 0,
  blurPx: 0,
  flashAlpha: 0,
  tintAlpha: 0,
  tintColor: '#ffffff',
  sweepAlpha: 0,
  sweepPositionFrac: 0.5,
};

/** Effects handled purely by this lightweight transform (no per-pixel canvas
 * work needed). Effects that need real pixel manipulation (pixelation,
 * swirl, grain, grid-glitch, freeze-frame, etc.) are applied as separate
 * canvas passes in render.ts and return the identity transform here. */
const PIXEL_PASS_EFFECTS = new Set<EffectType>([
  'colorDistortion',
  'liquidFlip',
  'curvyBlur',
  'slideBlur',
  'squareBlur',
  'twistedFocus',
  'garbledGrid',
  'datamosh',
  'faultFreeze',
  'oldFootage',
  'superGrain',
  'smartSharpen',
]);

function cyclePhase(t: number, period: number): number {
  return (((t % period) + period) % period) / period;
}

function hash(n: number): number {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Computes the whole-frame transform for a given effect at time `t` (seconds,
 * relative to the trim start). Shared by the live preview and export so both
 * stay in sync. */
export function computeEffectTransform(effect: EffectType, t: number): EffectTransform {
  if (effect === 'none' || PIXEL_PASS_EFFECTS.has(effect)) return IDENTITY;

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

  if (effect === 'dollyBack') {
    const period = 2.5;
    const phase = cyclePhase(t, period);
    const eased = 1 - Math.pow(1 - phase, 3);
    return { ...IDENTITY, scale: 1.18 - 0.18 * eased };
  }

  if (effect === 'tremorStrobe') {
    const jitterStep = Math.floor(t / 0.05);
    const jx = (hash(jitterStep) - 0.5) * 0.03;
    const jy = (hash(jitterStep + 50) - 0.5) * 0.03;
    const period = 0.3;
    const phase = cyclePhase(t, period);
    const burst = phase < 0.15 ? Math.sin((phase / 0.15) * Math.PI) : 0;
    return { ...IDENTITY, translateXFrac: jx, translateYFrac: jy, flashAlpha: burst * 0.5 };
  }

  if (effect === 'flash2') {
    const period = 1.2;
    const phase = cyclePhase(t, period);
    const active = phase < 0.4;
    return { ...IDENTITY, sweepAlpha: active ? Math.sin((phase / 0.4) * Math.PI) : 0, sweepPositionFrac: phase / 0.4 };
  }

  if (effect === 'backToFocus') {
    const period = 1.8;
    const phase = cyclePhase(t, period);
    const blur = phase < 0.5 ? (1 - phase / 0.5) * 14 : 0;
    return { ...IDENTITY, blurPx: blur };
  }

  if (effect === 'shockShift') {
    const period = 0.9;
    const phase = cyclePhase(t, period);
    const burst = phase < 0.12 ? Math.sin((phase / 0.12) * Math.PI) : 0;
    const step = Math.floor(t / period);
    const jx = (hash(step) - 0.5) * 0.06 * burst;
    const jy = (hash(step + 20) - 0.5) * 0.04 * burst;
    return {
      ...IDENTITY,
      translateXFrac: jx,
      translateYFrac: jy,
      scale: 1 + 0.04 * burst,
      tintAlpha: burst * 0.35,
      tintColor: '#ff2050',
    };
  }

  if (effect === 'thunderbolt') {
    const period = 1.8;
    const phase = cyclePhase(t, period);
    const burst = phase < 0.06 ? 1 : 0;
    return { ...IDENTITY, flashAlpha: burst * 0.85 };
  }

  return IDENTITY;
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

export { cyclePhase, hash };
