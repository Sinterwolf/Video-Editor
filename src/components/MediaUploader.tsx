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

export function MediaUploader() {
  const setMedia = useEditorStore((s) => s.setMedia);
  const media = useEditorStore((s) => s.media);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        setError('Please choose an image or video file.');
        return;
      }
      const url = URL.createObjectURL(file);
      try {
        if (isImage) {
          const { width, height } = await loadImageMeta(url);
          const asset: MediaAsset = { kind: 'image', url, name: file.name, naturalWidth: width, naturalHeight: height, duration: 0 };
          setMedia(asset);
        } else {
          const { width, height, duration } = await loadVideoMeta(url);
          const asset: MediaAsset = { kind: 'video', url, name: file.name, naturalWidth: width, naturalHeight: height, duration };
          setMedia(asset);
        }
      } catch {
        setError('Could not read that file.');
        URL.revokeObjectURL(url);
      }
    },
    [setMedia],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div
      className={`uploader ${dragActive ? 'uploader--active' : ''}`}
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
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      <div className="uploader__content">
        <div className="uploader__icon">+</div>
        <p>{media ? 'Drop a new file to replace, or click to browse' : 'Drop an image or video here, or click to browse'}</p>
        {error && <p className="uploader__error">{error}</p>}
      </div>
    </div>
  );
}
