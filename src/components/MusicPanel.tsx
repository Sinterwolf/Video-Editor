import { useCallback, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useAudioElementRef } from '../lib/audioElementContext';
import { clamp01 } from '../lib/pointerDrag';
import { formatTime } from '../lib/time';
import type { MusicTrack } from '../types';

function loadAudioDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = document.createElement('audio');
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => resolve(audio.duration);
    audio.onerror = reject;
    audio.src = url;
  });
}

export function MusicPanel() {
  const music = useEditorStore((s) => s.music);
  const setMusic = useEditorStore((s) => s.setMusic);
  const removeMusic = useEditorStore((s) => s.removeMusic);
  const setMusicVolume = useEditorStore((s) => s.setMusicVolume);
  const setMusicTrim = useEditorStore((s) => s.setMusicTrim);
  const setMusicOffset = useEditorStore((s) => s.setMusicOffset);
  const audioRef = useAudioElementRef();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith('audio/')) {
        setError('Please choose an audio file.');
        return;
      }
      const url = URL.createObjectURL(file);
      try {
        const duration = await loadAudioDuration(url);
        const track: MusicTrack = { url, name: file.name, duration, volume: 1, trim: null, offset: 0 };
        setMusic(track);
      } catch {
        setError('Could not read that audio file.');
        URL.revokeObjectURL(url);
      }
    },
    [setMusic],
  );

  if (!music) {
    return (
      <div className="panel">
        <h3>Music</h3>
        <p className="hint">
          Add a soundtrack that plays under your whole sequence. Upload your own audio file — for royalty-free
          tracks, YouTube's official{' '}
          <a href="https://www.youtube.com/audiolibrary" target="_blank" rel="noreferrer">
            Audio Library
          </a>{' '}
          lets you download tracks to reuse (downloading audio directly from YouTube videos isn't supported here,
          since that would violate YouTube's terms).
        </p>
        <button className="btn" onClick={() => inputRef.current?.click()}>
          Upload audio file
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = '';
          }}
        />
        {error && <p className="uploader__error">{error}</p>}
      </div>
    );
  }

  const trim = music.trim ?? { start: 0, end: music.duration };
  const pct = (v: number) => (music.duration > 0 ? (v / music.duration) * 100 : 0);

  const startHandleDrag = (which: 'start' | 'end') => (e: React.PointerEvent) => {
    e.stopPropagation();
    const initial = { ...trim };
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();

    function onMove(ev: PointerEvent) {
      const frac = clamp01((ev.clientX - rect.left) / rect.width);
      const t = frac * music!.duration;
      if (which === 'start') {
        setMusicTrim({ start: Math.min(t, initial.end - 0.1), end: initial.end });
      } else {
        setMusicTrim({ start: initial.start, end: Math.max(t, initial.start + 0.1) });
      }
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const preview = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = trim.start;
    audio.volume = music.volume;
    void audio.play();
    window.setTimeout(() => audio.pause(), Math.min(6000, (trim.end - trim.start) * 1000));
  };

  return (
    <div className="panel">
      <h3>Music</h3>
      <p className="hint">
        {music.name} ({formatTime(music.duration)})
      </p>

      <h3>Volume</h3>
      <div className="slider-row">
        <label>Level</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={music.volume}
          onChange={(e) => setMusicVolume(Number(e.target.value))}
        />
        <span className="slider-value">{Math.round(music.volume * 100)}%</span>
      </div>

      <h3>Trim</h3>
      <div className="timeline-track" ref={trackRef}>
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
      </div>
      <p className="hint">Using {formatTime(trim.end - trim.start)} of the track.</p>

      <h3>Start offset</h3>
      <div className="slider-row">
        <label>Seconds in</label>
        <input
          type="range"
          min={0}
          max={60}
          step={0.5}
          value={music.offset}
          onChange={(e) => setMusicOffset(Number(e.target.value))}
        />
        <span className="slider-value">{music.offset.toFixed(1)}s</span>
      </div>
      <p className="hint">When the music starts playing, relative to the start of your sequence.</p>

      <div className="chip-row">
        <button className="btn" onClick={preview}>
          Preview
        </button>
        <button className="btn" onClick={removeMusic}>
          Remove music
        </button>
      </div>
    </div>
  );
}
