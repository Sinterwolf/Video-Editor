import { renderFrame } from '../render';
import { clipDuration, totalSequenceDuration } from '../clip';
import type { Clip, MusicTrack } from '../../types';

export interface SequenceExportParams {
  clips: Clip[];
  music: MusicTrack | null;
  videoEl: HTMLVideoElement;
  audioEl: HTMLAudioElement | null;
  onProgress: (fraction: number) => void;
}

export interface SequenceExportResult {
  blob: Blob;
  mimeType: string;
}

const MIME_CANDIDATES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

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

function waitForLoad(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve) => {
    if (video.readyState >= 1) {
      resolve();
      return;
    }
    const handler = () => {
      video.removeEventListener('loadedmetadata', handler);
      resolve();
    };
    video.addEventListener('loadedmetadata', handler);
  });
}

async function loadImageElement(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

// A lazily-created, page-lifetime Web Audio graph. createMediaElementSource
// can only ever be called once per <video>/<audio> element, so this is
// cached rather than rebuilt on every export.
interface AudioGraph {
  ctx: AudioContext;
  dest: MediaStreamAudioDestinationNode;
  clipGain: GainNode;
  musicGain: GainNode;
  clipSource: MediaElementAudioSourceNode | null;
  musicSource: MediaElementAudioSourceNode | null;
}

let cachedGraph: AudioGraph | null = null;

function getAudioGraph(videoEl: HTMLVideoElement, audioEl: HTMLAudioElement | null): AudioGraph {
  if (!cachedGraph) {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    const clipGain = ctx.createGain();
    const musicGain = ctx.createGain();
    clipGain.connect(dest);
    clipGain.connect(ctx.destination);
    musicGain.connect(dest);
    musicGain.connect(ctx.destination);
    cachedGraph = { ctx, dest, clipGain, musicGain, clipSource: null, musicSource: null };
  }
  const graph = cachedGraph;
  if (!graph.clipSource) {
    graph.clipSource = graph.ctx.createMediaElementSource(videoEl);
    graph.clipSource.connect(graph.clipGain);
  }
  if (audioEl && !graph.musicSource) {
    graph.musicSource = graph.ctx.createMediaElementSource(audioEl);
    graph.musicSource.connect(graph.musicGain);
  }
  return graph;
}

/** Renders every clip in order into one continuous recording (images are
 * held for their assigned duration), mixing each video clip's own audio
 * with the music track. All clips are letterboxed to a single output
 * resolution taken from the first clip. */
export async function exportSequence(params: SequenceExportParams): Promise<SequenceExportResult> {
  const { clips, music, videoEl, audioEl, onProgress } = params;
  if (clips.length === 0) throw new Error('No clips to export.');

  const totalDuration = Math.max(0.1, totalSequenceDuration(clips));

  const first = clips[0];
  const firstCrop = first.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const outWidth = Math.max(2, Math.round(first.media.naturalWidth * firstCrop.width));
  const outHeight = Math.max(2, Math.round(first.media.naturalHeight * firstCrop.height));

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = outWidth;
  outputCanvas.height = outHeight;
  const outCtx = outputCanvas.getContext('2d');
  if (!outCtx) throw new Error('Canvas 2D is not supported in this browser.');

  const graph = getAudioGraph(videoEl, music ? audioEl : null);
  await graph.ctx.resume();

  const canvasStream = outputCanvas.captureStream(30);
  const combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...graph.dest.stream.getAudioTracks()]);

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

  recorder.start(250);

  let musicStarted = false;
  const musicTrim = music ? (music.trim ?? { start: 0, end: music.duration }) : null;

  function updateMusic(sequenceElapsed: number) {
    if (!music || !audioEl || !musicTrim) return;
    if (!musicStarted && sequenceElapsed >= music.offset) {
      audioEl.currentTime = musicTrim.start;
      graph.musicGain.gain.value = music.volume;
      void audioEl.play().catch(() => {});
      musicStarted = true;
    }
    if (musicStarted && audioEl.currentTime >= musicTrim.end) {
      audioEl.pause();
    }
  }

  let elapsedBeforeClip = 0;

  for (const clip of clips) {
    const dur = clipDuration(clip);
    const clipCrop = clip.crop ?? { x: 0, y: 0, width: 1, height: 1 };
    const clipWidth = Math.max(2, Math.round(clip.media.naturalWidth * clipCrop.width));
    const clipHeight = Math.max(2, Math.round(clip.media.naturalHeight * clipCrop.height));

    const clipCanvas = document.createElement('canvas');
    clipCanvas.width = clipWidth;
    clipCanvas.height = clipHeight;
    const clipCtx = clipCanvas.getContext('2d');
    if (!clipCtx) throw new Error('Canvas 2D is not supported in this browser.');

    const fitScale = Math.min(outWidth / clipWidth, outHeight / clipHeight);
    const drawW = clipWidth * fitScale;
    const drawH = clipHeight * fitScale;
    const drawX = (outWidth - drawW) / 2;
    const drawY = (outHeight - drawH) / 2;

    const compositeAndReport = (localSequenceTime: number) => {
      outCtx.fillStyle = '#000';
      outCtx.fillRect(0, 0, outWidth, outHeight);
      outCtx.drawImage(clipCanvas, drawX, drawY, drawW, drawH);
      const sequenceElapsed = elapsedBeforeClip + localSequenceTime;
      updateMusic(sequenceElapsed);
      onProgress(Math.min(1, sequenceElapsed / totalDuration));
    };

    if (clip.media.kind === 'video') {
      graph.clipGain.gain.value = 1;
      videoEl.src = clip.media.url;
      await waitForLoad(videoEl);
      videoEl.playbackRate = clip.speed;
      const trim = clip.trim ?? { start: 0, end: clip.media.duration };
      videoEl.currentTime = trim.start;
      await waitForSeek(videoEl);
      await videoEl.play();

      await new Promise<void>((resolve) => {
        const loop = () => {
          const localT = Math.max(0, videoEl.currentTime - trim.start);
          renderFrame(clipCtx, videoEl, {
            naturalWidth: clip.media.naturalWidth,
            naturalHeight: clip.media.naturalHeight,
            crop: clip.crop,
            adjustments: clip.adjustments,
            preset: clip.preset,
            vignette: clip.vignette,
            overlays: clip.overlays,
            effect: clip.effect,
            effectTime: localT,
          });
          compositeAndReport(localT / clip.speed);
          if (videoEl.currentTime < trim.end && !videoEl.ended) {
            requestAnimationFrame(loop);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(loop);
      });
      videoEl.pause();
    } else {
      graph.clipGain.gain.value = 0;
      const img = await loadImageElement(clip.media.url);
      const startTime = performance.now();

      await new Promise<void>((resolve) => {
        const loop = () => {
          const localT = (performance.now() - startTime) / 1000;
          renderFrame(clipCtx, img, {
            naturalWidth: clip.media.naturalWidth,
            naturalHeight: clip.media.naturalHeight,
            crop: clip.crop,
            adjustments: clip.adjustments,
            preset: clip.preset,
            vignette: clip.vignette,
            overlays: clip.overlays,
            effect: 'none',
            effectTime: 0,
          });
          compositeAndReport(Math.min(localT, dur));
          if (localT < dur) {
            requestAnimationFrame(loop);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(loop);
      });
    }

    elapsedBeforeClip += dur;
  }

  if (audioEl) audioEl.pause();
  recorder.stop();
  const blob = await recordingDone;
  onProgress(1);
  return { blob, mimeType: mimeType || 'video/webm' };
}
