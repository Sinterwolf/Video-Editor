import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { renderFrame } from '../lib/render';
import { buildFilterCss } from '../lib/filterCss';
import { CropOverlay } from './CropOverlay';
import { OverlayLayer } from './OverlayLayer';
import { useMediaElementRef } from '../lib/mediaElementContext';
import type { Adjustments, CropRect, MediaAsset, PresetFilter, ToolTab } from '../types';

const FULL_CROP: CropRect = { x: 0, y: 0, width: 1, height: 1 };
const MAX_PREVIEW_DIM = 1600;

interface Props {
  activeTool: ToolTab;
}

export function PreviewStage({ activeTool }: Props) {
  const media = useEditorStore((s) => s.media);
  const adjustments = useEditorStore((s) => s.adjustments);
  const preset = useEditorStore((s) => s.preset);
  const vignette = useEditorStore((s) => s.vignette);
  const crop = useEditorStore((s) => s.crop);

  if (!media) return null;

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
            media={media}
            adjustments={adjustments}
            preset={preset}
            vignette={vignette}
            crop={showFullFrame ? null : crop}
          />
        ) : (
          <VideoStage
            media={media}
            adjustments={adjustments}
            preset={preset}
            vignette={vignette}
            crop={showFullFrame ? null : crop}
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
  const overlays = useEditorStore((s) => s.overlays);

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
  }, [loaded, media, adjustments, preset, vignette, crop, overlays]);

  return <canvas ref={canvasRef} className="preview-canvas" />;
}

function VideoStage({ media, adjustments, preset, vignette, crop }: MediaLayerProps) {
  const videoRef = useMediaElementRef();
  const effectiveCrop = crop ?? FULL_CROP;
  const filterCss = buildFilterCss(adjustments, preset);

  const scaleX = 1 / effectiveCrop.width;
  const scaleY = 1 / effectiveCrop.height;
  const leftPct = -(effectiveCrop.x / effectiveCrop.width) * 100;
  const topPct = -(effectiveCrop.y / effectiveCrop.height) * 100;

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
          filter: filterCss,
        }}
      />
      {vignette > 0 && (
        <div className="vignette-overlay" style={{ opacity: vignette / 100 }} />
      )}
    </div>
  );
}
