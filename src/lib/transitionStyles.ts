/**
 * Imperative visuals for the tree → carousel hand-off, shared by the desktop
 * and mobile journeys. `t` is the curtain transition (0..1): the flight scene
 * softly blurs and pushes in while the chapter text fades out (and leaves the
 * tab order) as the clay clouds rise.
 */
export function applyTransitionStyles(
  t: number,
  canvasWrap: HTMLDivElement | null,
  overlayFade: HTMLDivElement | null
) {
  if (canvasWrap) {
    if (t > 0.001) {
      canvasWrap.style.filter = `blur(${(t * 10).toFixed(2)}px) saturate(${(1 + t * 0.15).toFixed(3)})`;
      canvasWrap.style.transform = `scale(${(1 + t * 0.06).toFixed(4)})`;
    } else if (canvasWrap.style.filter) {
      canvasWrap.style.filter = "";
      canvasWrap.style.transform = "";
    }
  }
  if (overlayFade) {
    const o = Math.max(0, 1 - t * 2.4);
    overlayFade.style.opacity = String(o);
    overlayFade.inert = o < 0.5;
  }
}
