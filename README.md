# Video & Photo Editor

A browser-based editor for images and video: upload a file, apply filters and
adjustments, crop, trim/speed up video, add text and shape overlays, and
export the result. Everything runs client-side — no upload to any server.

## Features

- **Upload**: drag-and-drop or file picker, images and videos
- **Filters**: a visual gallery with live thumbnail previews — Original,
  Vivid, B&W, Noir, Warm, Cool, Fade, Cinematic, Dramatic, Golden, Sepia,
  Vintage, Invert
- **Adjust**: brightness, contrast, saturation, exposure, hue, blur, sharpen,
  and a vignette, as a separate tab from the filter gallery
- **Crop**: draggable crop box with free-form or fixed aspect ratios (1:1,
  16:9, 9:16, 4:3)
- **Timeline**: an always-visible filmstrip (real thumbnails from the clip)
  below the preview for video, with a playhead and draggable in/out trim
  handles
- **Speed**: adjust playback speed (0.25x–3x) for video
- **Text & shapes**: add draggable/resizable text captions, rectangles, and
  circles
- **Export**: images as PNG/JPEG; video as WebM, re-rendered frame-by-frame
  through the same pipeline used for the live preview, so the export always
  matches what you see

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
- Sharpen is approximated in the live video preview (CSS has no convolution
  filter) but is applied at full quality on export, since export re-renders
  every frame through a canvas pixel pipeline.
