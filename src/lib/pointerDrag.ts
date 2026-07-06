/** Tracks a pointer drag and reports movement normalized to the stage root's
 * bounding box (the nearest ancestor with [data-stage-root]). */
export function trackPointerDrag(
  e: { clientX: number; clientY: number; currentTarget: EventTarget | null },
  onMove: (dxNorm: number, dyNorm: number) => void,
  onEnd?: () => void,
): void {
  const target = e.currentTarget as HTMLElement | null;
  const stageRoot = (target?.closest('[data-stage-root]') as HTMLElement | null) ?? target;
  if (!stageRoot) return;
  const rect = stageRoot.getBoundingClientRect();
  const startX = e.clientX;
  const startY = e.clientY;

  function handleMove(ev: PointerEvent) {
    onMove((ev.clientX - startX) / rect.width, (ev.clientY - startY) / rect.height);
  }
  function handleUp() {
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
    onEnd?.();
  }
  window.addEventListener('pointermove', handleMove);
  window.addEventListener('pointerup', handleUp);
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}
