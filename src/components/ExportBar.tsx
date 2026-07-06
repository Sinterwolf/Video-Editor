import { useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useMediaElementRef } from '../lib/mediaElementContext';
import { exportImage } from '../lib/export/imageExport';
import { exportVideo } from '../lib/export/videoExport';

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
  const media = useEditorStore((s) => s.media);
  const adjustments = useEditorStore((s) => s.adjustments);
  const preset = useEditorStore((s) => s.preset);
  const vignette = useEditorStore((s) => s.vignette);
  const crop = useEditorStore((s) => s.crop);
  const overlays = useEditorStore((s) => s.overlays);
  const trim = useEditorStore((s) => s.trim);
  const speed = useEditorStore((s) => s.speed);
  const videoRef = useMediaElementRef();

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageFormat, setImageFormat] = useState<'image/png' | 'image/jpeg'>('image/png');

  if (!media) return null;

  const baseName = media.name.replace(/\.[^.]+$/, '') || 'export';

  const handleExportImage = async () => {
    setBusy(true);
    setError(null);
    try {
      const blob = await exportImage({ media, adjustments, preset, vignette, crop, overlays, format: imageFormat });
      const ext = imageFormat === 'image/png' ? 'png' : 'jpg';
      downloadBlob(blob, `${baseName}-edited.${ext}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleExportVideo = async () => {
    const videoEl = videoRef.current;
    if (!videoEl) {
      setError('Video preview is not ready yet.');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const { blob } = await exportVideo({
        videoEl,
        media,
        adjustments,
        preset,
        vignette,
        crop,
        overlays,
        trim,
        speed,
        onProgress: setProgress,
      });
      downloadBlob(blob, `${baseName}-edited.webm`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="export-bar">
      {media.kind === 'image' ? (
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
        <button className="btn btn--primary" onClick={handleExportVideo} disabled={busy}>
          {busy ? `Exporting… ${Math.round(progress * 100)}%` : 'Export video (WebM)'}
        </button>
      )}
      {error && <span className="export-error">{error}</span>}
    </div>
  );
}
