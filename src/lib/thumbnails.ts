import type { MediaAsset } from '../types';

function captureVideoFrames(url: string, duration: number, times: number[], width: number): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = url;
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const results: string[] = [];
    let index = 0;

    video.onloadedmetadata = () => {
      canvas.width = width;
      canvas.height = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * width) || width);
      seekNext();
    };
    video.onerror = () => reject(new Error('Could not load video for thumbnails'));

    function seekNext() {
      if (index >= times.length) {
        resolve(results);
        return;
      }
      video.currentTime = Math.min(Math.max(duration - 0.05, 0), Math.max(0, times[index]));
    }

    video.onseeked = () => {
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        results.push(canvas.toDataURL('image/jpeg', 0.6));
      }
      index++;
      seekNext();
    };
  });
}

/** Generates `count` evenly-spaced thumbnail frames across a video's duration,
 * for the filmstrip timeline. */
export function generateVideoThumbnails(url: string, duration: number, count: number, width = 160): Promise<string[]> {
  const times = Array.from({ length: count }, (_, i) => (duration / count) * (i + 0.5));
  return captureVideoFrames(url, duration, times, width);
}

/** A single representative thumbnail for a media asset, used as the base
 * image for the filter preset gallery swatches. */
export async function getMediaThumbnail(media: MediaAsset, width = 120): Promise<string> {
  if (media.kind === 'image') {
    const img = new Image();
    img.src = media.url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * width) || width);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported in this browser.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  }
  const [frame] = await captureVideoFrames(media.url, media.duration, [Math.min(media.duration / 2, 0.5)], width);
  return frame;
}
