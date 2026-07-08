import { useActiveClip, useEditorStore } from '../store/editorStore';

const ASPECTS: { label: string; ratio: number | null }[] = [
  { label: 'Free', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '16:9', ratio: 16 / 9 },
  { label: '9:16', ratio: 9 / 16 },
  { label: '4:3', ratio: 4 / 3 },
];

export function CropPanel() {
  const clip = useActiveClip();
  const media = clip?.media ?? null;
  const crop = clip?.crop ?? null;
  const setCrop = useEditorStore((s) => s.setCrop);

  if (!media) return null;

  const applyAspect = (ratio: number | null) => {
    if (ratio === null) {
      setCrop(null);
      return;
    }
    const mediaRatio = media.naturalWidth / media.naturalHeight;
    let width: number;
    let height: number;
    if (ratio > mediaRatio) {
      width = 1;
      height = mediaRatio / ratio;
    } else {
      height = 1;
      width = ratio / mediaRatio;
    }
    setCrop({ x: (1 - width) / 2, y: (1 - height) / 2, width, height });
  };

  return (
    <div className="panel">
      <h3>Crop</h3>
      <p className="hint">Drag the corners on the preview to adjust the crop area.</p>
      <div className="chip-row">
        {ASPECTS.map((a) => (
          <button key={a.label} className="chip" onClick={() => applyAspect(a.ratio)}>
            {a.label}
          </button>
        ))}
      </div>
      <button className="btn" onClick={() => setCrop(null)} disabled={!crop}>
        Reset crop
      </button>
    </div>
  );
}
