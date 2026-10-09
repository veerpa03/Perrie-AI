"use client";

import { useEffect, useRef } from "react";

/**
 * Animated hand-off from the tree landing into the carousel: three layers of
 * soft pastel clay clouds rise from the bottom one after another (lilac, then
 * mint, then cream), while the flight scene behind softly blurs. The last
 * cream layer ends exactly when the transition ends, filling the screen with
 * the carousel's own background colour so the next section continues without
 * a seam. Fully scroll-driven via `tRef` (0..1), therefore reversible.
 * Decorative (aria-hidden).
 */

type Layer = {
  color: string; // body colour (also the bottom of every dome -> no seam)
  hi: string; // dome highlight colour
  start: number; // t at which this layer starts rising
  end: number; // t at which it fully covers the screen
  domes: { x: number; d: number }[]; // x in %, diameter in vw
};

const LAYERS: Layer[] = [
  {
    color: "#E2D5F6",
    hi: "#F8F3FF",
    start: 0,
    end: 0.9,
    domes: [
      { x: -2, d: 15 }, { x: 9, d: 12 }, { x: 19, d: 16 }, { x: 31, d: 13 }, { x: 42, d: 17 },
      { x: 54, d: 12 }, { x: 65, d: 16 }, { x: 77, d: 13 }, { x: 88, d: 17 }, { x: 101, d: 14 },
    ],
  },
  {
    color: "#D2EDE2",
    hi: "#F1FBF6",
    start: 0.12,
    end: 0.95,
    domes: [
      { x: 3, d: 14 }, { x: 14, d: 17 }, { x: 26, d: 12 }, { x: 37, d: 16 }, { x: 49, d: 13 },
      { x: 60, d: 17 }, { x: 72, d: 12 }, { x: 83, d: 16 }, { x: 95, d: 14 },
    ],
  },
  {
    color: "#FBF8F3",
    hi: "#FFFFFF",
    start: 0.24,
    end: 1,
    domes: [
      { x: -1, d: 16 }, { x: 11, d: 13 }, { x: 22, d: 17 }, { x: 34, d: 12 }, { x: 46, d: 16 },
      { x: 57, d: 13 }, { x: 69, d: 17 }, { x: 81, d: 12 }, { x: 92, d: 16 }, { x: 103, d: 13 },
    ],
  },
];

const MAX_DOME_RADIUS_VW = 9;
// Ease-in: the clouds start low and slow (the tree stays visible for the first
// part of the transition), then gather pace to cover the screen.
const smooth = (v: number) => Math.pow(Math.min(1, Math.max(0, v)), 1.6);

export default function CloudCurtain({ tRef }: { tRef: React.MutableRefObject<number> }) {
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let last = -1;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const t = tRef.current;
      if (t === last) return;
      last = t;
      if (rootRef.current) rootRef.current.style.visibility = t > 0.001 ? "visible" : "hidden";
      LAYERS.forEach((layer, i) => {
        const el = layerRefs.current[i];
        if (!el) return;
        const e = smooth((t - layer.start) / (layer.end - layer.start));
        // From just below the viewport to fully covering it (domes above).
        el.style.transform = `translate3d(0, calc(${((1 - e) * 100).toFixed(3)}vh + ${((1 - e) * MAX_DOME_RADIUS_VW).toFixed(3)}vw - ${(e * (MAX_DOME_RADIUS_VW + 1)).toFixed(3)}vw), 0)`;
      });
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [tRef]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-30 overflow-hidden"
      style={{ visibility: "hidden" }}
    >
      {LAYERS.map((layer, i) => (
        <div
          key={i}
          ref={(el) => {
            layerRefs.current[i] = el;
          }}
          className="absolute inset-x-0 top-0 will-change-transform"
          style={{
            height: `calc(100vh + ${MAX_DOME_RADIUS_VW * 2 + 2}vw)`,
            transform: "translate3d(0, 120vh, 0)",
            filter: "drop-shadow(0 -8px 18px rgba(38,52,69,0.10))",
          }}
        >
          {layer.domes.map((b, k) => (
            <span
              key={k}
              className="absolute rounded-full"
              style={{
                left: `${b.x}%`,
                top: 0,
                width: `${b.d}vw`,
                height: `${b.d}vw`,
                transform: "translate(-50%, -50%)",
                // Lit from the top-left; the lower half is exactly the body
                // colour, so dome and body meet without a seam.
                background: `radial-gradient(26% 18% at 38% 22%, rgba(255,255,255,0.85), rgba(255,255,255,0) 100%), linear-gradient(180deg, ${layer.hi} 0%, ${layer.color} 44%)`,
              }}
            />
          ))}
          <div className="absolute inset-x-0 bottom-0 top-0" style={{ background: layer.color }} />
        </div>
      ))}
    </div>
  );
}
