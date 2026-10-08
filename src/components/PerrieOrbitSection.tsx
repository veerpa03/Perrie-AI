"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ORBIT, ORBIT_FEATURES } from "@/lib/constants";
import PerrieHoverVideo from "./PerrieHoverVideo";
import OrbitFeatureCard from "./OrbitFeatureCard";
import ClayIcon from "./ClayIcons";
import { LiquidGlass, LiquidGlassControl } from "./ui/liquid-glass";
import { useMounted } from "@/hooks/useMounted";
import { useReducedMotion } from "@/hooks/useReducedMotion";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

type Geometry = (typeof ORBIT.geometry)[keyof typeof ORBIT.geometry];

function geometryFor(width: number): Geometry {
  if (width < 640) return ORBIT.geometry.mobile;
  if (width < 1024) return ORBIT.geometry.tablet;
  return ORBIT.geometry.desktop;
}

/** The animated, scroll-driven orbit (desktop/tablet/mobile). */
function OrbitStage() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const birdWrapRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rawProgressRef = useRef(0);
  const rotationRef = useRef(0);
  const geomRef = useRef<Geometry>(ORBIT.geometry.desktop);
  const boundsRef = useRef<{ start: number; end: number }>({ start: 0, end: 1 });
  const activeRef = useRef(0);
  // One-time, time-based entrance played when the stage first becomes visible —
  // decoupled from scroll rotation so feature 0 (at progress 0) is fully shown.
  const introStartRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);

  // Navigate so a given feature index sits at the front.
  const goTo = (index: number) => {
    const p = Math.max(0, Math.min(1, index / ORBIT_FEATURES.length));
    const { start, end } = boundsRef.current;
    window.scrollTo({ top: start + p * (end - start), behavior: "smooth" });
  };

  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    const measure = () => {
      geomRef.current = geometryFor(window.innerWidth);
    };
    measure();
    window.addEventListener("resize", measure);

    // Start the staggered entrance the first time the stage is on screen.
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && introStartRef.current === null) {
            introStartRef.current = performance.now();
          }
        }
      },
      { threshold: 0.12 }
    );
    io.observe(stage);

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      pin: stage,
      pinSpacing: true,
      anticipatePin: 1,
      onUpdate: (self) => {
        rawProgressRef.current = self.progress;
      },
      onRefresh: (self) => {
        boundsRef.current = { start: self.start, end: self.end };
      },
    });

    let raf: number;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const progress = rawProgressRef.current;
      const g = geomRef.current;

      // One authoritative rotation value, smoothed.
      const target = progress * TWO_PI;
      rotationRef.current += (target - rotationRef.current) * (1 - ORBIT.rotationSmoothing);
      const rotation = rotationRef.current;

      // Time-based entrance (ms since the stage first appeared).
      const now2 = performance.now();
      const elapsed = introStartRef.current === null ? 0 : now2 - introStartRef.current;

      for (let i = 0; i < ORBIT_FEATURES.length; i++) {
        const card = cardRefs.current[i];
        if (!card) continue;
        const theta = i * HALF_PI - rotation;
        const depth = Math.cos(theta); // 1 = front, -1 = back
        const norm = (depth + 1) / 2;
        const x = Math.sin(theta) * g.radiusX;
        const y = g.verticalOffset + depth * g.radiusY;
        const scale = ORBIT.scaleBack + (ORBIT.scaleFront - ORBIT.scaleBack) * norm;
        const blur = ORBIT.maxBlurPx * (1 - norm);
        // Staggered fade/rise in, then stays.
        const enter = easeOut((elapsed - 220 - i * 130) / 700);
        const yEnter = (1 - enter) * 44;
        const opacity = (ORBIT.opacityBack + (1 - ORBIT.opacityBack) * norm) * enter;

        card.style.width = `${g.cardW}px`;
        card.style.transform = `translate(-50%, -50%) translate(${x}px, ${y + yEnter}px) scale(${scale})`;
        card.style.opacity = String(opacity);
        card.style.filter = blur > 0.12 ? `blur(${blur}px)` : "none";
        card.style.zIndex = depth >= 0 ? "30" : "10";
      }

      // Bird entrance (its continuous hover bob is its own CSS animation).
      if (birdWrapRef.current) {
        birdWrapRef.current.style.opacity = String(easeOut(elapsed / 650));
      }

      // Active feature = the card rounded to the front. Stable (no flicker).
      const front = ((Math.round(rotation / HALF_PI) % ORBIT_FEATURES.length) +
        ORBIT_FEATURES.length) %
        ORBIT_FEATURES.length;
      if (front !== activeRef.current) {
        activeRef.current = front;
        setActive(front);
      }
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      trigger.kill();
    };
  }, []);

  const feature = ORBIT_FEATURES[active];

  return (
    <section
      ref={sectionRef}
      id="features"
      className="relative"
      style={{ height: `${ORBIT.scrollLengthVh}vh` }}
      aria-label="What Perrie helps with"
    >
      <div
        ref={stageRef}
        className="relative flex h-[100svh] w-full items-center justify-center overflow-hidden"
        style={{
          background:
            "linear-gradient(180deg, var(--color-dusty) 0%, var(--color-cream) 42%, var(--color-powder) 100%)",
        }}
      >
        {/* Subtle oversized background phrase (not brand name). */}
        <span
          aria-hidden="true"
          className="font-display pointer-events-none absolute inset-x-0 top-[16%] z-0 text-center text-[16vw] leading-none text-[color:var(--color-slate)] opacity-[0.04]"
        >
          Less busywork
        </span>

        {/* Orbiting cards (behind + in front of the bird via dynamic z-index). */}
        {ORBIT_FEATURES.map((f, i) => (
          <OrbitFeatureCard
            key={f.id}
            feature={f}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
          />
        ))}

        {/* Stationary, centred Perrie (outside the rotating math; z between layers). */}
        <div
          ref={birdWrapRef}
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
        >
          <PerrieHoverVideo className="h-[34vh] sm:h-[40vh]" />
        </div>

        {/* Synchronized caption (decorative; a11y content is the sr-only list). */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-[6%] z-40 flex flex-col items-center px-6 text-center"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center"
            >
              <h2 className="font-display text-4xl text-[color:var(--color-slate)] sm:text-5xl">
                {feature.title}
              </h2>
              <p className="mt-2 max-w-xs text-sm text-[color:var(--color-slate)]/75 sm:text-base">
                {feature.description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Controls */}
          <div className="mt-5 flex items-center gap-3">
            <LiquidGlassControl
              size={42}
              aria-label="Previous feature"
              onClick={() => goTo(active - 1)}
              className="pointer-events-auto"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </LiquidGlassControl>

            <div className="flex items-center gap-2">
              {ORBIT_FEATURES.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  aria-label={`Show: ${f.title}`}
                  aria-current={i === active ? "true" : undefined}
                  onClick={() => goTo(i)}
                  className="focus-ring pointer-events-auto grid h-6 w-6 place-items-center"
                >
                  <span
                    className="rounded-full bg-[color:var(--color-slate)]/30 transition-all duration-300"
                    style={
                      i === active
                        ? { width: 22, height: 8, background: "var(--color-teal-deep)" }
                        : { width: 8, height: 8 }
                    }
                  />
                </button>
              ))}
            </div>

            <LiquidGlassControl
              size={42}
              aria-label="Next feature"
              onClick={() => goTo(active + 1)}
              className="pointer-events-auto"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </LiquidGlassControl>
          </div>
        </div>

        {/* Accessible, stable reading order of all features. */}
        <ul className="sr-only">
          {ORBIT_FEATURES.map((f) => (
            <li key={f.id}>
              {f.title} {f.description}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Static, reduced-motion / SSR-safe variant: readable clay card grid. */
function OrbitStatic() {
  return (
    <section
      id="features"
      className="relative overflow-hidden px-6 py-20 sm:py-24"
      style={{
        background:
          "linear-gradient(180deg, var(--color-dusty) 0%, var(--color-cream) 50%, var(--color-powder) 100%)",
      }}
      aria-label="What Perrie helps with"
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center text-center">
          <PerrieHoverVideo className="h-40 sm:h-52" />
          <h2 className="font-display mt-4 text-4xl text-[color:var(--color-slate)] sm:text-5xl">
            A few things off your plate
          </h2>
        </div>
        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {ORBIT_FEATURES.map((f) => (
            <li
              key={f.id}
              className="clay flex items-center gap-4 p-5"
              style={{ background: f.accent, borderRadius: 28 }}
            >
              <LiquidGlass
                className="flex shrink-0 items-center justify-center rounded-3xl"
                style={{ width: 84, height: 84 }}
              >
                <ClayIcon name={f.icon} className="h-14 w-14" tone="#F6ECDD" />
              </LiquidGlass>
              <div>
                <h3 className="font-display text-xl text-[color:var(--color-slate)]">{f.title}</h3>
                <p className="mt-1 text-sm text-[color:var(--color-slate)]/75">{f.description}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function PerrieOrbitSection() {
  const mounted = useMounted();
  const reducedMotion = useReducedMotion();
  if (!mounted || reducedMotion) return <OrbitStatic />;
  return <OrbitStage />;
}
