import { useActiveClip, useEditorStore } from '../store/editorStore';
import type { Adjustments } from '../types';

const SLIDERS: { key: keyof Adjustments; label: string; min: number; max: number }[] = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
  { key: 'exposure', label: 'Exposure', min: -100, max: 100 },
  { key: 'hue', label: 'Hue', min: -180, max: 180 },
  { key: 'blur', label: 'Blur', min: 0, max: 20 },
  { key: 'sharpen', label: 'Sharpen', min: 0, max: 100 },
];

export function AdjustPanel() {
  const clip = useActiveClip();
  const adjustments = clip?.adjustments ?? null;
  const setAdjustment = useEditorStore((s) => s.setAdjustment);
  const vignette = clip?.vignette ?? 0;
  const setVignette = useEditorStore((s) => s.setVignette);
  const mediaKind = clip?.media.kind;

  if (!adjustments) return null;

  return (
    <div className="panel">
      <h3>Adjustments</h3>
      {SLIDERS.map((s) => (
        <div className="slider-row" key={s.key}>
          <label htmlFor={s.key}>{s.label}</label>
          <input
            id={s.key}
            type="range"
            min={s.min}
            max={s.max}
            value={adjustments[s.key]}
            onChange={(e) => setAdjustment(s.key, Number(e.target.value))}
          />
          <span className="slider-value">{adjustments[s.key]}</span>
        </div>
      ))}
      {mediaKind === 'video' && (
        <p className="hint">Sharpen preview is approximate on video; the full effect is applied on export.</p>
      )}

      <h3>Vignette</h3>
      <div className="slider-row">
        <label htmlFor="vignette">Amount</label>
        <input
          id="vignette"
          type="range"
          min={0}
          max={100}
          value={vignette}
          onChange={(e) => setVignette(Number(e.target.value))}
        />
        <span className="slider-value">{vignette}</span>
      </div>
    </div>
  );
}
