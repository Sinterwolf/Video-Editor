import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useMediaElementRef } from '../lib/mediaElementContext';
import { formatTime } from '../lib/time';

export function SpeedPanel() {
  const media = useEditorStore((s) => s.media);
  const speed = useEditorStore((s) => s.speed);
  const setSpeed = useEditorStore((s) => s.setSpeed);
  const trim = useEditorStore((s) => s.trim);
  const setTrim = useEditorStore((s) => s.setTrim);
  const videoRef = useMediaElementRef();

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = speed;
  }, [speed, videoRef]);

  if (!media || media.kind !== 'video') {
    return (
      <div className="panel">
        <p className="hint">Speed and trim apply to video only.</p>
      </div>
    );
  }

  const duration = media.duration;
  const effectiveTrim = trim ?? { start: 0, end: duration };

  return (
    <div className="panel">
      <h3>Speed</h3>
      <div className="slider-row">
        <label htmlFor="speed">Playback speed</label>
        <input
          id="speed"
          type="range"
          min={0.25}
          max={3}
          step={0.05}
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
        <span className="slider-value">{speed.toFixed(2)}x</span>
      </div>

      <h3>Trim</h3>
      <p className="hint">
        Drag the handles on the timeline below the preview to set the in/out points.
        <br />
        Trimmed length: {formatTime(effectiveTrim.end - effectiveTrim.start)}
      </p>
      <button className="btn" onClick={() => setTrim(null)} disabled={!trim}>
        Reset trim
      </button>
    </div>
  );
}
