import { useEffect } from 'react';
import { useActiveClip, useEditorStore } from '../store/editorStore';
import { useMediaElementRef } from '../lib/mediaElementContext';
import { formatTime } from '../lib/time';

export function SpeedPanel() {
  const clip = useActiveClip();
  const media = clip?.media ?? null;
  const speed = clip?.speed ?? 1;
  const setSpeed = useEditorStore((s) => s.setSpeed);
  const trim = clip?.trim ?? null;
  const setTrim = useEditorStore((s) => s.setTrim);
  const imageDuration = clip?.imageDuration ?? 3;
  const setImageDuration = useEditorStore((s) => s.setImageDuration);
  const videoRef = useMediaElementRef();

  useEffect(() => {
    const video = videoRef.current;
    if (video) video.playbackRate = speed;
  }, [speed, videoRef]);

  if (!media) return null;

  if (media.kind === 'image') {
    return (
      <div className="panel">
        <h3>Duration</h3>
        <div className="slider-row">
          <label htmlFor="imageDuration">Seconds shown</label>
          <input
            id="imageDuration"
            type="range"
            min={0.5}
            max={15}
            step={0.5}
            value={imageDuration}
            onChange={(e) => setImageDuration(Number(e.target.value))}
          />
          <span className="slider-value">{imageDuration.toFixed(1)}s</span>
        </div>
        <p className="hint">How long this image stays on screen in the sequence.</p>
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
