import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useMediaElementRef } from '../lib/mediaElementContext';
import { clamp01 } from '../lib/pointerDrag';
import { formatTime } from '../lib/time';
import { generateVideoThumbnails } from '../lib/thumbnails';

const THUMB_COUNT = 12;

export function Timeline() {
  const media = useEditorStore((s) => s.media);
  const trim = useEditorStore((s) => s.trim);
  const setTrim = useEditorStore((s) => s.setTrim);
  const videoRef = useMediaElementRef();
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const trackRef = useRef<HTMLDivElement>(null);

  const duration = media?.duration ?? 0;
  const effectiveTrim = trim ?? { start: 0, end: duration };
  const pct = (v: number) => (duration > 0 ? (v / duration) * 100 : 0);

  useEffect(() => {
    if (!media || media.kind !== 'video' || !media.duration) return;
    let cancelled = false;
    setThumbs([]);
    generateVideoThumbnails(media.url, media.duration, THUMB_COUNT)
      .then((result) => {
        if (!cancelled) setThumbs(result);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [media]);

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

  if (!media || media.kind !== 'video') return null;

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
    <div className="timeline-dock">
      <div className="timeline-controls">
        <button className="btn" onClick={togglePlay}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="time-label">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>
      <div className="timeline-track timeline-track--filmstrip" ref={trackRef} onClick={onTrackClick}>
        <div className="timeline-filmstrip">
          {thumbs.map((src, i) => (
            <img key={i} src={src} alt="" draggable={false} />
          ))}
        </div>
        <div className="timeline-dim timeline-dim--left" style={{ width: `${pct(effectiveTrim.start)}%` }} />
        <div
          className="timeline-dim timeline-dim--right"
          style={{ width: `${100 - pct(effectiveTrim.end)}%` }}
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
    </div>
  );
}
