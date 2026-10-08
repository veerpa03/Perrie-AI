"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { ORBIT, ORBIT_FEATURES, ORBIT_HEADLINE } from "@/lib/constants";
import PerrieHoverVideo from "./PerrieHoverVideo";
import OrbitFeatureCard from "./OrbitFeatureCard";
import ClayIcon from "./ClayIcons";
import Feather from "./Feather";
import { LiquidGlassControl } from "./ui/liquid-glass";
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

/** The animated, scroll-driven, tilted orbit. */
function OrbitStage() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const birdWrapRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rawProgressRef = useRef(0);
  const rotationRef = useRef(0);
  const geomRef = useRef<Geometry>(ORBIT.geometry.desktop);
  const boundsRef = useRef<{ start: number; end: number }>({ start: 0, end: 1 });
  const activeRef = useRef(0);
  const introStartRef = useRef<number | null>(null);
  const [active, setActive] = useState(0);

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
      const g = geometryFor(window.innerWidth);
      geomRef.current = g;
      // Size + tilt the ring to match the icon ellipse.
      if (ringRef.current) {
        ringRef.current.style.width = `${g.radiusX * 2}px`;
        ringRef.current.style.height = `${g.radiusY * 2}px`;
        ringRef.current.style.transform = `translate(-50%, calc(-50% + ${g.verticalOffset}px)) rotate(${ORBIT.tilt}rad)`;
      }
    };
    measure();
    window.addEventListener("resize", measure);

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

    const cosT = Math.cos(ORBIT.tilt);
    const sinT = Math.sin(ORBIT.tilt);

    let raf: number;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const progress = rawProgressRef.current;
      const g = geomRef.current;

      const target = progress * TWO_PI;
      rotationRef.current += (target - rotationRef.current) * (1 - ORBIT.rotationSmoothing);
      const rotation = rotationRef.current;

      const now2 = performance.now();
      const elapsed = introStartRef.current === null ? 0 : now2 - introStartRef.current;

      for (let i = 0; i < ORBIT_FEATURES.length; i++) {
        const card = cardRefs.current[i];
        if (!card) continue;
        const theta = i * HALF_PI - rotation;
        const depth = Math.cos(theta);
        const norm = (depth + 1) / 2;
        // Ellipse point, then tilt it.
        const ex = Math.sin(theta) * g.radiusX;
        const ey = Math.cos(theta) * g.radiusY;
        const x = ex * cosT - ey * sinT;
        const y = g.verticalOffset + ex * sinT + ey * cosT;
        const scale = ORBIT.scaleBack + (ORBIT.scaleFront - ORBIT.scaleBack) * norm;
        const blur = ORBIT.maxBlurPx * (1 - norm);
        const enter = easeOut((elapsed - 220 - i * 130) / 700);
        const yEnter = (1 - enter) * 40;
        const opacity = (ORBIT.opacityBack + (1 - ORBIT.opacityBack) * norm) * enter;

        card.style.width = `${g.iconSize}px`;
        card.style.height = `${g.iconSize}px`;
        card.style.transform = `translate(-50%, -50%) translate(${x}px, ${y + yEnter}px) scale(${scale})`;
        card.style.opacity = String(opacity);
        card.style.filter = blur > 0.1 ? `blur(${blur}px)` : "none";
        card.style.zIndex = depth >= 0 ? "30" : "10";
      }

      if (birdWrapRef.current) {
        birdWrapRef.current.style.opacity = String(easeOut(elapsed / 650));
      }
      if (ringRef.current) {
        ringRef.current.style.opacity = String(easeOut(elapsed / 800) * 0.9);
      }
      if (hintRef.current) {
        // Fade the scroll hint out as soon as the carousel starts moving.
        hintRef.current.style.opacity = String(easeOut(elapsed / 600) * Math.max(0, 1 - progress * 14));
      }

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
      io.disconnect();
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
        className="clay-canvas relative flex h-[100svh] w-full items-center justify-center overflow-hidden"
      >
        {/* Decorative feathers. */}
        <Feather className="absolute bottom-[12%] left-[7%] z-10 h-24 w-10 opacity-80 sm:h-32 sm:w-12" rotate={-18} />
        <Feather className="absolute bottom-[16%] right-[8%] z-10 h-24 w-10 opacity-80 sm:h-32 sm:w-12" rotate={22} />

        {/* Tilted orbit ring. */}
        <div
          ref={ringRef}
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 z-[1] rounded-[50%] border border-[color:var(--color-slate)]/15"
          style={{ opacity: 0 }}
        />

        {/* Orbiting clay icons (front/back of the bird via dynamic z-index). */}
        {ORBIT_FEATURES.map((f, i) => (
          <OrbitFeatureCard
            key={f.id}
            feature={f}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
          />
        ))}

        {/* Stationary, centred Perrie (the hovering clip). */}
        <div
          ref={birdWrapRef}
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
          style={{ opacity: 0 }}
        >
          <PerrieHoverVideo className="h-[34vh] sm:h-[42vh]" />
        </div>

        {/* Caption + controls + scroll hint. */}
        <div className="absolute inset-x-0 bottom-[5%] z-40 flex flex-col items-center px-6 text-center">
          <h2 className="font-display text-4xl text-[color:var(--color-slate)] sm:text-5xl lg:text-[3.5rem]">
            {ORBIT_HEADLINE}
          </h2>
          <div className="mt-1.5 h-7">
            <AnimatePresence mode="wait">
              <motion.p
                key={feature.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28 }}
                className="text-base text-[color:var(--color-slate)]/70 sm:text-lg"
                aria-hidden="true"
              >
                {feature.label}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <LiquidGlassControl
              size={38}
              aria-label="Previous feature"
              onClick={() => goTo(active - 1)}
              className="pointer-events-auto"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </LiquidGlassControl>

            <div className="flex items-center gap-2">
              {ORBIT_FEATURES.map((f, i) => (
                <button
                  key={f.id}
                  type="button"
                  aria-label={`Show: ${f.label}`}
                  aria-current={i === active ? "true" : undefined}
                  onClick={() => goTo(i)}
                  className="focus-ring pointer-events-auto grid h-6 w-6 place-items-center"
                >
                  <span
                    className="rounded-full bg-[color:var(--color-slate)]/25 transition-all duration-300"
                    style={
                      i === active
                        ? { width: 20, height: 8, background: "var(--color-teal-deep)" }
                        : { width: 8, height: 8 }
                    }
                  />
                </button>
              ))}
            </div>

            <LiquidGlassControl
              size={38}
              aria-label="Next feature"
              onClick={() => goTo(active + 1)}
              className="pointer-events-auto"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </LiquidGlassControl>
          </div>

          <div
            ref={hintRef}
            aria-hidden="true"
            className="mt-5 flex flex-col items-center gap-1 text-[color:var(--color-slate)]/45"
            style={{ opacity: 0 }}
          >
            <span className="text-[0.7rem] font-semibold uppercase tracking-[0.25em]">
              Scroll to explore
            </span>
            <ChevronDown className="h-4 w-4 animate-bounce" />
          </div>
        </div>

        {/* Accessible, stable reading order of all features. */}
        <ul className="sr-only">
          {ORBIT_FEATURES.map((f) => (
            <li key={f.id}>
              {f.label} {f.description}
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
    <section id="features" className="clay-canvas relative overflow-hidden px-6 py-20 sm:py-24" aria-label="What Perrie helps with">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center text-center">
          <PerrieHoverVideo className="h-40 sm:h-52" />
          <h2 className="font-display mt-4 text-4xl text-[color:var(--color-slate)] sm:text-5xl">
            {ORBIT_HEADLINE}
          </h2>
        </div>
        <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {ORBIT_FEATURES.map((f) => (
            <li key={f.id} className="flex items-center gap-5">
              <div className="grid h-24 w-24 shrink-0 place-items-center">
                <ClayIcon name={f.icon} tone={f.accent} className="h-full w-full" />
              </div>
              <div>
                <h3 className="font-display text-2xl text-[color:var(--color-slate)]">{f.label}</h3>
                <p className="mt-1 text-sm text-[color:var(--color-slate)]/70">{f.description}</p>
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
