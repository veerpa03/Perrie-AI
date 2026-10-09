"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ORBIT, ORBIT_FEATURES, ORBIT_HEADLINE, type OrbitFeature } from "@/lib/constants";
import OrbitFeatureCard from "./OrbitFeatureCard";
import FeaturePopup from "./FeaturePopup";
import ClayIcon from "./ClayIcons";
import ClayShapes from "./ClayShapes";
import Feather from "./Feather";
import { useDemoModal } from "./DemoModal";
import { useMounted } from "@/hooks/useMounted";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const HALF_PI = Math.PI / 2;
const TWO_PI = Math.PI * 2;
const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

type Geometry = (typeof ORBIT.geometry)[keyof typeof ORBIT.geometry];

function geometryFor(width: number): Geometry {
  if (width < 640) return ORBIT.geometry.mobile;
  if (width < 1024) return ORBIT.geometry.tablet;
  return ORBIT.geometry.desktop;
}

/** Shared open/close/demo behaviour for the feature pop-up card. */
function useFeatureCard() {
  const { open: openDemo } = useDemoModal();
  const [openFeature, setOpenFeature] = useState<OrbitFeature | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const openCard = useCallback((feature: OrbitFeature, opener: HTMLElement | null) => {
    openerRef.current = opener;
    setOpenFeature(feature);
  }, []);

  const closeCard = useCallback(() => {
    setOpenFeature(null);
    // Return focus to the clay object that opened the card.
    requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  const tryDemo = useCallback(
    (feature: OrbitFeature) => {
      setOpenFeature(null);
      openerRef.current?.focus();
      openDemo(feature.demoId);
    },
    [openDemo]
  );

  return { openFeature, openCard, closeCard, tryDemo };
}

/** The animated carousel: turns on its own around the centred headline. */
function OrbitStage() {
  const sectionRef = useRef<HTMLElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rotationRef = useRef(0);
  const targetRotRef = useRef<number | null>(null);
  const holdUntilRef = useRef(0);
  const hoveredRef = useRef<number | null>(null);
  const hoverAmtRef = useRef<number[]>(ORBIT_FEATURES.map(() => 0));
  const visibleRef = useRef(false);
  const introStartRef = useRef<number | null>(null);
  const geomRef = useRef<Geometry>(ORBIT.geometry.desktop);
  const activeRef = useRef(0);
  const cardOpenRef = useRef(false);
  const [active, setActive] = useState(0);
  const { openFeature, openCard, closeCard, tryDemo } = useFeatureCard();
  cardOpenRef.current = openFeature !== null;

  /** Rotate (shortest way) until feature `i` is at the front, then hold there. */
  const goTo = (i: number) => {
    const current = rotationRef.current;
    const desired = i * HALF_PI;
    let delta = (desired - current) % TWO_PI;
    if (delta > Math.PI) delta -= TWO_PI;
    if (delta < -Math.PI) delta += TWO_PI;
    targetRotRef.current = current + delta;
  };

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const measure = () => {
      const g = geometryFor(window.innerWidth);
      geomRef.current = g;
      const ring = ringRef.current;
      if (ring) {
        ring.style.width = `${g.radiusX * 2}px`;
        ring.style.height = `${g.radiusY * 2}px`;
        ring.style.transform = `translate(-50%, calc(-50% + ${g.verticalOffset}px)) rotate(${ORBIT.tilt}rad)`;
      }
    };
    measure();
    window.addEventListener("resize", measure);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visibleRef.current = e.isIntersecting;
          if (e.isIntersecting && introStartRef.current === null) introStartRef.current = performance.now();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(section);

    const cosT = Math.cos(ORBIT.tilt);
    const sinT = Math.sin(ORBIT.tilt);
    const speed = TWO_PI / ORBIT.secondsPerTurn; // rad / s
    let last = performance.now();
    let raf = 0;

    const loop = () => {
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(64, now - last) / 1000;
      last = now;
      if (!visibleRef.current || document.hidden) return; // nothing to draw off-screen

      // One authoritative rotation value.
      const target = targetRotRef.current;
      if (target !== null) {
        rotationRef.current += (target - rotationRef.current) * 0.12;
        if (Math.abs(target - rotationRef.current) < 0.002) {
          rotationRef.current = target;
          targetRotRef.current = null;
          holdUntilRef.current = now + ORBIT.resumeAfterMs;
        }
      } else {
        const paused = hoveredRef.current !== null || cardOpenRef.current || now < holdUntilRef.current;
        if (!paused) rotationRef.current += speed * dt;
      }
      const rotation = rotationRef.current;

      const g = geomRef.current;
      const elapsed = introStartRef.current === null ? 0 : now - introStartRef.current;
      if (ringRef.current) ringRef.current.style.opacity = String(easeOut(elapsed / 900));

      for (let i = 0; i < ORBIT_FEATURES.length; i++) {
        const card = cardRefs.current[i];
        if (!card) continue;
        const theta = i * HALF_PI - rotation;
        const depth = Math.cos(theta);
        const norm = (depth + 1) / 2;
        const ex = Math.sin(theta) * g.radiusX;
        const ey = Math.cos(theta) * g.radiusY;
        const x = ex * cosT - ey * sinT;
        const y = g.verticalOffset + ex * sinT + ey * cosT;

        const h = hoverAmtRef.current;
        h[i] += ((hoveredRef.current === i ? 1 : 0) - h[i]) * 0.2;
        const scale =
          (ORBIT.scaleBack + (ORBIT.scaleFront - ORBIT.scaleBack) * norm) * (1 + (ORBIT.hoverScale - 1) * h[i]);
        const blur = ORBIT.maxBlurPx * (1 - norm) * (1 - h[i]);
        const enter = easeOut((elapsed - 200 - i * 140) / 700);
        const yEnter = (1 - enter) * 44;
        const opacity = (ORBIT.opacityBack + (1 - ORBIT.opacityBack) * norm) * enter;

        card.style.width = `${g.iconSize}px`;
        card.style.height = `${g.iconSize}px`;
        card.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${(y + yEnter).toFixed(1)}px) scale(${scale.toFixed(3)})`;
        card.style.opacity = String(opacity);
        card.style.filter = blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : "none";
        // Back half sits behind the headline; front half in front of it.
        card.style.zIndex = depth >= 0 ? "30" : "10";
      }

      const front =
        ((Math.round(rotation / HALF_PI) % ORBIT_FEATURES.length) + ORBIT_FEATURES.length) %
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
    };
  }, []);

  const feature = ORBIT_FEATURES[active];

  return (
    <section
      ref={sectionRef}
      id="features"
      className="clay-canvas relative flex min-h-[100svh] w-full items-center justify-center overflow-hidden"
      aria-label="What Perrie helps with"
    >
      {/* Seamless hand-off from the cream cloud curtain above. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-[22vh]"
        style={{ background: "linear-gradient(#FBF8F3, rgba(251,248,243,0))" }}
      />

      <ClayShapes preset="orbit" className="z-0" />
      <Feather className="absolute bottom-[9%] left-[16%] z-[2] h-20 w-9 opacity-80 sm:h-28 sm:w-11" rotate={-18} />
      <Feather className="absolute right-[15%] top-[16%] z-[2] h-20 w-9 opacity-80 sm:h-28 sm:w-11" rotate={24} />

      {/* Tilted rainbow orbit ring. */}
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 z-[3]"
        style={{ opacity: 0 }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id="orbitRainbow" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#9277EA" />
              <stop offset="0.25" stopColor="#EC6FA6" />
              <stop offset="0.5" stopColor="#F0A23A" />
              <stop offset="0.75" stopColor="#3FBF9B" />
              <stop offset="1" stopColor="#5BA7DE" />
            </linearGradient>
          </defs>
          <ellipse
            cx="50"
            cy="50"
            rx="49.6"
            ry="49.2"
            fill="none"
            stroke="url(#orbitRainbow)"
            strokeWidth="2.2"
            strokeDasharray="1 7"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            opacity="0.6"
          />
        </svg>
      </div>

      {/* Centred headline — the clay objects orbit all around it. */}
      <div className="pointer-events-none relative z-20 flex flex-col items-center px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="font-display text-[1.95rem] leading-[1.05] text-[color:var(--color-slate)] sm:text-5xl lg:text-[4rem]"
        >
          {ORBIT_HEADLINE[0]}
          <br />
          <span className="rainbow-text">{ORBIT_HEADLINE[1]}</span>
        </motion.h2>
        <div className="mt-3 h-7">
          <AnimatePresence mode="wait">
            <motion.p
              key={feature.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28 }}
              className="text-base font-semibold sm:text-lg"
              style={{ color: feature.color }}
              aria-hidden="true"
            >
              {feature.label}
            </motion.p>
          </AnimatePresence>
        </div>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-slate)]/45">
          Tap an icon to learn more
        </p>
      </div>

      {/* The four clay objects (buttons). */}
      {ORBIT_FEATURES.map((f, i) => (
        <OrbitFeatureCard
          key={f.id}
          feature={f}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          onOpen={() => openCard(f, cardRefs.current[i])}
          onHoverChange={(h) => {
            if (h) hoveredRef.current = i;
            else if (hoveredRef.current === i) hoveredRef.current = null;
          }}
        />
      ))}

      {/* Pagination dots (no arrows). */}
      <div className="absolute inset-x-0 bottom-[5%] z-40 flex justify-center gap-2">
        {ORBIT_FEATURES.map((f, i) => (
          <button
            key={f.id}
            type="button"
            aria-label={`Bring to front: ${f.label.replace(/\.$/, "")}`}
            aria-current={i === active ? "true" : undefined}
            onClick={() => goTo(i)}
            className="focus-ring grid h-7 w-7 place-items-center rounded-full"
          >
            <span
              className="rounded-full transition-all duration-300"
              style={
                i === active
                  ? { width: 24, height: 9, background: f.color, boxShadow: `0 4px 10px -3px ${f.color}` }
                  : { width: 9, height: 9, background: "rgba(38,52,69,0.22)" }
              }
            />
          </button>
        ))}
      </div>

      <ul className="sr-only">
        {ORBIT_FEATURES.map((f) => (
          <li key={f.id}>
            {f.label} {f.description}
          </li>
        ))}
      </ul>

      <FeaturePopup feature={openFeature} onClose={closeCard} onTryDemo={tryDemo} />
    </section>
  );
}

/** Static, reduced-motion / SSR-safe variant: readable clay grid (still clickable). */
function OrbitStatic() {
  const { openFeature, openCard, closeCard, tryDemo } = useFeatureCard();
  return (
    <section
      id="features"
      className="clay-canvas relative overflow-hidden px-6 py-20 sm:py-24"
      aria-label="What Perrie helps with"
    >
      <ClayShapes preset="orbit" className="z-0 opacity-70" />
      <div className="relative z-10 mx-auto max-w-5xl">
        <h2 className="font-display text-center text-4xl leading-[1.05] text-[color:var(--color-slate)] sm:text-5xl">
          {ORBIT_HEADLINE[0]}
          <br />
          <span className="rainbow-text">{ORBIT_HEADLINE[1]}</span>
        </h2>
        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2">
          {ORBIT_FEATURES.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={(e) => openCard(f, e.currentTarget)}
                className="focus-ring flex w-full items-center gap-5 rounded-[28px] p-5 text-left transition hover:-translate-y-0.5"
                style={{
                  background: f.glow,
                  boxShadow:
                    "10px 14px 28px -14px rgba(38,52,69,0.3), inset -6px -6px 14px rgba(38,52,69,0.07), inset 7px 7px 16px rgba(255,255,255,0.85)",
                }}
              >
                <span className="grid h-20 w-20 shrink-0 place-items-center">
                  <ClayIcon name={f.icon} className="h-full w-full" />
                </span>
                <span>
                  <span className="font-display block text-2xl text-[color:var(--color-slate)]">{f.label}</span>
                  <span className="mt-1 block text-sm text-[color:var(--color-slate)]/70">{f.description}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <FeaturePopup feature={openFeature} onClose={closeCard} onTryDemo={tryDemo} />
    </section>
  );
}

export default function PerrieOrbitSection() {
  const mounted = useMounted();
  const reducedMotion = useReducedMotion();
  if (!mounted || reducedMotion) return <OrbitStatic />;
  return <OrbitStage />;
}
