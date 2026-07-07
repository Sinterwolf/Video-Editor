import { renderFrame } from '../render';
import type { Adjustments, CropRect, EffectType, MediaAsset, Overlay, PresetFilter, TrimRange } from '../../types';

export interface VideoExportParams {
  videoEl: HTMLVideoElement;
  media: MediaAsset;
  adjustments: Adjustments;
  preset: PresetFilter;
  vignette: number;
  crop: CropRect | null;
  overlays: Overlay[];
  trim: TrimRange | null;
  speed: number;
  effect: EffectType;
  onProgress: (fraction: number) => void;
}

export interface VideoExportResult {
  blob: Blob;
  mimeType: string;
}

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

function pickSupportedMimeType(): string {
  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate;
  }
  return '';
}

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    const handler = () => {
      video.removeEventListener('seeked', handler);
      resolve();
    };
    video.addEventListener('seeked', handler);
  });
}

export async function exportVideo(params: VideoExportParams): Promise<VideoExportResult> {
  const { videoEl, media, crop, adjustments, preset, vignette, overlays, trim, speed, effect, onProgress } = params;
  const effectiveCrop = crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const effectiveTrim = trim ?? { start: 0, end: media.duration };
  const span = Math.max(0.01, effectiveTrim.end - effectiveTrim.start);

  const outWidth = Math.max(2, Math.round(media.naturalWidth * effectiveCrop.width));
  const outHeight = Math.max(2, Math.round(media.naturalHeight * effectiveCrop.height));

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D is not supported in this browser.');

  const originalTime = videoEl.currentTime;
  const originalRate = videoEl.playbackRate;
  const wasPaused = videoEl.paused;

  const canvasStream = canvas.captureStream(30);
  const audioTracks = videoEl.captureStream ? videoEl.captureStream().getAudioTracks() : [];
  const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);

  const mimeType = pickSupportedMimeType();
  const recorder = mimeType
    ? new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 8_000_000 })
    : new MediaRecorder(combinedStream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const recordingDone = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType || 'video/webm' }));
  });

  videoEl.playbackRate = speed;
  videoEl.currentTime = effectiveTrim.start;
  await waitForSeek(videoEl);

  let rafId = 0;
  const baseRenderOpts = { naturalWidth: media.naturalWidth, naturalHeight: media.naturalHeight, crop, adjustments, preset, vignette, overlays };

  const drawLoop = () => {
    const effectTime = Math.max(0, videoEl.currentTime - effectiveTrim.start);
    renderFrame(ctx, videoEl, { ...baseRenderOpts, effect, effectTime });
    const frac = (videoEl.currentTime - effectiveTrim.start) / span;
    onProgress(Math.min(1, Math.max(0, frac)));
    if (videoEl.currentTime < effectiveTrim.end && !videoEl.ended && recorder.state === 'recording') {
      rafId = requestAnimationFrame(drawLoop);
    } else {
      if (recorder.state === 'recording') recorder.stop();
    }
  };

  recorder.start(250);
  await videoEl.play();
  rafId = requestAnimationFrame(drawLoop);

  const blob = await recordingDone;
  cancelAnimationFrame(rafId);
  onProgress(1);

  videoEl.pause();
  videoEl.currentTime = originalTime;
  videoEl.playbackRate = originalRate;
  if (!wasPaused) void videoEl.play();

  return { blob, mimeType: mimeType || 'video/webm' };
}
