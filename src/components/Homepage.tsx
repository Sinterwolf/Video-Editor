import { MediaUploader } from './MediaUploader';

const FEATURES = [
  {
    title: 'Multi-clip timeline',
    description: 'Add several images and videos, arrange them in sequence, and export them all as one combined video.',
  },
  {
    title: 'Filters & Adjust',
    description: '13 visual presets with live thumbnail previews, plus fine-grained brightness, contrast, hue, and sharpen sliders.',
  },
  {
    title: 'Effects',
    description: 'Throb, glitch, freeze-frame, swirl, film grain, and more — animated effects baked straight into your export.',
  },
  {
    title: 'Crop & Timeline',
    description: 'Freeform or fixed aspect ratios, with a filmstrip timeline for scrubbing and trimming each clip.',
  },
  {
    title: 'Text & Shapes',
    description: 'Draggable, resizable captions, rectangles, and circles layered on top of your media.',
  },
  {
    title: 'Music',
    description: 'Upload a soundtrack and mix it under your whole sequence, with volume, trim, and offset controls.',
  },
  {
    title: 'Speed control',
    description: 'Slow footage down or speed it up from 0.25x to 3x; images get an adjustable on-screen duration.',
  },
  {
    title: 'Export',
    description: 'PNG/JPEG for a single image, or one combined WebM video — rendered pixel-for-pixel to match the live preview.',
  },
];

export function Homepage() {
  return (
    <div className="homepage">
      <div className="homepage__hero">
        <h1 className="homepage__title">Video &amp; Photo Editor</h1>
        <p className="homepage__tagline">
          Add multiple photos and videos, arrange them on a timeline, apply filters,
          effects, and music — entirely in your browser. Nothing you upload ever
          leaves your device.
        </p>
      </div>

      <div className="homepage__uploader">
        <MediaUploader />
      </div>

      <div className="homepage__features">
        {FEATURES.map((f) => (
          <div className="feature-card" key={f.title}>
            <h3>{f.title}</h3>
            <p>{f.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
