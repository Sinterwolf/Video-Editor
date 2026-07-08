import { create } from 'zustand';
import type {
  Adjustments,
  Clip,
  CropRect,
  EffectType,
  ExportState,
  MediaAsset,
  MusicTrack,
  Overlay,
  PresetFilter,
  TrimRange,
} from '../types';
import { createClip } from '../lib/clip';

interface EditorState {
  clips: Clip[];
  activeClipId: string | null;
  selectedOverlayId: string | null;
  music: MusicTrack | null;
  exportState: ExportState;

  addClips: (mediaList: MediaAsset[]) => void;
  removeClip: (id: string) => void;
  selectClip: (id: string) => void;
  moveClip: (id: string, direction: 'left' | 'right') => void;

  setAdjustment: (key: keyof Adjustments, value: number) => void;
  setPreset: (preset: PresetFilter) => void;
  setVignette: (value: number) => void;
  setCrop: (crop: CropRect | null) => void;
  setTrim: (trim: TrimRange | null) => void;
  setSpeed: (speed: number) => void;
  setEffect: (effect: EffectType) => void;
  setImageDuration: (seconds: number) => void;

  addOverlay: (overlay: Overlay) => void;
  updateOverlay: (id: string, patch: Partial<Overlay>) => void;
  removeOverlay: (id: string) => void;
  selectOverlay: (id: string | null) => void;

  setMusic: (track: MusicTrack) => void;
  removeMusic: () => void;
  setMusicVolume: (volume: number) => void;
  setMusicTrim: (trim: TrimRange | null) => void;
  setMusicOffset: (offset: number) => void;

  setExportState: (state: ExportState) => void;
}

function updateClip(clips: Clip[], id: string | null, patch: Partial<Clip> | ((clip: Clip) => Partial<Clip>)): Clip[] {
  return clips.map((c) => {
    if (c.id !== id) return c;
    const resolved = typeof patch === 'function' ? patch(c) : patch;
    return { ...c, ...resolved };
  });
}

export const useEditorStore = create<EditorState>((set) => ({
  clips: [],
  activeClipId: null,
  selectedOverlayId: null,
  music: null,
  exportState: { status: 'idle' },

  addClips: (mediaList) =>
    set((s) => {
      const newClips = mediaList.map(createClip);
      return {
        clips: [...s.clips, ...newClips],
        activeClipId: newClips[newClips.length - 1]?.id ?? s.activeClipId,
      };
    }),

  removeClip: (id) =>
    set((s) => {
      const clips = s.clips.filter((c) => c.id !== id);
      const activeClipId =
        s.activeClipId === id ? (clips[0]?.id ?? null) : s.activeClipId;
      return { clips, activeClipId };
    }),

  selectClip: (id) => set({ activeClipId: id, selectedOverlayId: null }),

  moveClip: (id, direction) =>
    set((s) => {
      const idx = s.clips.findIndex((c) => c.id === id);
      if (idx === -1) return {};
      const swapWith = direction === 'left' ? idx - 1 : idx + 1;
      if (swapWith < 0 || swapWith >= s.clips.length) return {};
      const clips = [...s.clips];
      [clips[idx], clips[swapWith]] = [clips[swapWith], clips[idx]];
      return { clips };
    }),

  setAdjustment: (key, value) =>
    set((s) => ({
      clips: updateClip(s.clips, s.activeClipId, (c) => ({ adjustments: { ...c.adjustments, [key]: value } })),
    })),
  setPreset: (preset) => set((s) => ({ clips: updateClip(s.clips, s.activeClipId, { preset }) })),
  setVignette: (vignette) => set((s) => ({ clips: updateClip(s.clips, s.activeClipId, { vignette }) })),
  setCrop: (crop) => set((s) => ({ clips: updateClip(s.clips, s.activeClipId, { crop }) })),
  setTrim: (trim) => set((s) => ({ clips: updateClip(s.clips, s.activeClipId, { trim }) })),
  setSpeed: (speed) => set((s) => ({ clips: updateClip(s.clips, s.activeClipId, { speed }) })),
  setEffect: (effect) => set((s) => ({ clips: updateClip(s.clips, s.activeClipId, { effect }) })),
  setImageDuration: (seconds) => set((s) => ({ clips: updateClip(s.clips, s.activeClipId, { imageDuration: seconds }) })),

  addOverlay: (overlay) =>
    set((s) => ({
      clips: updateClip(s.clips, s.activeClipId, (c) => ({ overlays: [...c.overlays, overlay] })),
      selectedOverlayId: overlay.id,
    })),
  updateOverlay: (id, patch) =>
    set((s) => ({
      clips: updateClip(s.clips, s.activeClipId, (c) => ({
        overlays: c.overlays.map((o) => (o.id === id ? ({ ...o, ...patch } as Overlay) : o)),
      })),
    })),
  removeOverlay: (id) =>
    set((s) => ({
      clips: updateClip(s.clips, s.activeClipId, (c) => ({ overlays: c.overlays.filter((o) => o.id !== id) })),
      selectedOverlayId: s.selectedOverlayId === id ? null : s.selectedOverlayId,
    })),
  selectOverlay: (id) => set({ selectedOverlayId: id }),

  setMusic: (track) => set({ music: track }),
  removeMusic: () => set({ music: null }),
  setMusicVolume: (volume) => set((s) => (s.music ? { music: { ...s.music, volume } } : {})),
  setMusicTrim: (trim) => set((s) => (s.music ? { music: { ...s.music, trim } } : {})),
  setMusicOffset: (offset) => set((s) => (s.music ? { music: { ...s.music, offset } } : {})),

  setExportState: (state) => set({ exportState: state }),
}));

export function useActiveClip(): Clip | null {
  return useEditorStore((s) => s.clips.find((c) => c.id === s.activeClipId) ?? null);
}
