"use client";

import { useEffect, useState } from "react";

/**
 * Returns false during SSR and the first client (hydration) render, then true
 * after mount. Use it to defer variant decisions that depend on
 * client-only signals (media queries, reduced-motion) so the server-rendered
 * HTML and the first client render agree on a safe, accessible default.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
