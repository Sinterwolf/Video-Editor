import { renderFrame } from '../render';
import type { Adjustments, CropRect, MediaAsset, Overlay, PresetFilter } from '../../types';

export interface ImageExportParams {
  media: MediaAsset;
  adjustments: Adjustments;
  preset: PresetFilter;
  vignette: number;
  crop: CropRect | null;
  overlays: Overlay[];
  format?: 'image/png' | 'image/jpeg';
}

export async function exportImage(params: ImageExportParams): Promise<Blob> {
  const img = new Image();
  img.src = params.media.url;
  await img.decode();

  const effectiveCrop = params.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(params.media.naturalWidth * effectiveCrop.width));
  canvas.height = Math.max(1, Math.round(params.media.naturalHeight * effectiveCrop.height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser.');

  renderFrame(ctx, img, {
    naturalWidth: params.media.naturalWidth,
    naturalHeight: params.media.naturalHeight,
    crop: params.crop,
    adjustments: params.adjustments,
    preset: params.preset,
    vignette: params.vignette,
    overlays: params.overlays,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image export failed.'))),
      params.format ?? 'image/png',
    );
  });
}
