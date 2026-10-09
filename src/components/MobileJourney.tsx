"use client";

import { useRef, useState } from "react";
import JourneyCanvas from "./JourneyCanvas";
import StoryOverlay from "./StoryOverlay";
import CloudCurtain from "./CloudCurtain";
import { useAudio } from "./AudioProvider";
import { setJourneyBounds } from "@/lib/scrollTargets";
import { applyTransitionStyles } from "@/lib/transitionStyles";
import { JOURNEY_PORTION, JOURNEY_SECTION_VH, focalAt } from "@/lib/constants";
import { useJourneyDriver } from "@/hooks/useJourneyDriver";

/**
 * Mobile journey: a full-viewport CSS-sticky canvas driven by scroll offset,
 * with the same fly-in, the same descent-down / ascent-up takes, and the same
 * clay-cloud hand-off into the carousel as desktop. The cover-crop focal point
 * follows Perrie in whichever take is showing, so she is never cropped out on
 * a portrait screen.
 */
export default function MobileJourney() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const overlayFadeRef = useRef<HTMLDivElement>(null);
  const [introDone, setIntroDone] = useState(false);
  const { reportJourneyState } = useAudio();

  const readRaw = () => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return 0;
    const rect = wrapper.getBoundingClientRect();
    // Measure the real pinned height (100svh) rather than a fluctuating
    // window.innerHeight, so progress doesn't drift when the URL bar toggles.
    const stickyH = stickyRef.current?.getBoundingClientRect().height ?? window.innerHeight;
    const total = rect.height - stickyH;
    const top = window.scrollY + rect.top;
    setJourneyBounds(top, top + JOURNEY_PORTION * Math.max(total, 1));
    return total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
  };

  const { targetRef, journeyPRef, curtainTRef } = useJourneyDriver({
    readRaw,
    smoothing: 0.1,
    onIntroDone: () => setIntroDone(true),
    apply: (_p, t) => applyTransitionStyles(t, canvasWrapRef.current, overlayFadeRef.current),
    report: (ambience, speed) => reportJourneyState(ambience, speed),
  });

  return (
    <section
      id="journey-section"
      ref={wrapperRef}
      className="relative"
      style={{ height: `${JOURNEY_SECTION_VH}vh` }}
      aria-label="Perrie's journey: from above the clouds to the tree"
    >
      <div
        ref={stickyRef}
        className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[color:var(--color-sky)]"
      >
        <div ref={canvasWrapRef} className="absolute inset-0 will-change-[filter,transform]">
          <JourneyCanvas
            targetRef={targetRef}
            tier="sm"
            className="absolute inset-0 h-full w-full"
            focal={focalAt}
            prewarm={58}
          />
        </div>
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            introDone ? "opacity-100" : "opacity-0"
          }`}
        >
          <div ref={overlayFadeRef} className="absolute inset-0">
            <StoryOverlay progressRef={journeyPRef} variant="mobile" enabled={introDone} />
          </div>
        </div>
        <CloudCurtain tRef={curtainTRef} />
      </div>
    </section>
  );
}
