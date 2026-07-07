import { useEditorStore } from '../store/editorStore';
import type { EffectType } from '../types';

const EFFECTS: { key: EffectType; label: string; description: string }[] = [
  { key: 'none', label: 'None', description: 'No effect' },
  { key: 'throb', label: 'Throb', description: 'Rhythmic pulsing zoom' },
  { key: 'whiplash', label: 'Whiplash', description: 'Quick snap zoom + blur' },
  { key: 'blink', label: 'Blink', description: 'Repeating flash' },
  { key: 'slideLeft', label: 'Come in: Left', description: 'Repeatedly slides in from the left' },
  { key: 'slideRight', label: 'Come in: Right', description: 'Repeatedly slides in from the right' },
  { key: 'colorDistortion', label: 'Color Distortion', description: 'Glitchy RGB split' },
];

export function EffectsPanel() {
  const media = useEditorStore((s) => s.media);
  const effect = useEditorStore((s) => s.effect);
  const setEffect = useEditorStore((s) => s.setEffect);

  if (!media || media.kind !== 'video') {
    return (
      <div className="panel">
        <p className="hint">Effects apply to video only.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h3>Effects</h3>
      <div className="chip-row">
        {EFFECTS.map((e) => (
          <button
            key={e.key}
            className={`chip ${effect === e.key ? 'chip--active' : ''}`}
            onClick={() => setEffect(e.key)}
            title={e.description}
          >
            {e.label}
          </button>
        ))}
      </div>
      {effect === 'colorDistortion' && (
        <p className="hint">
          Preview shows an approximate color wobble; the full RGB-split glitch is applied on export.
        </p>
      )}
    </div>
  );
}
