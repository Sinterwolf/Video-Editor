export type MediaKind = 'image' | 'video';

export interface MediaAsset {
  kind: MediaKind;
  url: string;
  name: string;
  naturalWidth: number;
  naturalHeight: number;
  duration: number; // 0 for images
}

export interface Adjustments {
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  exposure: number; // -100..100
  hue: number; // -180..180
  blur: number; // 0..20 px
  sharpen: number; // 0..100
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  exposure: 0,
  hue: 0,
  blur: 0,
  sharpen: 0,
};

export type PresetFilter =
  | 'none'
  | 'vivid'
  | 'grayscale'
  | 'noir'
  | 'warm'
  | 'cool'
  | 'fade'
  | 'cinematic'
  | 'dramatic'
  | 'golden'
  | 'sepia'
  | 'vintage'
  | 'invert';

export interface CropRect {
  x: number; // normalized 0..1, top-left
  y: number;
  width: number; // normalized 0..1
  height: number;
}

export interface TextOverlay {
  id: string;
  kind: 'text';
  text: string;
  x: number; // normalized center position, 0..1
  y: number;
  fontSize: number; // relative to a 1080px-tall reference frame
  color: string;
  fontFamily: string;
  bold: boolean;
  rotation: number; // degrees
}

export interface ShapeOverlay {
  id: string;
  kind: 'rectangle' | 'circle';
  x: number; // normalized center
  y: number;
  width: number; // normalized
  height: number;
  color: string;
  strokeWidth: number; // px relative to 1080 reference
  filled: boolean;
  rotation: number;
}

export type Overlay = TextOverlay | ShapeOverlay;

export interface TrimRange {
  start: number; // seconds
  end: number; // seconds
}

export type EffectType =
  | 'none'
  | 'throb'
  | 'whiplash'
  | 'blink'
  | 'slideLeft'
  | 'slideRight'
  | 'colorDistortion'
  | 'dollyBack'
  | 'tremorStrobe'
  | 'flash2'
  | 'backToFocus'
  | 'shockShift'
  | 'thunderbolt'
  | 'liquidFlip'
  | 'curvyBlur'
  | 'slideBlur'
  | 'squareBlur'
  | 'twistedFocus'
  | 'garbledGrid'
  | 'datamosh'
  | 'faultFreeze'
  | 'oldFootage'
  | 'superGrain'
  | 'smartSharpen';

export type ToolTab = 'filters' | 'adjust' | 'crop' | 'speed' | 'effects' | 'overlays';

export type ExportState =
  | { status: 'idle' }
  | { status: 'exporting'; progress: number }
  | { status: 'done'; url: string; filename: string }
  | { status: 'error'; message: string };
