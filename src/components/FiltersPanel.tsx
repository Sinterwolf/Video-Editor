import { useEditorStore } from '../store/editorStore';
import type { Adjustments, PresetFilter } from '../types';

const SLIDERS: { key: keyof Adjustments; label: string; min: number; max: number }[] = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
  { key: 'exposure', label: 'Exposure', min: -100, max: 100 },
  { key: 'hue', label: 'Hue', min: -180, max: 180 },
  { key: 'blur', label: 'Blur', min: 0, max: 20 },
  { key: 'sharpen', label: 'Sharpen', min: 0, max: 100 },
];

const PRESETS: { key: PresetFilter; label: string }[] = [
  { key: 'none', label: 'Original' },
  { key: 'grayscale', label: 'Grayscale' },
  { key: 'sepia', label: 'Sepia' },
  { key: 'invert', label: 'Invert' },
  { key: 'vintage', label: 'Vintage' },
];

export function FiltersPanel() {
  const adjustments = useEditorStore((s) => s.adjustments);
  const setAdjustment = useEditorStore((s) => s.setAdjustment);
  const preset = useEditorStore((s) => s.preset);
  const setPreset = useEditorStore((s) => s.setPreset);
  const vignette = useEditorStore((s) => s.vignette);
  const setVignette = useEditorStore((s) => s.setVignette);
  const mediaKind = useEditorStore((s) => s.media?.kind);

  return (
    <div className="panel">
      <h3>Presets</h3>
      <div className="chip-row">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            className={`chip ${preset === p.key ? 'chip--active' : ''}`}
            onClick={() => setPreset(p.key)}
          >
            {p.label}
          </button>
        ))}
      </div>

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
