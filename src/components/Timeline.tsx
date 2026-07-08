import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useMediaElementRef } from '../lib/mediaElementContext';
import { clamp01 } from '../lib/pointerDrag';
import { formatTime } from '../lib/time';
import { generateVideoThumbnails, getMediaThumbnail } from '../lib/thumbnails';
import { clipDuration, sequenceOffsetOf, totalSequenceDuration } from '../lib/clip';
import { MediaUploader } from './MediaUploader';
import type { Clip, TrimRange } from '../types';

const THUMB_COUNT = 6;

export function Timeline() {
  const clips = useEditorStore((s) => s.clips);
  const activeClipId = useEditorStore((s) => s.activeClipId);
  const selectClip = useEditorStore((s) => s.selectClip);
  const removeClip = useEditorStore((s) => s.removeClip);
  const moveClip = useEditorStore((s) => s.moveClip);
  const setTrim = useEditorStore((s) => s.setTrim);
  const videoRef = useMediaElementRef();

  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadSeq, setPlayheadSeq] = useState(0);
  const [thumbsByClip, setThumbsByClip] = useState<Record<string, string[]>>({});
  const pendingSeekRef = useRef<number | null>(null);
  const imageStartRef = useRef(0);

  if (clips.length === 0) return null;

  const totalDuration = totalSequenceDuration(clips);

  // Generate a filmstrip (or single thumbnail) once per clip.
  useEffect(() => {
    for (const clip of clips) {
      if (thumbsByClip[clip.id]) continue;
      if (clip.media.kind === 'video' && clip.media.duration > 0) {
        generateVideoThumbnails(clip.media.url, clip.media.duration, THUMB_COUNT)
          .then((thumbs) => setThumbsByClip((prev) => ({ ...prev, [clip.id]: thumbs })))
          .catch(() => {});
      } else if (clip.media.kind === 'image') {
        getMediaThumbnail(clip.media, 160)
          .then((thumb) => setThumbsByClip((prev) => ({ ...prev, [clip.id]: [thumb] })))
          .catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips]);

  // Drives advancing from one clip to the next as playback reaches the end
  // of the active clip (event-driven: video 'timeupdate'/end, or a timer
  // for images, which have no intrinsic playback clock).
  useEffect(() => {
    if (!isPlaying) return;
    const idx = clips.findIndex((c) => c.id === activeClipId);
    if (idx === -1) {
      setIsPlaying(false);
      return;
    }
    const clip = clips[idx];

    const advance = () => {
      const next = clips[idx + 1];
      if (next) selectClip(next.id);
      else setIsPlaying(false);
    };

    if (clip.media.kind === 'image') {
      imageStartRef.current = performance.now();
      const timer = window.setTimeout(advance, clip.imageDuration * 1000);
      return () => window.clearTimeout(timer);
    }

    const video = videoRef.current;
    if (!video) return;
    const trim = clip.trim ?? { start: 0, end: clip.media.duration };

    const onTimeUpdate = () => {
      if (video.currentTime >= trim.end) advance();
    };
    const start = () => {
      video.playbackRate = clip.speed;
      if (video.currentTime < trim.start || video.currentTime >= trim.end) {
        video.currentTime = trim.start;
      }
      void video.play().catch(() => {});
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    if (video.readyState >= 1) start();
    else {
      const onMeta = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        start();
      };
      video.addEventListener('loadedmetadata', onMeta);
    }

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.pause();
    };
  }, [isPlaying, activeClipId, clips, videoRef, selectClip]);

  // Applies a pending seek (from clicking a clip block) once that clip's
  // video element is ready.
  useEffect(() => {
    const seekTo = pendingSeekRef.current;
    pendingSeekRef.current = null;
    if (seekTo == null) return;
    const idx = clips.findIndex((c) => c.id === activeClipId);
    if (idx === -1 || clips[idx].media.kind !== 'video') return;
    const video = videoRef.current;
    if (!video) return;
    const apply = () => {
      video.currentTime = seekTo;
    };
    if (video.readyState >= 1) apply();
    else {
      const onMeta = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        apply();
      };
      video.addEventListener('loadedmetadata', onMeta);
    }
  }, [activeClipId, clips, videoRef]);

  // Drives the visual playhead position while playing.
  useEffect(() => {
    if (!isPlaying) return;
    let rafId = 0;
    const tick = () => {
      const idx = clips.findIndex((c) => c.id === activeClipId);
      if (idx !== -1) {
        const clip = clips[idx];
        const offset = sequenceOffsetOf(clips, clip.id);
        if (clip.media.kind === 'image') {
          setPlayheadSeq(offset + (performance.now() - imageStartRef.current) / 1000);
        } else {
          const video = videoRef.current;
          const trim = clip.trim ?? { start: 0, end: clip.media.duration };
          if (video) setPlayheadSeq(offset + Math.max(0, video.currentTime - trim.start) / clip.speed);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, activeClipId, clips, videoRef]);

  const togglePlay = () => setIsPlaying((p) => !p);

  const selectClipAtFraction = (clip: Clip, frac: number) => {
    selectClip(clip.id);
    setPlayheadSeq(sequenceOffsetOf(clips, clip.id) + frac * clipDuration(clip));
    if (clip.media.kind === 'video') {
      const trim = clip.trim ?? { start: 0, end: clip.media.duration };
      pendingSeekRef.current = trim.start + frac * (trim.end - trim.start);
    }
  };

  return (
    <div className="timeline-dock">
      <div className="timeline-controls">
        <button className="btn" onClick={togglePlay}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="time-label">
          {formatTime(playheadSeq)} / {formatTime(totalDuration)}
        </span>
      </div>
      <div className="clip-strip">
        <div
          className="clip-strip__playhead"
          style={{ left: `${totalDuration > 0 ? (playheadSeq / totalDuration) * 100 : 0}%` }}
        />
        {clips.map((clip, index) => (
          <ClipBlock
            key={clip.id}
            clip={clip}
            index={index}
            clipCount={clips.length}
            isActive={clip.id === activeClipId}
            thumbs={thumbsByClip[clip.id] ?? []}
            widthFraction={clipDuration(clip) / totalDuration}
            onSelectAtFraction={(frac) => selectClipAtFraction(clip, frac)}
            onSetTrim={setTrim}
            onRemove={() => removeClip(clip.id)}
            onMoveLeft={() => moveClip(clip.id, 'left')}
            onMoveRight={() => moveClip(clip.id, 'right')}
          />
        ))}
        <div className="clip-strip__add">
          <MediaUploader label="+ Add clip" compact />
        </div>
      </div>
    </div>
  );
}

interface ClipBlockProps {
  clip: Clip;
  index: number;
  clipCount: number;
  isActive: boolean;
  thumbs: string[];
  widthFraction: number;
  onSelectAtFraction: (frac: number) => void;
  onSetTrim: (trim: TrimRange | null) => void;
  onRemove: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
}

function ClipBlock({
  clip,
  index,
  clipCount,
  isActive,
  thumbs,
  widthFraction,
  onSelectAtFraction,
  onSetTrim,
  onRemove,
  onMoveLeft,
  onMoveRight,
}: ClipBlockProps) {
  const blockRef = useRef<HTMLDivElement>(null);
  const duration = clip.media.kind === 'video' ? clip.media.duration : clip.imageDuration;
  const trim = clip.trim ?? { start: 0, end: duration };
  const pct = (v: number) => (duration > 0 ? (v / duration) * 100 : 0);

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onSelectAtFraction(clamp01((e.clientX - rect.left) / rect.width));
  };

  const startHandleDrag = (which: 'start' | 'end') => (e: React.PointerEvent) => {
    e.stopPropagation();
    const initial = { ...trim };
    const block = blockRef.current;
    if (!block) return;
    const rect = block.getBoundingClientRect();

    function onMove(ev: PointerEvent) {
      const frac = clamp01((ev.clientX - rect.left) / rect.width);
      const t = frac * duration;
      if (which === 'start') {
        onSetTrim({ start: Math.min(t, initial.end - 0.1), end: initial.end });
      } else {
        onSetTrim({ start: initial.start, end: Math.max(t, initial.start + 0.1) });
      }
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      className={`clip-block ${isActive ? 'clip-block--active' : ''}`}
      style={{ flexGrow: widthFraction, flexBasis: 0 }}
      ref={blockRef}
      onClick={handleClick}
    >
      <div className="clip-block__thumbs">
        {thumbs.map((src, i) => (
          <img key={i} src={src} alt="" draggable={false} />
        ))}
      </div>
      {clip.media.kind === 'video' && isActive && (
        <>
          <div className="timeline-dim timeline-dim--left" style={{ width: `${pct(trim.start)}%` }} />
          <div className="timeline-dim timeline-dim--right" style={{ width: `${100 - pct(trim.end)}%` }} />
          <div
            className="timeline-handle timeline-handle--start"
            style={{ left: `${pct(trim.start)}%` }}
            onPointerDown={startHandleDrag('start')}
          />
          <div
            className="timeline-handle timeline-handle--end"
            style={{ left: `${pct(trim.end)}%` }}
            onPointerDown={startHandleDrag('end')}
          />
        </>
      )}
      <div className="clip-block__label">{clip.media.name}</div>
      <div className="clip-block__controls">
        <button
          className="clip-block__ctrl"
          disabled={index === 0}
          onClick={(e) => {
            e.stopPropagation();
            onMoveLeft();
          }}
          title="Move earlier"
        >
          ‹
        </button>
        <button
          className="clip-block__ctrl clip-block__ctrl--remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove clip"
        >
          ×
        </button>
        <button
          className="clip-block__ctrl"
          disabled={index === clipCount - 1}
          onClick={(e) => {
            e.stopPropagation();
            onMoveRight();
          }}
          title="Move later"
        >
          ›
        </button>
      </div>
    </div>
  );
}
