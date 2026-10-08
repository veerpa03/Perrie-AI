"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

/**
 * The stationary, centred Perrie for the orbit section.
 *
 * Uses the supplied hovering clip. The source is a 640×640 H.264 MP4 on a solid
 * WHITE background with no alpha channel, so it was keyed offline (tight white
 * colorkey that preserves the bird's own white belly/wing feathers and the teal
 * neck — verified over a tinted background) and exported to a transparent
 * animated WebP. That plays in a plain <img> (real alpha, no mix-blend-mode) and
 * loops continuously in all modern browsers; a keyed transparent PNG is the
 * poster / reduced-motion fallback. See scripts note in the handoff.
 *
 * A gentle hover bob rides on top of the clip's own wing motion and pauses when
 * the section is off-screen or the tab is hidden.
 */
export default function PerrieHoverVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = true;
    const apply = () => {
      el.dataset.paused = !visible || document.hidden ? "true" : "false";
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible = e.isIntersecting;
        apply();
      },
      { threshold: 0.05 }
    );
    io.observe(el);
    const onVis = () => apply();
    document.addEventListener("visibilitychange", onVis);
    apply();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-paused="false"
      className={`perrie-float pointer-events-none select-none ${className ?? ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={reduced ? "/mascot/perrie-hover.png" : "/mascot/perrie-hover.webp"}
        alt="Perrie, your AI assistant, hovering with wings spread"
        width={460}
        height={460}
        loading="lazy"
        decoding="async"
        className="h-full w-auto drop-shadow-[0_28px_34px_rgba(38,52,69,0.22)]"
      />
    </div>
  );
}
