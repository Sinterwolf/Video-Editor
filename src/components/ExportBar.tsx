import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useMediaElementRef } from '../lib/mediaElementContext';
import { useAudioElementRef } from '../lib/audioElementContext';
import { exportImage } from '../lib/export/imageExport';
import { exportSequence } from '../lib/export/sequenceExport';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ExportBar() {
  const clips = useEditorStore((s) => s.clips);
  const music = useEditorStore((s) => s.music);
  const videoRef = useMediaElementRef();
  const audioRef = useAudioElementRef();

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageFormat, setImageFormat] = useState<'image/png' | 'image/jpeg'>('image/png');

  if (clips.length === 0) return null;

  const singleImage = clips.length === 1 && clips[0].media.kind === 'image' ? clips[0] : null;
  const baseName = (singleImage ? singleImage.media.name : 'sequence').replace(/\.[^.]+$/, '') || 'export';

  const handleExportImage = async () => {
    if (!singleImage) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await exportImage({
        media: singleImage.media,
        adjustments: singleImage.adjustments,
        preset: singleImage.preset,
        vignette: singleImage.vignette,
        crop: singleImage.crop,
        overlays: singleImage.overlays,
        format: imageFormat,
      });
      const ext = imageFormat === 'image/png' ? 'png' : 'jpg';
      downloadBlob(blob, `${baseName}-edited.${ext}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleExportSequence = async () => {
    const videoEl = videoRef.current;
    if (!videoEl) {
      setError('Preview is not ready yet.');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const { blob } = await exportSequence({
        clips,
        music,
        videoEl,
        audioEl: audioRef.current,
        onProgress: setProgress,
      });
      downloadBlob(blob, `${baseName}-edited.webm`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
      // The export loop repoints the shared <video> at each clip in turn;
      // restore it to whatever the user currently has selected for editing.
      const { clips: latestClips, activeClipId } = useEditorStore.getState();
      const activeClip = latestClips.find((c) => c.id === activeClipId);
      const video = videoRef.current;
      if (video && activeClip && activeClip.media.kind === 'video') {
        video.src = activeClip.media.url;
        video.currentTime = activeClip.trim?.start ?? 0;
      }
    }
  };

  return (
    <div className="export-bar">
      {singleImage ? (
        <>
          <select
            value={imageFormat}
            onChange={(e) => setImageFormat(e.target.value as 'image/png' | 'image/jpeg')}
            disabled={busy}
          >
            <option value="image/png">PNG</option>
            <option value="image/jpeg">JPEG</option>
          </select>
          <button className="btn btn--primary" onClick={handleExportImage} disabled={busy}>
            {busy ? 'Exporting…' : 'Export image'}
          </button>
        </>
      ) : (
        <button className="btn btn--primary" onClick={handleExportSequence} disabled={busy}>
          {busy ? `Exporting… ${Math.round(progress * 100)}%` : 'Export video (WebM)'}
        </button>
      )}
      {error && <span className="export-error">{error}</span>}
    </div>
  );
}
