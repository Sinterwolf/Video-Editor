export {};

declare global {
  interface HTMLVideoElement {
    captureStream(frameRate?: number): MediaStream;
  }
}
