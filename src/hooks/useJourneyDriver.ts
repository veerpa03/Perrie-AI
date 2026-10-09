"use client";

import { useEffect, useRef } from "react";
import {
  HERO_FRAC,
  INTRO_MS,
  ascentFracFor,
  chapterAt,
  descentFracFor,
  splitJourneyProgress,
  type Ambience,
} from "@/lib/constants";
import { DirectionalSequencer, type TakeTarget } from "@/lib/journeyController";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

interface Options {
  /** Raw scroll progress of the pinned journey section (0..1), incl. the tail. */
  readRaw: () => number;
  /** Exponential smoothing of the raw progress (0 = none). */
  smoothing: number;
  /** Called once when the opening fly-in has finished. */
  onIntroDone: () => void;
  /** Imperative per-frame visuals (journey progress p, curtain transition t). */
  apply: (p: number, t: number) => void;
  /** Audio hook: active environment + flight intensity (0..1). */
  report: (ambience: Ambience, speed: number) => void;
}

/**
 * One rAF loop that drives the whole cinematic section (desktop and mobile):
 *  1. the one-time opening fly-in (scroll locked, descent frames 0→hero),
 *  2. then scroll → journey progress p + transition t (see TRANSITION),
 *  3. p → which flight take to show (DirectionalSequencer: descent when
 *     scrolling down, ascent when scrolling up),
 *  4. imperative visuals and audio.
 * Nothing here sets React state per frame.
 */
export function useJourneyDriver(opts: Options) {
  const targetRef = useRef<TakeTarget>({ seq: "descent", frac: 0, otherFrac: ascentFracFor(0) });
  const journeyPRef = useRef(0);
  const curtainTRef = useRef(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const prevRestoration = "scrollRestoration" in history ? history.scrollRestoration : null;
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);

    // Scroll lock for the duration of the fly-in.
    const preventWheel = (e: Event) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      if ([" ", "Spacebar", "PageDown", "PageUp", "ArrowDown", "ArrowUp", "Home", "End"].includes(e.key))
        e.preventDefault();
    };
    let locked = true;
    window.addEventListener("wheel", preventWheel, { passive: false });
    window.addEventListener("touchmove", preventWheel, { passive: false });
    window.addEventListener("keydown", preventKeys, { passive: false });
    const unlock = () => {
      if (!locked) return;
      locked = false;
      window.removeEventListener("wheel", preventWheel);
      window.removeEventListener("touchmove", preventWheel);
      window.removeEventListener("keydown", preventKeys);
    };

    const sequencer = new DirectionalSequencer();
    let introStart: number | null = null;
    let introActive = true;
    let smoothRaw = 0;
    let lastMotion = 0;
    let raf = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const o = optsRef.current;
      let motion: number;

      if (introActive) {
        if (introStart === null) introStart = now;
        const k = (now - introStart) / INTRO_MS;
        if (k >= 1) {
          introActive = false;
          unlock();
          o.onIntroDone();
          targetRef.current = { seq: "descent", frac: HERO_FRAC, otherFrac: ascentFracFor(0) };
        } else {
          targetRef.current = {
            seq: "descent",
            frac: easeOutCubic(Math.max(0, k)) * HERO_FRAC,
            otherFrac: ascentFracFor(0),
          };
        }
        journeyPRef.current = 0;
        curtainTRef.current = 0;
        motion = targetRef.current.frac;
      } else {
        const raw = o.readRaw();
        const next = smoothRaw + (raw - smoothRaw) * (1 - o.smoothing);
        smoothRaw = Math.abs(next - raw) < 0.0004 ? raw : next;
        const { p, t } = splitJourneyProgress(smoothRaw);
        journeyPRef.current = p;
        curtainTRef.current = t;
        targetRef.current = sequencer.update(p, now);
        motion = descentFracFor(p);
      }

      o.apply(journeyPRef.current, curtainTRef.current);
      const speed = Math.min(1, Math.abs(motion - lastMotion) * 12);
      lastMotion = motion;
      o.report(chapterAt(journeyPRef.current).ambience, speed);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      unlock();
      if (prevRestoration && "scrollRestoration" in history) history.scrollRestoration = prevRestoration;
    };
  }, []);

  return { targetRef, journeyPRef, curtainTRef };
}
