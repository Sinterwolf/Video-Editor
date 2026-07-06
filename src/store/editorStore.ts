import { create } from 'zustand';
import type {
  Adjustments,
  CropRect,
  ExportState,
  MediaAsset,
  Overlay,
  PresetFilter,
  TrimRange,
} from '../types';
import { DEFAULT_ADJUSTMENTS } from '../types';

interface EditorState {
  media: MediaAsset | null;
  adjustments: Adjustments;
  preset: PresetFilter;
  vignette: number; // 0..100
  crop: CropRect | null;
  trim: TrimRange | null;
  speed: number;
  overlays: Overlay[];
  selectedOverlayId: string | null;
  exportState: ExportState;

  setMedia: (media: MediaAsset) => void;
  resetEdits: () => void;
  setAdjustment: (key: keyof Adjustments, value: number) => void;
  setPreset: (preset: PresetFilter) => void;
  setVignette: (value: number) => void;
  setCrop: (crop: CropRect | null) => void;
  setTrim: (trim: TrimRange | null) => void;
  setSpeed: (speed: number) => void;
  addOverlay: (overlay: Overlay) => void;
  updateOverlay: (id: string, patch: Partial<Overlay>) => void;
  removeOverlay: (id: string) => void;
  selectOverlay: (id: string | null) => void;
  setExportState: (state: ExportState) => void;
}

const editsDefaults = {
  adjustments: DEFAULT_ADJUSTMENTS,
  preset: 'none' as PresetFilter,
  vignette: 0,
  crop: null as CropRect | null,
  trim: null as TrimRange | null,
  speed: 1,
  overlays: [] as Overlay[],
  selectedOverlayId: null as string | null,
};

export const useEditorStore = create<EditorState>((set) => ({
  media: null,
  ...editsDefaults,
  exportState: { status: 'idle' },

  setMedia: (media) => set({ media, ...editsDefaults }),
  resetEdits: () => set({ ...editsDefaults }),

  setAdjustment: (key, value) =>
    set((s) => ({ adjustments: { ...s.adjustments, [key]: value } })),
  setPreset: (preset) => set({ preset }),
  setVignette: (value) => set({ vignette: value }),
  setCrop: (crop) => set({ crop }),
  setTrim: (trim) => set({ trim }),
  setSpeed: (speed) => set({ speed }),

  addOverlay: (overlay) =>
    set((s) => ({ overlays: [...s.overlays, overlay], selectedOverlayId: overlay.id })),
  updateOverlay: (id, patch) =>
    set((s) => ({
      overlays: s.overlays.map((o) => (o.id === id ? ({ ...o, ...patch } as Overlay) : o)),
    })),
  removeOverlay: (id) =>
    set((s) => ({
      overlays: s.overlays.filter((o) => o.id !== id),
      selectedOverlayId: s.selectedOverlayId === id ? null : s.selectedOverlayId,
    })),
  selectOverlay: (id) => set({ selectedOverlayId: id }),

  setExportState: (state) => set({ exportState: state }),
}));
