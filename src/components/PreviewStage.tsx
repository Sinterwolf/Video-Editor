import { useEffect, useRef, useState } from 'react';
import { useActiveClip } from '../store/editorStore';
import { renderFrame } from '../lib/render';
import { buildFilterCss } from '../lib/filterCss';
import { CropOverlay } from './CropOverlay';
import { OverlayLayer } from './OverlayLayer';
import { useMediaElementRef } from '../lib/mediaElementContext';
import type { Adjustments, CropRect, EffectType, MediaAsset, PresetFilter, ToolTab } from '../types';

const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };
const MAX_PREVIEW_DIM = 1600;

interface Props {
  activeTool: ToolTab;
}

export function PreviewStage({ activeTool }: Props) {
  const clip = useActiveClip();

  if (!clip) return null;

  const { media, adjustments, preset, vignette, crop, effect, trim } = clip;
  const showFullFrame = activeTool === 'crop';
  const effectiveCrop = crop ?? FULL_CROP;
  const viewCrop = showFullFrame ? FULL_CROP : effectiveCrop;

  return (
    <div className="preview-stage">
      <div
        className="preview-stage__box"
        data-stage-root
        style={{
          aspectRatio: `${media.naturalWidth * viewCrop.width} / ${media.naturalHeight * viewCrop.height}`,
        }}
      >
        {media.kind === 'image' ? (
          <ImageCanvas
            key={clip.id}
            media={media}
            adjustments={adjustments}
            preset={preset}
            vignette={vignette}
            crop={showFullFrame ? null : crop}
          />
        ) : (
          <VideoStage
            key={clip.id}
            media={media}
            adjustments={adjustments}
            preset={preset}
            vignette={vignette}
            crop={showFullFrame ? null : crop}
            effect={effect}
            trimStart={trim?.start ?? 0}
          />
        )}
        {activeTool === 'crop' && <CropOverlay />}
        <OverlayLayer interactive={activeTool === 'overlays'} viewCrop={viewCrop} />
      </div>
    </div>
  );
}

interface MediaLayerProps {
  media: MediaAsset;
  adjustments: Adjustments;
  preset: PresetFilter;
  vignette: number;
  crop: CropRect | null;
}

function ImageCanvas({ media, adjustments, preset, vignette, crop }: MediaLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgElRef = useRef<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
    const img = new Image();
    img.onload = () => {
      imgElRef.current = img;
      setLoaded(true);
    };
    img.src = media.url;
    return () => {
      imgElRef.current = null;
    };
  }, [media.url]);

  useEffect(() => {
    if (!loaded || !canvasRef.current || !imgElRef.current) return;
    const effectiveCrop = crop ?? FULL_CROP;
    const cropWpx = media.naturalWidth * effectiveCrop.width;
    const cropHpx = media.naturalHeight * effectiveCrop.height;
    const scale = Math.min(1, MAX_PREVIEW_DIM / Math.max(cropWpx, cropHpx));
    const canvas = canvasRef.current;
    canvas.width = Math.max(1, Math.round(cropWpx * scale));
    canvas.height = Math.max(1, Math.round(cropHpx * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Overlays are rendered as interactive DOM elements (OverlayLayer) in the
    // live preview, so they're intentionally omitted here to avoid double-drawing.
    renderFrame(ctx, imgElRef.current, {
      naturalWidth: media.naturalWidth,
      naturalHeight: media.naturalHeight,
      crop,
      adjustments,
      preset,
      vignette,
      overlays: [],
    });
  }, [loaded, media, adjustments, preset, vignette, crop]);

  return <canvas ref={canvasRef} className="preview-canvas" />;
}

function VideoStage({
  media,
  adjustments,
  preset,
  vignette,
  crop,
  effect,
  trimStart,
}: MediaLayerProps & { effect: EffectType; trimStart: number }) {
  const videoRef = useMediaElementRef();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effectiveCrop = crop ?? FULL_CROP;
  const useCanvas = effect !== 'none';

  const scaleX = 1 / effectiveCrop.width;
  const scaleY = 1 / effectiveCrop.height;
  const leftPct = -(effectiveCrop.x / effectiveCrop.width) * 100;
  const topPct = -(effectiveCrop.y / effectiveCrop.height) * 100;

  // No effect selected: the native <video> stays visible with a cheap CSS
  // filter, for the smoothest possible playback.
  useEffect(() => {
    if (useCanvas) return;
    const video = videoRef.current;
    if (video) video.style.filter = buildFilterCss(adjustments, preset);
  }, [useCanvas, adjustments, preset, videoRef]);

  // An effect is selected: render every frame through the same canvas
  // pipeline used for export, so the preview and the export match exactly.
  useEffect(() => {
    if (!useCanvas) return;
    let rafId = 0;
    const loop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.videoWidth) {
        const cropWpx = media.naturalWidth * effectiveCrop.width;
        const cropHpx = media.naturalHeight * effectiveCrop.height;
        const scale = Math.min(1, MAX_PREVIEW_DIM / Math.max(cropWpx, cropHpx));
        const targetWidth = Math.max(1, Math.round(cropWpx * scale));
        const targetHeight = Math.max(1, Math.round(cropHpx * scale));
        if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
          canvas.width = targetWidth;
          canvas.height = targetHeight;
        }
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const t = Math.max(0, video.currentTime - trimStart);
          renderFrame(ctx, video, {
            naturalWidth: media.naturalWidth,
            naturalHeight: media.naturalHeight,
            crop,
            adjustments,
            preset,
            vignette: 0,
            overlays: [],
            effect,
            effectTime: t,
          });
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [useCanvas, effect, trimStart, adjustments, preset, crop, media, videoRef, effectiveCrop.width, effectiveCrop.height]);

  return (
    <div className="video-crop-clip">
      <video
        ref={videoRef}
        src={media.url}
        playsInline
        style={{
          width: `${scaleX * 100}%`,
          height: `${scaleY * 100}%`,
          left: `${leftPct}%`,
          top: `${topPct}%`,
          opacity: useCanvas ? 0 : 1,
        }}
      />
      {useCanvas && <canvas ref={canvasRef} className="video-effect-canvas" />}
      {vignette > 0 && (
        <div className="vignette-overlay" style={{ opacity: vignette / 100 }} />
      )}
    </div>
  );
}
