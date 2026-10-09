"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import JourneyCanvas from "./JourneyCanvas";
import StoryOverlay from "./StoryOverlay";
import CloudCurtain from "./CloudCurtain";
import MobileJourney from "./MobileJourney";
import ReducedMotionJourney from "./ReducedMotionJourney";
import {
  BREAKPOINTS,
  JOURNEY_PORTION,
  JOURNEY_SECTION_VH,
  PROGRESS_SMOOTHING,
} from "@/lib/constants";
import { setJourneyBounds } from "@/lib/scrollTargets";
import { applyTransitionStyles } from "@/lib/transitionStyles";
import { useAudio } from "./AudioProvider";
import { useMounted } from "@/hooks/useMounted";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useJourneyDriver } from "@/hooks/useJourneyDriver";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function DesktopJourney() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const overlayFadeRef = useRef<HTMLDivElement>(null);
  const rawRef = useRef(0);
  const [introDone, setIntroDone] = useState(false);
  const { reportJourneyState } = useAudio();

  const { targetRef, journeyPRef, curtainTRef } = useJourneyDriver({
    readRaw: () => rawRef.current,
    smoothing: PROGRESS_SMOOTHING,
    onIntroDone: () => setIntroDone(true),
    apply: (_p, t) => applyTransitionStyles(t, canvasWrapRef.current, overlayFadeRef.current),
    report: (ambience, speed) => reportJourneyState(ambience, speed),
  });

  useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (!section || !sticky) return;
    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      pin: sticky,
      pinSpacing: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        rawRef.current = self.progress;
      },
      onRefresh: (self) => {
        // Chapter navigation targets the journey only (not the transition tail).
        setJourneyBounds(self.start, self.start + JOURNEY_PORTION * (self.end - self.start));
      },
    });
    return () => trigger.kill();
  }, []);

  return (
    <section
      id="journey-section"
      ref={sectionRef}
      className="relative"
      style={{ height: `${JOURNEY_SECTION_VH}vh` }}
      aria-label="Perrie's journey: from above the clouds to the tree"
    >
      <div
        ref={stickyRef}
        className="relative h-[100svh] w-full overflow-hidden bg-[color:var(--color-sky)]"
      >
        <div ref={canvasWrapRef} className="absolute inset-0 will-change-[filter,transform]">
          <JourneyCanvas targetRef={targetRef} tier="lg" className="absolute inset-0 h-full w-full" prewarm={58} />
        </div>
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            introDone ? "opacity-100" : "opacity-0"
          }`}
        >
          <div ref={overlayFadeRef} className="absolute inset-0">
            <StoryOverlay progressRef={journeyPRef} variant="desktop" enabled={introDone} />
          </div>
        </div>
        <CloudCurtain tRef={curtainTRef} />
      </div>
    </section>
  );
}

export default function JourneySection() {
  const mounted = useMounted();
  const reducedMotion = useReducedMotion();
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.mobile}px)`);

  // Until the client-only media queries resolve, render the static, accessible,
  // JS-independent variant (what the server sends), so reduced-motion and
  // mobile visitors never mount the pinned GSAP journey + canvas.
  if (!mounted || reducedMotion) return <ReducedMotionJourney />;
  if (isMobile) return <MobileJourney />;
  return <DesktopJourney />;
}
