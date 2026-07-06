import { useEditorStore } from '../store/editorStore';
import type { ShapeOverlay, TextOverlay } from '../types';

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function OverlaysPanel() {
  const overlays = useEditorStore((s) => s.overlays);
  const addOverlay = useEditorStore((s) => s.addOverlay);
  const updateOverlay = useEditorStore((s) => s.updateOverlay);
  const removeOverlay = useEditorStore((s) => s.removeOverlay);
  const selectedId = useEditorStore((s) => s.selectedOverlayId);
  const selectOverlay = useEditorStore((s) => s.selectOverlay);

  const selected = overlays.find((o) => o.id === selectedId) ?? null;

  const addText = () => {
    const overlay: TextOverlay = {
      id: newId(),
      kind: 'text',
      text: 'Your text',
      x: 0.5,
      y: 0.5,
      fontSize: 64,
      color: '#ffffff',
      fontFamily: 'Inter, sans-serif',
      bold: true,
      rotation: 0,
    };
    addOverlay(overlay);
  };

  const addShape = (kind: 'rectangle' | 'circle') => {
    const overlay: ShapeOverlay = {
      id: newId(),
      kind,
      x: 0.5,
      y: 0.5,
      width: 0.25,
      height: 0.25,
      color: '#ff3366',
      strokeWidth: 6,
      filled: false,
      rotation: 0,
    };
    addOverlay(overlay);
  };

  return (
    <div className="panel">
      <h3>Add</h3>
      <div className="chip-row">
        <button className="chip" onClick={addText}>+ Text</button>
        <button className="chip" onClick={() => addShape('rectangle')}>+ Rectangle</button>
        <button className="chip" onClick={() => addShape('circle')}>+ Circle</button>
      </div>

      <h3>Layers</h3>
      {overlays.length === 0 && <p className="hint">No overlays yet. Add one above, then drag it on the preview.</p>}
      <ul className="layer-list">
        {overlays.map((o) => (
          <li
            key={o.id}
            className={`layer-list__item ${o.id === selectedId ? 'layer-list__item--selected' : ''}`}
            onClick={() => selectOverlay(o.id)}
          >
            <span>{o.kind === 'text' ? `"${o.text.slice(0, 18)}"` : o.kind}</span>
            <button
              className="layer-list__remove"
              onClick={(e) => {
                e.stopPropagation();
                removeOverlay(o.id);
              }}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {selected && selected.kind === 'text' && (
        <div className="overlay-props">
          <h3>Text</h3>
          <label className="field">
            Content
            <input
              type="text"
              value={selected.text}
              onChange={(e) => updateOverlay(selected.id, { text: e.target.value })}
            />
          </label>
          <label className="field">
            Color
            <input
              type="color"
              value={selected.color}
              onChange={(e) => updateOverlay(selected.id, { color: e.target.value })}
            />
          </label>
          <label className="field field--checkbox">
            Bold
            <input
              type="checkbox"
              checked={selected.bold}
              onChange={(e) => updateOverlay(selected.id, { bold: e.target.checked })}
            />
          </label>
          <div className="slider-row">
            <label>Rotation</label>
            <input
              type="range"
              min={-180}
              max={180}
              value={selected.rotation}
              onChange={(e) => updateOverlay(selected.id, { rotation: Number(e.target.value) })}
            />
            <span className="slider-value">{selected.rotation}</span>
          </div>
        </div>
      )}

      {selected && selected.kind !== 'text' && (
        <div className="overlay-props">
          <h3>Shape</h3>
          <label className="field">
            Color
            <input
              type="color"
              value={selected.color}
              onChange={(e) => updateOverlay(selected.id, { color: e.target.value })}
            />
          </label>
          <label className="field field--checkbox">
            Filled
            <input
              type="checkbox"
              checked={selected.filled}
              onChange={(e) => updateOverlay(selected.id, { filled: e.target.checked })}
            />
          </label>
          <div className="slider-row">
            <label>Stroke width</label>
            <input
              type="range"
              min={1}
              max={40}
              value={selected.strokeWidth}
              onChange={(e) => updateOverlay(selected.id, { strokeWidth: Number(e.target.value) })}
            />
            <span className="slider-value">{selected.strokeWidth}</span>
          </div>
          <div className="slider-row">
            <label>Rotation</label>
            <input
              type="range"
              min={-180}
              max={180}
              value={selected.rotation}
              onChange={(e) => updateOverlay(selected.id, { rotation: Number(e.target.value) })}
            />
            <span className="slider-value">{selected.rotation}</span>
          </div>
        </div>
      )}
    </div>
  );
}
