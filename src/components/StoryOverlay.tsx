"use client";

import { useEffect, useRef } from "react";
import { ArrowDown } from "lucide-react";
import { CHAPTERS } from "@/lib/constants";
import { scrollToChapter } from "@/lib/scrollTargets";
import { useDemoModal } from "./DemoModal";

interface Props {
  progressRef: React.MutableRefObject<number>;
  variant?: "desktop" | "mobile";
  // While false (during the opening fly-in) all chapter text is hidden and
  // removed from the tab order; it reveals once the intro completes.
  enabled?: boolean;
}

/**
 * The cinematic text layer. Chapter blocks float directly over the fullscreen
 * canvas inside per-chapter safe zones (anchored to the open side of each
 * composition), cross-fading as normalized progress moves. All motion is
 * driven by a rAF loop reading the progress ref and mutating element styles —
 * no React state per frame — so it stays in lockstep with the canvas.
 *
 * Text is logically tied to journey POSITION (not playback time), so it stays
 * consistent when the visitor scrolls back up.
 */

const FADE = 0.05;

function chapterOpacity(p: number, from: number, to: number): number {
  const hasEnter = from > 0.0001;
  const hasExit = to < 0.9999;
  const lo = hasEnter ? from - FADE : -1;
  const hi = hasExit ? to + FADE : 2;
  if (p <= lo || p >= hi) return 0;
  let o = 1;
  if (hasEnter && p < from + FADE) o = Math.min(o, (p - (from - FADE)) / (2 * FADE));
  if (hasExit && p > to - FADE) o = Math.min(o, (to + FADE - p) / (2 * FADE));
  return Math.max(0, Math.min(1, o));
}

export default function StoryOverlay({ progressRef, variant = "desktop", enabled = true }: Props) {
  const { open } = useDemoModal();
  const blockRefs = useRef<(HTMLElement | null)[]>([]);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const fillRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef<number>(-1);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);

      // During the fly-in, keep every chapter hidden and non-interactive.
      if (!enabledRef.current) {
        for (const el of blockRefs.current) {
          if (!el) continue;
          el.style.opacity = "0";
          el.style.pointerEvents = "none";
          el.setAttribute("aria-hidden", "true");
          el.inert = true;
        }
        if (fillRef.current) fillRef.current.style.height = "0%";
        if (barRef.current) barRef.current.style.transform = "scaleX(0)";
        return;
      }

      const p = progressRef.current;

      let active = 0;
      for (let i = 0; i < CHAPTERS.length; i++) {
        const c = CHAPTERS[i];
        const el = blockRefs.current[i];
        if (p >= c.from && p <= c.to) active = i;
        if (!el) continue;
        const o = chapterOpacity(p, c.from, c.to);
        el.style.opacity = String(o);
        el.style.transform = `translate3d(0, ${(1 - o) * 16}px, 0)`;
        const interactive = o > 0.6;
        el.style.pointerEvents = interactive ? "auto" : "none";
        el.setAttribute("aria-hidden", interactive ? "false" : "true");
        el.inert = !interactive;
      }

      if (fillRef.current) fillRef.current.style.height = `${p * 100}%`;
      if (barRef.current) barRef.current.style.transform = `scaleX(${Math.max(0, Math.min(1, p))})`;

      if (active !== activeRef.current) {
        activeRef.current = active;
        dotRefs.current.forEach((dot, i) => {
          if (!dot) return;
          dot.setAttribute("aria-current", i === active ? "true" : "false");
          dot.dataset.active = i === active ? "true" : "false";
        });
      }
    };
    tick();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [progressRef]);

  const isMobile = variant === "mobile";

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* Mobile legibility scrim at the base of the scene. */}
      {isMobile && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-[52vh] bg-gradient-to-t from-[color:var(--color-cloud)]/90 via-[color:var(--color-cloud)]/40 to-transparent"
        />
      )}

      {/* Mobile top progress bar. */}
      {isMobile && (
        <div className="absolute inset-x-0 top-0 h-[3px] bg-[color:var(--color-slate)]/10">
          <div
            ref={barRef}
            className="h-full origin-left bg-[color:var(--color-teal-deep)]"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      )}

      {/* Chapter text blocks. */}
      {CHAPTERS.map((c, i) => {
        const Heading = c.heading === "h1" ? "h1" : "h2";
        const primary = "primary" in c ? c.primary : undefined;
        const secondary = "secondary" in c ? c.secondary : undefined;
        return (
          <section
            key={c.id}
            ref={(el) => {
              blockRefs.current[i] = el;
            }}
            aria-label={c.headline}
            className={
              isMobile
                ? "absolute inset-x-0 bottom-0 flex justify-center px-6 pb-[15vh] will-change-[opacity,transform]"
                : "absolute inset-0 flex items-center justify-end will-change-[opacity,transform]"
            }
            style={{ opacity: i === 0 ? 1 : 0 }}
          >
            <div
              className={
                isMobile
                  ? "relative w-full max-w-md text-center"
                  : "relative mr-[7vw] w-full max-w-md px-2 text-left"
              }
            >
              {/* Soft localized scrim — borderless glow, not a card. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-x-10 -inset-y-10 -z-10 rounded-[3rem] bg-[radial-gradient(62%_62%_at_50%_50%,rgba(250,250,247,0.66),rgba(250,250,247,0)_72%)] blur-xl"
              />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-teal-deep)] sm:text-sm">
                {c.eyebrow}
              </p>
              <Heading
                className="mt-3 font-heading text-4xl font-bold leading-[1.05] text-[color:var(--color-slate)] [text-shadow:0_1px_24px_rgba(250,250,247,0.55)] sm:text-5xl lg:text-6xl"
              >
                {c.headline}
              </Heading>
              <p className="mt-4 text-base leading-relaxed text-[color:var(--color-slate)]/85 sm:text-lg">
                {c.support}
              </p>

              {(primary || secondary) && (
                <div
                  className={`mt-7 flex flex-wrap items-center gap-3 ${
                    isMobile ? "justify-center" : "justify-start"
                  }`}
                >
                  {primary && (
                    <button
                      type="button"
                      onClick={open}
                      className="focus-ring rounded-full bg-[color:var(--color-teal-deep)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-[0.98] sm:text-base"
                    >
                      {primary.label}
                    </button>
                  )}
                  {secondary && (
                    <button
                      type="button"
                      onClick={() => scrollToChapter("clarity")}
                      className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-slate)]/15 bg-white/70 px-5 py-3 text-sm font-semibold text-[color:var(--color-slate)] backdrop-blur-sm transition hover:bg-white sm:text-base"
                    >
                      {secondary.label}
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        );
      })}

      {/* Desktop chapter rail + progress fill. */}
      {!isMobile && (
        <div className="pointer-events-auto absolute right-5 top-1/2 h-[42vh] w-px -translate-y-1/2 bg-[color:var(--color-slate)]/15">
          <div
            ref={fillRef}
            aria-hidden="true"
            className="absolute left-0 top-0 w-full bg-[color:var(--color-teal-deep)]"
            style={{ height: "0%" }}
          />
          {CHAPTERS.map((c, i) => {
            const mid = (c.from + c.to) / 2;
            return (
              <button
                key={c.id}
                type="button"
                ref={(el) => {
                  dotRefs.current[i] = el;
                }}
                onClick={() => scrollToChapter(c.id)}
                aria-label={`Go to: ${c.headline}`}
                data-active={i === 0 ? "true" : "false"}
                className="group absolute left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center"
                style={{ top: `${mid * 100}%` }}
              >
                <span className="h-2 w-2 rounded-full bg-[color:var(--color-slate)]/30 ring-0 ring-[color:var(--color-teal-deep)] transition-all duration-300 group-hover:bg-[color:var(--color-teal-deep)] group-data-[active=true]:h-3 group-data-[active=true]:w-3 group-data-[active=true]:bg-[color:var(--color-teal-deep)] group-data-[active=true]:ring-4 group-data-[active=true]:ring-[color:var(--color-teal-deep)]/20" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
