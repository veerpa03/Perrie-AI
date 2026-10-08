"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import JourneyCanvas from "./JourneyCanvas";
import StoryOverlay from "./StoryOverlay";
import MobileJourney from "./MobileJourney";
import ReducedMotionJourney from "./ReducedMotionJourney";
import { JOURNEY_SCROLL_LENGTH_VH, PROGRESS_SMOOTHING, BREAKPOINTS } from "@/lib/constants";
import { setJourneyBounds } from "@/lib/scrollTargets";
import { useAudio } from "./AudioProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useMediaQuery } from "@/hooks/useMediaQuery";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

function DesktopJourney() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const rawProgressRef = useRef(0);
  const smoothProgressRef = useRef(0);
  const { reportJourneyState } = useAudio();

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
        rawProgressRef.current = self.progress;
      },
      onRefresh: (self) => {
        setJourneyBounds(self.start, self.end);
      },
    });

    let raf: number;
    const smooth = () => {
      raf = requestAnimationFrame(smooth);
      const target = rawProgressRef.current;
      const current = smoothProgressRef.current;
      const next = current + (target - current) * (1 - PROGRESS_SMOOTHING);
      smoothProgressRef.current = Math.abs(next - target) < 0.0005 ? target : next;
    };
    smooth();

    return () => {
      cancelAnimationFrame(raf);
      trigger.kill();
    };
  }, []);

  return (
    <section
      id="journey-section"
      ref={sectionRef}
      className="relative"
      style={{ height: `${JOURNEY_SCROLL_LENGTH_VH}vh` }}
      aria-label="Perrie's journey: from above the clouds to the tree"
    >
      <div
        ref={stickyRef}
        className="relative h-[100svh] w-full overflow-hidden bg-[color:var(--color-sky)]"
      >
        <JourneyCanvas
          progressRef={smoothProgressRef}
          tier="lg"
          className="absolute inset-0 h-full w-full"
          onStageChange={reportJourneyState}
        />
        <StoryOverlay progressRef={smoothProgressRef} variant="desktop" />
      </div>
    </section>
  );
}

export default function JourneySection() {
  const reducedMotion = useReducedMotion();
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.mobile}px)`);

  if (reducedMotion) return <ReducedMotionJourney />;
  if (isMobile) return <MobileJourney />;
  return <DesktopJourney />;
}
