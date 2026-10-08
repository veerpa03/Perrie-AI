"use client";

import { useEffect, useRef } from "react";
import JourneyCanvas from "./JourneyCanvas";
import StoryOverlay from "./StoryOverlay";
import { useAudio } from "./AudioProvider";
import { setJourneyBounds } from "@/lib/scrollTargets";
import { JOURNEY_SCROLL_LENGTH_VH, focalAt } from "@/lib/constants";

/**
 * Mobile journey: a full-viewport `position: sticky` canvas stays pinned while
 * the tall wrapper scrolls, driving the same normalized progress used on
 * desktop. The scene still fills the whole screen edge-to-edge; chapter text
 * sits in a bottom safe zone over a soft scrim so it never covers Perrie
 * (who rides the upper-left of frame).
 *
 * This uses CSS sticky rather than GSAP's scroll pin: on touch devices a
 * plain sticky element driven by scroll offset is far more robust than a
 * pinned, scroll-jacked region.
 */
export default function MobileJourney() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(0);
  const { reportJourneyState } = useAudio();

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    let raf: number;
    const update = () => {
      raf = requestAnimationFrame(update);
      const rect = wrapper.getBoundingClientRect();
      const viewportH = window.innerHeight;
      const total = rect.height - viewportH;
      const scrolled = -rect.top;
      const p = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
      progressRef.current = p;
      const wrapperTop = window.scrollY + rect.top;
      setJourneyBounds(wrapperTop, wrapperTop + Math.max(total, 1));
    };
    update();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section
      id="journey-section"
      ref={wrapperRef}
      className="relative"
      style={{ height: `${JOURNEY_SCROLL_LENGTH_VH}vh` }}
      aria-label="Perrie's journey: from above the clouds to the tree"
    >
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[color:var(--color-sky)]">
        <JourneyCanvas
          progressRef={progressRef}
          tier="sm"
          className="absolute inset-0 h-full w-full"
          onStageChange={reportJourneyState}
          focal={focalAt}
        />
        <StoryOverlay progressRef={progressRef} variant="mobile" />
      </div>
    </section>
  );
}
