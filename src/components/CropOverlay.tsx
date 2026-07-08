import { useActiveClip, useEditorStore } from '../store/editorStore';
import { clamp01, trackPointerDrag } from '../lib/pointerDrag';
import type { CropRect } from '../types';

const MIN_SIZE = 0.08;
const CORNERS = ['nw', 'ne', 'sw', 'se'] as const;
type Corner = (typeof CORNERS)[number];

export function CropOverlay() {
  const crop = useActiveClip()?.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const setCrop = useEditorStore((s) => s.setCrop);

  const startMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    const initial: CropRect = { ...crop };
    trackPointerDrag(e, (dxNorm, dyNorm) => {
      const x = clamp01(Math.min(1 - initial.width, Math.max(0, initial.x + dxNorm)));
      const y = clamp01(Math.min(1 - initial.height, Math.max(0, initial.y + dyNorm)));
      setCrop({ x, y, width: initial.width, height: initial.height });
    });
  };

  const startResize = (corner: Corner) => (e: React.PointerEvent) => {
    e.stopPropagation();
    const initial: CropRect = { ...crop };
    trackPointerDrag(e, (dxNorm, dyNorm) => {
      let { x, y, width, height } = initial;
      if (corner === 'nw') {
        width = initial.width - dxNorm;
        height = initial.height - dyNorm;
        x = initial.x + dxNorm;
        y = initial.y + dyNorm;
      } else if (corner === 'ne') {
        width = initial.width + dxNorm;
        height = initial.height - dyNorm;
        y = initial.y + dyNorm;
      } else if (corner === 'sw') {
        width = initial.width - dxNorm;
        height = initial.height + dyNorm;
        x = initial.x + dxNorm;
      } else {
        width = initial.width + dxNorm;
        height = initial.height + dyNorm;
      }
      width = Math.max(MIN_SIZE, width);
      height = Math.max(MIN_SIZE, height);
      x = clamp01(Math.min(1 - width, x));
      y = clamp01(Math.min(1 - height, y));
      width = Math.min(width, 1 - x);
      height = Math.min(height, 1 - y);
      setCrop({ x, y, width, height });
    });
  };

  return (
    <div
      className="crop-overlay"
      style={{
        left: `${crop.x * 100}%`,
        top: `${crop.y * 100}%`,
        width: `${crop.width * 100}%`,
        height: `${crop.height * 100}%`,
      }}
      onPointerDown={startMove}
    >
      {CORNERS.map((corner) => (
        <div key={corner} className={`crop-handle crop-handle--${corner}`} onPointerDown={startResize(corner)} />
      ))}
    </div>
  );
}
