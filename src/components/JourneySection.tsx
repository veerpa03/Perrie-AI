"use client";

import { useEffect, useRef, useState } from "react";
import { useMounted } from "@/hooks/useMounted";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import JourneyCanvas from "./JourneyCanvas";
import StoryOverlay from "./StoryOverlay";
import MobileJourney from "./MobileJourney";
import ReducedMotionJourney from "./ReducedMotionJourney";
import {
  JOURNEY_SCROLL_LENGTH_VH,
  PROGRESS_SMOOTHING,
  BREAKPOINTS,
  HERO_FRAC,
  INTRO_MS,
  chapterAt,
} from "@/lib/constants";
import { setJourneyBounds } from "@/lib/scrollTargets";
import { useAudio } from "./AudioProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useMediaQuery } from "@/hooks/useMediaQuery";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function DesktopJourney() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const rawScrollRef = useRef(0);
  const smoothScrollRef = useRef(0);
  // Full-sequence frame progress fed to the canvas (fly-in + scroll combined).
  const frameProgressRef = useRef(0);
  const [introDone, setIntroDone] = useState(false);
  const { reportJourneyState } = useAudio();
  // Keep the audio callback in a ref so toggling sound never re-runs the
  // effect (which would replay the fly-in).
  const reportRef = useRef(reportJourneyState);
  reportRef.current = reportJourneyState;

  useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    if (!section || !sticky) return;

    // Start every fresh load at the top so the fly-in always plays from frame 0.
    const prevRestoration =
      "scrollRestoration" in history ? history.scrollRestoration : null;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    // Scroll lock for the duration of the fly-in.
    const preventWheel = (e: Event) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      const k = e.key;
      if ([" ", "Spacebar", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"].includes(k))
        e.preventDefault();
    };
    const lock = () => {
      window.addEventListener("wheel", preventWheel, { passive: false });
      window.addEventListener("touchmove", preventWheel, { passive: false });
      window.addEventListener("keydown", preventKeys, { passive: false });
    };
    const unlock = () => {
      window.removeEventListener("wheel", preventWheel);
      window.removeEventListener("touchmove", preventWheel);
      window.removeEventListener("keydown", preventKeys);
    };
    lock();

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      pin: sticky,
      pinSpacing: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        rawScrollRef.current = self.progress;
      },
      onRefresh: (self) => {
        setJourneyBounds(self.start, self.end);
      },
    });

    let introStart: number | null = null;
    let introActive = true;
    let lastFrameProg = 0;
    let raf: number;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();

      if (introActive) {
        if (introStart === null) introStart = now;
        const t = (now - introStart) / INTRO_MS;
        if (t >= 1) {
          introActive = false;
          frameProgressRef.current = HERO_FRAC;
          unlock();
          setIntroDone(true);
        } else {
          frameProgressRef.current = easeOutCubic(Math.max(0, t)) * HERO_FRAC;
          smoothScrollRef.current = 0;
        }
      } else {
        const target = rawScrollRef.current;
        const current = smoothScrollRef.current;
        const next = current + (target - current) * (1 - PROGRESS_SMOOTHING);
        smoothScrollRef.current = Math.abs(next - target) < 0.0005 ? target : next;
        frameProgressRef.current = HERO_FRAC + smoothScrollRef.current * (1 - HERO_FRAC);
      }

      // Audio: environment by chapter (scroll space), intensity by flight speed.
      const speed = Math.min(1, Math.abs(frameProgressRef.current - lastFrameProg) * 12);
      lastFrameProg = frameProgressRef.current;
      reportRef.current(chapterAt(smoothScrollRef.current).ambience, speed);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      unlock();
      trigger.kill();
      if (prevRestoration && "scrollRestoration" in history)
        history.scrollRestoration = prevRestoration;
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
          progressRef={frameProgressRef}
          tier="lg"
          className="absolute inset-0 h-full w-full"
          prewarm={90}
        />
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            introDone ? "opacity-100" : "opacity-0"
          }`}
        >
          <StoryOverlay progressRef={smoothScrollRef} variant="desktop" enabled={introDone} />
        </div>
      </div>
    </section>
  );
}

export default function JourneySection() {
  const mounted = useMounted();
  const reducedMotion = useReducedMotion();
  const isMobile = useMediaQuery(`(max-width: ${BREAKPOINTS.mobile}px)`);

  // Until the client-only media queries resolve, render the static, accessible,
  // JS-independent variant. This is what the server sends and what the first
  // client render produces, so reduced-motion and mobile visitors never mount
  // (and then discard) the pinned GSAP journey + canvas.
  if (!mounted || reducedMotion) return <ReducedMotionJourney />;
  if (isMobile) return <MobileJourney />;
  return <DesktopJourney />;
}
