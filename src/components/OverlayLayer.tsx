import { useActiveClip, useEditorStore } from '../store/editorStore';
import { clamp01, trackPointerDrag } from '../lib/pointerDrag';
import type { CropRect, Overlay } from '../types';

interface Props {
  interactive: boolean;
  viewCrop: CropRect;
}

export function OverlayLayer({ interactive, viewCrop }: Props) {
  const overlays = useActiveClip()?.overlays ?? [];
  const selectedId = useEditorStore((s) => s.selectedOverlayId);
  const updateOverlay = useEditorStore((s) => s.updateOverlay);
  const selectOverlay = useEditorStore((s) => s.selectOverlay);
  const removeOverlay = useEditorStore((s) => s.removeOverlay);

  return (
    <>
      {overlays.map((o) => {
        const relX = (o.x - viewCrop.x) / viewCrop.width;
        const relY = (o.y - viewCrop.y) / viewCrop.height;
        const isSelected = selectedId === o.id;

        const startDrag = (e: React.PointerEvent) => {
          if (!interactive) return;
          e.stopPropagation();
          selectOverlay(o.id);
          const initial = { x: o.x, y: o.y };
          trackPointerDrag(e, (dxNorm, dyNorm) => {
            updateOverlay(o.id, {
              x: clamp01(initial.x + dxNorm * viewCrop.width),
              y: clamp01(initial.y + dyNorm * viewCrop.height),
            });
          });
        };

        const startResize = (e: React.PointerEvent) => {
          if (!interactive) return;
          e.stopPropagation();
          if (o.kind === 'text') {
            const initialFontSize = o.fontSize;
            trackPointerDrag(e, (_dx, dyNorm) => {
              const next = initialFontSize + dyNorm * viewCrop.height * 1080 * 2;
              updateOverlay(o.id, { fontSize: Math.max(8, next) });
            });
          } else {
            const initial = { width: o.width, height: o.height };
            trackPointerDrag(e, (dxNorm, dyNorm) => {
              updateOverlay(o.id, {
                width: Math.max(0.02, initial.width + dxNorm * viewCrop.width * 2),
                height: Math.max(0.02, initial.height + dyNorm * viewCrop.height * 2),
              });
            });
          }
        };

        return (
          <div
            key={o.id}
            className={`overlay-item ${isSelected ? 'overlay-item--selected' : ''}`}
            style={{
              left: `${relX * 100}%`,
              top: `${relY * 100}%`,
              transform: `translate(-50%, -50%) rotate(${o.rotation}deg)`,
              pointerEvents: interactive ? 'auto' : 'none',
              cursor: interactive ? 'grab' : 'default',
            }}
            onPointerDown={startDrag}
          >
            {renderOverlayContent(o, viewCrop)}
            {isSelected && interactive && (
              <>
                <button
                  type="button"
                  className="overlay-delete"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => removeOverlay(o.id)}
                >
                  ×
                </button>
                <div className="overlay-resize-handle" onPointerDown={startResize} />
              </>
            )}
          </div>
        );
      })}
    </>
  );
}

function renderOverlayContent(o: Overlay, viewCrop: CropRect) {
  if (o.kind === 'text') {
    const heightPct = (o.fontSize / 1080 / viewCrop.height) * 100;
    return (
      <span
        style={{
          fontSize: `${heightPct}cqh`,
          color: o.color,
          fontFamily: o.fontFamily,
          fontWeight: o.bold ? 700 : 400,
        }}
      >
        {o.text}
      </span>
    );
  }
  const widthPct = (o.width / viewCrop.width) * 100;
  const heightPct = (o.height / viewCrop.height) * 100;
  const borderPct = (o.strokeWidth / 1080 / viewCrop.height) * 100;
  return (
    <div
      style={{
        width: `${widthPct}cqw`,
        height: `${heightPct}cqh`,
        borderRadius: o.kind === 'circle' ? '50%' : 0,
        border: o.filled ? 'none' : `${borderPct}cqh solid ${o.color}`,
        background: o.filled ? o.color : 'transparent',
      }}
    />
  );
}
