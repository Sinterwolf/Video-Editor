import type { Clip, MediaAsset } from '../types';
import { DEFAULT_ADJUSTMENTS, DEFAULT_IMAGE_DURATION } from '../types';

let counter = 0;
function newId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createClip(media: MediaAsset): Clip {
  return {
    id: newId(),
    media,
    imageDuration: DEFAULT_IMAGE_DURATION,
    adjustments: DEFAULT_ADJUSTMENTS,
    preset: 'none',
    vignette: 0,
    crop: null,
    trim: null,
    speed: 1,
    effect: 'none',
    overlays: [],
  };
}

/** How long this clip occupies in the exported sequence, in seconds
 * (accounting for trim and playback speed on video clips). */
export function clipDuration(clip: Clip): number {
  if (clip.media.kind === 'image') return clip.imageDuration;
  const trim = clip.trim ?? { start: 0, end: clip.media.duration };
  const span = Math.max(0, trim.end - trim.start);
  return span / clip.speed;
}

export interface SequencePosition {
  clip: Clip;
  index: number;
  clipLocalTime: number; // seconds into this clip's (trimmed) playback
}

/** Given the whole clip list and a time into the overall sequence, finds
 * which clip is playing and how far into that clip's local timeline. */
export function findClipAtSequenceTime(clips: Clip[], sequenceTime: number): SequencePosition | null {
  let elapsed = 0;
  for (let i = 0; i < clips.length; i++) {
    const dur = clipDuration(clips[i]);
    if (sequenceTime < elapsed + dur || i === clips.length - 1) {
      return { clip: clips[i], index: i, clipLocalTime: Math.max(0, sequenceTime - elapsed) };
    }
    elapsed += dur;
  }
  return null;
}

export function totalSequenceDuration(clips: Clip[]): number {
  return clips.reduce((sum, c) => sum + clipDuration(c), 0);
}

export function sequenceOffsetOf(clips: Clip[], clipId: string): number {
  let elapsed = 0;
  for (const c of clips) {
    if (c.id === clipId) return elapsed;
    elapsed += clipDuration(c);
  }
  return 0;
}
