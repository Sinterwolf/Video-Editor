import type { Adjustments, PresetFilter } from '../types';

const presetCss: Record<PresetFilter, string> = {
  none: '',
  grayscale: 'grayscale(1)',
  sepia: 'sepia(0.9)',
  invert: 'invert(1)',
  vintage: 'sepia(0.35) contrast(1.1) brightness(1.05) saturate(1.3)',
};

/**
 * Builds a Canvas2D/CSS `filter` string from adjustment sliders and a preset.
 * Sharpen is intentionally excluded (Canvas2D has no convolution filter);
 * it is applied as a separate pixel-space pass in render.ts.
 */
export function buildFilterCss(adjustments: Adjustments, preset: PresetFilter): string {
  const parts: string[] = [];

  const brightnessFactor = (1 + adjustments.brightness / 100) * (1 + adjustments.exposure / 100);
  if (brightnessFactor !== 1) parts.push(`brightness(${Math.max(0, brightnessFactor)})`);

  const contrastFactor = 1 + adjustments.contrast / 100;
  if (contrastFactor !== 1) parts.push(`contrast(${Math.max(0, contrastFactor)})`);

  const saturateFactor = 1 + adjustments.saturation / 100;
  if (saturateFactor !== 1) parts.push(`saturate(${Math.max(0, saturateFactor)})`);

  if (adjustments.hue !== 0) parts.push(`hue-rotate(${adjustments.hue}deg)`);
  if (adjustments.blur > 0) parts.push(`blur(${adjustments.blur}px)`);

  const preseted = presetCss[preset];
  if (preseted) parts.push(preseted);

  return parts.length ? parts.join(' ') : 'none';
}
