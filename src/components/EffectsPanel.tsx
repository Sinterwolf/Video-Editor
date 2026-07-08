import { useActiveClip, useEditorStore } from '../store/editorStore';
import type { EffectType } from '../types';

interface EffectDef {
  key: EffectType;
  label: string;
  description: string;
}

const GROUPS: { title: string; effects: EffectDef[] }[] = [
  {
    title: 'Motion',
    effects: [
      { key: 'throb', label: 'Throb', description: 'Rhythmic pulsing zoom' },
      { key: 'whiplash', label: 'Whiplash', description: 'Quick snap zoom + blur' },
      { key: 'dollyBack', label: 'Dolly Back', description: 'Repeated pull-back zoom' },
      { key: 'tremorStrobe', label: 'Tremor Strobe', description: 'Camera shake with a strobe flicker' },
      { key: 'shockShift', label: 'Shock Shift', description: 'Jolting shift with a red tint punch' },
      { key: 'slideLeft', label: 'Come in: Left', description: 'Repeatedly slides in from the left' },
      { key: 'slideRight', label: 'Come in: Right', description: 'Repeatedly slides in from the right' },
    ],
  },
  {
    title: 'Flash',
    effects: [
      { key: 'blink', label: 'Blink', description: 'Repeating full flash' },
      { key: 'flash2', label: 'Flash 2', description: 'A bright band sweeping across the frame' },
      { key: 'thunderbolt', label: 'Thunderbolt', description: 'Flash with a jagged lightning bolt' },
    ],
  },
  {
    title: 'Blur & Focus',
    effects: [
      { key: 'backToFocus', label: 'Back to Focus', description: 'Blurry to sharp, repeating' },
      { key: 'curvyBlur', label: 'Curvy Blur', description: 'Motion-blur trail along a curve' },
      { key: 'slideBlur', label: 'Slide Blur', description: 'Straight-line motion-blur trail' },
      { key: 'squareBlur', label: 'Square Blur', description: 'Pulsing mosaic pixelation' },
      { key: 'twistedFocus', label: 'Twisted Focus', description: 'Swirling radial warp' },
      { key: 'smartSharpen', label: 'Smart Sharpen', description: 'Strong edge sharpening' },
    ],
  },
  {
    title: 'Glitch',
    effects: [
      { key: 'colorDistortion', label: 'Color Distortion', description: 'Glitchy RGB channel split' },
      { key: 'garbledGrid', label: 'Garbled Grid', description: 'Randomly offset grid tiles' },
      { key: 'datamosh', label: 'Datamosh', description: 'Smeared, stuck compression blocks' },
      { key: 'faultFreeze', label: 'Fault Freeze', description: 'Freeze-frame with scan-line tears' },
      { key: 'liquidFlip', label: 'Liquid Flip', description: 'Wavy liquid-ripple distortion' },
    ],
  },
  {
    title: 'Film',
    effects: [
      { key: 'oldFootage', label: 'Old Footage', description: 'Vintage flicker, grain, and scratches' },
      { key: 'superGrain', label: 'Super Grain', description: 'Heavy film grain' },
    ],
  },
];

export function EffectsPanel() {
  const clip = useActiveClip();
  const media = clip?.media ?? null;
  const effect = clip?.effect ?? 'none';
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
        <button className={`chip ${effect === 'none' ? 'chip--active' : ''}`} onClick={() => setEffect('none')}>
          None
        </button>
      </div>
      {GROUPS.map((group) => (
        <div key={group.title}>
          <h3>{group.title}</h3>
          <div className="chip-row">
            {group.effects.map((e) => (
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
        </div>
      ))}
    </div>
  );
}
