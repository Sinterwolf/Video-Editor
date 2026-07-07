import { useEffect, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { buildFilterCss } from '../lib/filterCss';
import { getMediaThumbnail } from '../lib/thumbnails';
import { DEFAULT_ADJUSTMENTS } from '../types';
import type { PresetFilter } from '../types';

const PRESETS: { key: PresetFilter; label: string }[] = [
  { key: 'none', label: 'Original' },
  { key: 'vivid', label: 'Vivid' },
  { key: 'grayscale', label: 'B&W' },
  { key: 'noir', label: 'Noir' },
  { key: 'warm', label: 'Warm' },
  { key: 'cool', label: 'Cool' },
  { key: 'fade', label: 'Fade' },
  { key: 'cinematic', label: 'Cinematic' },
  { key: 'dramatic', label: 'Dramatic' },
  { key: 'golden', label: 'Golden' },
  { key: 'sepia', label: 'Sepia' },
  { key: 'vintage', label: 'Vintage' },
  { key: 'invert', label: 'Invert' },
];

export function FiltersPanel() {
  const preset = useEditorStore((s) => s.preset);
  const setPreset = useEditorStore((s) => s.setPreset);
  const media = useEditorStore((s) => s.media);
  const [thumb, setThumb] = useState<string | null>(null);

  useEffect(() => {
    setThumb(null);
    if (!media) return;
    let cancelled = false;
    getMediaThumbnail(media, 140)
      .then((url) => {
        if (!cancelled) setThumb(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [media]);

  return (
    <div className="panel">
      <h3>Filters</h3>
      <div className="filter-gallery">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            className={`filter-swatch ${preset === p.key ? 'filter-swatch--active' : ''}`}
            onClick={() => setPreset(p.key)}
          >
            <span className="filter-swatch__thumb">
              {thumb && (
                <img src={thumb} alt="" style={{ filter: buildFilterCss(DEFAULT_ADJUSTMENTS, p.key) }} />
              )}
            </span>
            <span className="filter-swatch__label">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
