"use client";

import { useEffect, useRef } from "react";
import JourneyCanvas from "./JourneyCanvas";
import { useAudio } from "./AudioProvider";
import { setJourneyBounds } from "@/lib/scrollTargets";
import HeroPanel from "./panels/HeroPanel";
import ProblemPanel from "./panels/ProblemPanel";
import CapabilitiesPanel from "./panels/CapabilitiesPanel";
import HowItWorksPanel from "./panels/HowItWorksPanel";
import PerchedPanel from "./panels/PerchedPanel";

/**
 * Mobile layout: a CSS `position: sticky` canvas stays pinned near the top
 * of the viewport while story panels scroll underneath it in ordinary
 * document flow. This intentionally avoids GSAP's scroll-jacking pin on
 * mobile — a fixed-height pinned viewport with cross-faded panels proved
 * fragile once panel content (e.g. the demo planner) exceeded the
 * available height: there is no reliable way to let a nested panel scroll
 * independently and then hand scroll back to the page once it starts
 * driving a pin's progress at the same time. Plain document flow sidesteps
 * the whole class of bug and is also simpler to reason about on touch
 * devices.
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
    <div ref={wrapperRef} className="relative">
      <div className="sticky top-16 z-10 h-[46vh] w-full overflow-hidden bg-[color:var(--color-sky)] shadow-[0_8px_24px_-12px_rgba(38,52,69,0.25)]">
        <JourneyCanvas
          progressRef={progressRef}
          tier="sm"
          className="h-full w-full"
          onStageChange={reportJourneyState}
        />
      </div>

      <div className="relative z-0 bg-[color:var(--color-sky)]">
        <div className="px-6 py-10">
          <HeroPanel />
        </div>
        <div className="px-6 py-10">
          <ProblemPanel />
        </div>
        <div id="capabilities" className="px-6 py-10">
          <CapabilitiesPanel />
        </div>
        <div id="how-it-works" className="px-6 py-10">
          <HowItWorksPanel />
        </div>
        <div className="px-6 py-10">
          <PerchedPanel />
        </div>
      </div>
    </div>
  );
}
