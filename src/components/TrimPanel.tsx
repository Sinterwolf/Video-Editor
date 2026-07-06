import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useMediaElementRef } from '../lib/mediaElementContext';
import { clamp01 } from '../lib/pointerDrag';

function formatTime(t: number) {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

export function TrimPanel() {
  const media = useEditorStore((s) => s.media);
  const trim = useEditorStore((s) => s.trim);
  const setTrim = useEditorStore((s) => s.setTrim);
  const speed = useEditorStore((s) => s.speed);
  const setSpeed = useEditorStore((s) => s.setSpeed);
  const videoRef = useMediaElementRef();
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const duration = media?.duration ?? 0;
  const effectiveTrim = trim ?? { start: 0, end: duration };
  const pct = (v: number) => (duration > 0 ? (v / duration) * 100 : 0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
  }, [speed, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.currentTime >= effectiveTrim.end) {
        video.pause();
        setIsPlaying(false);
      }
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [videoRef, effectiveTrim.end]);

  if (!media || media.kind !== 'video') {
    return (
      <div className="panel">
        <p className="hint">Trim & speed controls apply to video only.</p>
      </div>
    );
  }

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      if (video.currentTime < effectiveTrim.start || video.currentTime >= effectiveTrim.end) {
        video.currentTime = effectiveTrim.start;
      }
      video.play();
    } else {
      video.pause();
    }
  };

  const seek = (t: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(effectiveTrim.end, Math.max(effectiveTrim.start, t));
    setCurrentTime(video.currentTime);
  };

  const startHandleDrag = (which: 'start' | 'end') => (e: React.PointerEvent) => {
    e.stopPropagation();
    const initial = { ...effectiveTrim };
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();

    function onMove(ev: PointerEvent) {
      const frac = clamp01((ev.clientX - rect.left) / rect.width);
      const t = frac * duration;
      if (which === 'start') {
        setTrim({ start: Math.min(t, initial.end - 0.1), end: initial.end });
      } else {
        setTrim({ start: initial.start, end: Math.max(t, initial.start + 0.1) });
      }
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const onTrackClick = (e: React.MouseEvent) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const frac = clamp01((e.clientX - rect.left) / rect.width);
    seek(frac * duration);
  };

  return (
    <div className="panel">
      <h3>Playback</h3>
      <div className="trim-controls">
        <button className="btn" onClick={togglePlay}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="time-label">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <h3>Trim</h3>
      <div className="timeline-track" ref={trackRef} onClick={onTrackClick}>
        <div
          className="timeline-range"
          style={{ left: `${pct(effectiveTrim.start)}%`, width: `${pct(effectiveTrim.end - effectiveTrim.start)}%` }}
        />
        <div className="timeline-playhead" style={{ left: `${pct(currentTime)}%` }} />
        <div
          className="timeline-handle timeline-handle--start"
          style={{ left: `${pct(effectiveTrim.start)}%` }}
          onPointerDown={startHandleDrag('start')}
        />
        <div
          className="timeline-handle timeline-handle--end"
          style={{ left: `${pct(effectiveTrim.end)}%` }}
          onPointerDown={startHandleDrag('end')}
        />
      </div>
      <p className="hint">Trimmed length: {formatTime(effectiveTrim.end - effectiveTrim.start)}</p>

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
    </div>
  );
}
