"use client";

import { useEffect, useRef, useState } from "react";
import JourneyCanvas from "./JourneyCanvas";
import StoryOverlay from "./StoryOverlay";
import { useAudio } from "./AudioProvider";
import { setJourneyBounds } from "@/lib/scrollTargets";
import { JOURNEY_SCROLL_LENGTH_VH, HERO_FRAC, INTRO_MS, chapterAt, focalAt } from "@/lib/constants";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Mobile journey: a full-viewport CSS-sticky canvas driven by scroll offset,
 * with the same opening fly-in as desktop (scroll locked for ~2.6s, Perrie
 * flies in to the hero pose, then scroll takes over). Scroll maps onto frames
 * HERO_FRAC..1, so scrolling back to the top rests on the hero frame and never
 * replays the fly-in.
 */
export default function MobileJourney() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const scrollProgressRef = useRef(0);
  const frameProgressRef = useRef(0);
  const [introDone, setIntroDone] = useState(false);
  const { reportJourneyState } = useAudio();
  const reportRef = useRef(reportJourneyState);
  reportRef.current = reportJourneyState;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const prevRestoration =
      "scrollRestoration" in history ? history.scrollRestoration : null;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

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
          scrollProgressRef.current = 0;
        }
      } else {
        const rect = wrapper.getBoundingClientRect();
        // Measure the actual sticky (pinned) height rather than reading a
        // fluctuating window.innerHeight — the sticky child is 100svh, so the
        // real pin travel is wrapperHeight - stickyHeight, and p reaches 1
        // exactly at the unpin point even as the mobile URL bar toggles.
        const stickyH = stickyRef.current?.getBoundingClientRect().height ?? window.innerHeight;
        const total = rect.height - stickyH;
        const scrolled = -rect.top;
        const p = total > 0 ? Math.min(1, Math.max(0, scrolled / total)) : 0;
        scrollProgressRef.current = p;
        frameProgressRef.current = HERO_FRAC + p * (1 - HERO_FRAC);
        const wrapperTop = window.scrollY + rect.top;
        setJourneyBounds(wrapperTop, wrapperTop + Math.max(total, 1));
      }

      const speed = Math.min(1, Math.abs(frameProgressRef.current - lastFrameProg) * 12);
      lastFrameProg = frameProgressRef.current;
      reportRef.current(chapterAt(scrollProgressRef.current).ambience, speed);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      unlock();
      if (prevRestoration && "scrollRestoration" in history)
        history.scrollRestoration = prevRestoration;
    };
  }, []);

  return (
    <section
      id="journey-section"
      ref={wrapperRef}
      className="relative"
      style={{ height: `${JOURNEY_SCROLL_LENGTH_VH}vh` }}
      aria-label="Perrie's journey: from above the clouds to the tree"
    >
      <div
        ref={stickyRef}
        className="sticky top-0 h-[100svh] w-full overflow-hidden bg-[color:var(--color-sky)]"
      >
        <JourneyCanvas
          progressRef={frameProgressRef}
          tier="sm"
          className="absolute inset-0 h-full w-full"
          focal={focalAt}
          prewarm={90}
        />
        <div
          className={`absolute inset-0 transition-opacity duration-700 ${
            introDone ? "opacity-100" : "opacity-0"
          }`}
        >
          <StoryOverlay progressRef={scrollProgressRef} variant="mobile" enabled={introDone} />
        </div>
      </div>
    </section>
  );
}
