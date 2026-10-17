"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Returns false during SSR and the first client (hydration) render, then true
 * after mount. Use it to defer variant decisions that depend on
 * client-only signals (media queries, reduced-motion) so the server-rendered
 * HTML and the first client render agree on a safe, accessible default.
 *
 * Uses useLayoutEffect (not useEffect) so the variant swap commits before the
 * browser paints — otherwise the static fallback is visibly painted first and
 * then replaced a frame later, which reads as a load glitch/flash.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => setMounted(true), []);
  return mounted;
}
