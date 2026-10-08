"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

/**
 * The stationary, centred Perrie for the orbit section.
 *
 * ASSET LIMITATION: no separate transparent hovering video (WebM/alpha) was
 * supplied in the project — only the flight frame sequences and the four
 * mascot stills. Binding a background-bearing MP4 here, or faking alpha with
 * mix-blend-mode, would both look wrong, so this uses the genuinely
 * transparent mascot PNG (front.png — wings spread, teal neck preserved) with
 * a continuous gentle hover bob. The bob keeps going when scrolling stops and
 * pauses when the section is off-screen or the tab is hidden, matching the
 * intended "wingbeats continue, pause when hidden" behaviour. Drop a
 * transparent WebM in and swap the <Image> for a muted/loop/autoplay/playsInline
 * <video> to upgrade with no other changes.
 */
export default function PerrieHoverVideo({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

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
      <Image
        src="/mascot/front.png"
        alt="Perrie, your AI assistant, hovering with wings spread"
        width={640}
        height={640}
        priority
        className="h-full w-auto drop-shadow-[0_26px_30px_rgba(38,52,69,0.28)]"
      />
    </div>
  );
}
