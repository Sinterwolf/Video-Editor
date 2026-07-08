import { useCallback, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import type { MediaAsset } from '../types';

function loadImageMeta(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = url;
  });
}

function loadVideoMeta(url: string): Promise<{ width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () =>
      resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration });
    video.onerror = reject;
    video.src = url;
  });
}

async function fileToMediaAsset(file: File): Promise<MediaAsset> {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) throw new Error(`"${file.name}" is not an image or video file.`);

  const url = URL.createObjectURL(file);
  try {
    if (isImage) {
      const { width, height } = await loadImageMeta(url);
      return { kind: 'image', url, name: file.name, naturalWidth: width, naturalHeight: height, duration: 0 };
    }
    const { width, height, duration } = await loadVideoMeta(url);
    return { kind: 'video', url, name: file.name, naturalWidth: width, naturalHeight: height, duration };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error(`Could not read "${file.name}".`);
  }
}

interface Props {
  label?: string;
  compact?: boolean;
}

export function MediaUploader({ label, compact }: Props) {
  const addClips = useEditorStore((s) => s.addClips);
  const clipCount = useEditorStore((s) => s.clips.length);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      const results = await Promise.allSettled(Array.from(files).map(fileToMediaAsset));
      const assets = results.filter((r): r is PromiseFulfilledResult<MediaAsset> => r.status === 'fulfilled').map((r) => r.value);
      const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (assets.length > 0) addClips(assets);
      if (failures.length > 0) setError(failures.map((f) => (f.reason instanceof Error ? f.reason.message : 'Import failed.')).join(' '));
    },
    [addClips],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  return (
    <div
      className={`uploader ${compact ? 'uploader--compact' : ''} ${dragActive ? 'uploader--active' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div className="uploader__content">
        {!compact && <div className="uploader__icon">+</div>}
        <p>{label ?? (clipCount > 0 ? 'Add more clips, or click to browse' : 'Drop images or videos here, or click to browse')}</p>
        {error && <p className="uploader__error">{error}</p>}
      </div>
    </div>
  );
}
