# Video & Photo Editor

A browser-based multi-clip editor for images and video: upload several
clips, arrange them on a timeline, apply filters and adjustments, crop,
trim/speed each one, add text/shape overlays and a music track, and export
the whole sequence as one video. Everything runs client-side — no upload to
any server.

## Features

- **Multi-clip timeline**: upload several images/videos at once (or add
  more later), arrange them in sequence, reorder or remove any clip, and
  export them all as a single combined video — each clip keeps its own
  filters, crop, trim, speed, effect, and overlays
- **Music**: upload an audio file as a soundtrack for the whole sequence,
  with volume, trim, and start-offset controls (see the note below on
  where to source royalty-free tracks)
- **Upload**: drag-and-drop or file picker, images and videos
- **Filters**: a visual gallery with live thumbnail previews — Original,
  Vivid, B&W, Noir, Warm, Cool, Fade, Cinematic, Dramatic, Golden, Sepia,
  Vintage, Invert
- **Adjust**: brightness, contrast, saturation, exposure, hue, blur, sharpen,
  and a vignette, as a separate tab from the filter gallery
- **Crop**: draggable crop box with free-form or fixed aspect ratios (1:1,
  16:9, 9:16, 4:3)
- **Timeline**: an always-visible filmstrip (real thumbnails per clip)
  below the preview, with a sequence-wide playhead and draggable in/out
  trim handles per clip
- **Speed**: adjust playback speed (0.25x–3x) for video; images have an
  adjustable on-screen duration instead
- **Effects** (video only): 24 animated, repeating, time-based effects
  grouped into Motion (Throb, Whiplash, Dolly Back, Tremor Strobe, Shock
  Shift, Come in from the Left/Right), Flash (Blink, Flash 2, Thunderbolt),
  Blur & Focus (Back to Focus, Curvy Blur, Slide Blur, Square Blur, Twisted
  Focus, Smart Sharpen), Glitch (Color Distortion, Garbled Grid, Datamosh,
  Fault Freeze, Liquid Flip), and Film (Old Footage, Super Grain)
- **Text & shapes**: add draggable/resizable text captions, rectangles, and
  circles
- **Export**: a single image clip exports as PNG/JPEG; anything else
  (multiple clips, or one video clip) exports as one combined WebM video,
  re-rendered frame-by-frame through the same pipeline used for the live
  preview, with each video clip's own audio and the music track mixed
  together

## Running it

### Option 1 — download a file and open it (no install, no server)

```
npm install
npm run build
```

This produces a single file at `dist/index.html` that contains the entire
app inlined (JS, CSS, everything). Copy that one file anywhere — a USB
drive, email attachment, another computer — and open it by double-clicking
it or dragging it into a browser tab. It works fully offline with no dev
server, no network access, and no install step on the receiving end.

### Option 2 — run the dev server and open it via a link

```
npm install
npm run dev
```

Open the printed `http://localhost:5173` link in your browser.

### Option 3 — desktop app (Electron)

For a native desktop window instead of a browser tab:

```
npm run electron:dev
```

To produce a real installable/downloadable desktop app (`.AppImage` on
Linux, `.exe` installer on Windows, `.dmg` on macOS):

```
npm run electron:build
```

The output lands in `release/`. Note: `electron-builder`/`electron` need to
download prebuilt binaries from GitHub on first run — do this on a machine
with normal, unrestricted internet access (it will not work from a
network-sandboxed CI/session).

## Notes

- Video export uses `MediaRecorder`, so the exported container is WebM
  (VP9/Opus) — the most broadly supported option across browsers without
  extra dependencies.
- The combined export's resolution is taken from the first clip; other
  clips are letterboxed (scaled to fit, centered, no distortion) into that
  frame rather than stretched.
- Music import is upload-only. Downloading audio from YouTube videos
  isn't supported, since that violates YouTube's terms — for royalty-free
  tracks, use YouTube's own [Audio Library](https://www.youtube.com/audiolibrary),
  which explicitly allows downloading tracks to reuse, then upload the
  file here.
- Whenever an effect is selected, the video preview switches from playing
  the raw file to rendering every frame through the same canvas pipeline
  used for export (crop, filters, the effect, vignette), so what you see
  while editing always matches the exported file exactly. With no effect
  selected, video plays back natively for the smoothest possible preview.
