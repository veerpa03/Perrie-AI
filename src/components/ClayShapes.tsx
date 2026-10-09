/**
 * Decorative floating 3D clay shapes (spheres, pills, rings, soft cubes) in a
 * soft rainbow palette. Each drifts slowly (CSS, paused for reduced motion).
 * Purely decorative: aria-hidden and non-interactive.
 */

type Kind = "sphere" | "pill" | "ring" | "cube";
type Shape = {
  kind: Kind;
  // position (% of the container) and size (px, scaled by --clay-scale)
  x: number;
  y: number;
  size: number;
  hue: keyof typeof HUES;
  rot?: number;
  dur?: number;
  delay?: number;
  blur?: number;
};

const HUES = {
  lilac: ["#F1ECFF", "#C9B8FF", "#9277EA"],
  mint: ["#E6FBF3", "#9DE6CD", "#3FB893"],
  amber: ["#FFF6E0", "#FFD08A", "#EE972C"],
  pink: ["#FFEFF6", "#FFB3D2", "#E45F9A"],
  sky: ["#EEF8FF", "#AEDBFA", "#5BA7DE"],
  coral: ["#FFF0EC", "#FFB3A6", "#EE6F6A"],
} as const;

const PRESETS: Record<"orbit" | "login" | "footer", Shape[]> = {
  orbit: [
    { kind: "sphere", x: 7, y: 18, size: 64, hue: "pink", dur: 9 },
    { kind: "ring", x: 88, y: 14, size: 78, hue: "amber", rot: -20, dur: 11, delay: -3 },
    { kind: "pill", x: 92, y: 74, size: 70, hue: "lilac", rot: 28, dur: 10, delay: -5 },
    { kind: "cube", x: 6, y: 78, size: 46, hue: "mint", rot: 14, dur: 8, delay: -2 },
    { kind: "sphere", x: 20, y: 52, size: 26, hue: "sky", dur: 7, delay: -1, blur: 1 },
    { kind: "sphere", x: 80, y: 44, size: 22, hue: "coral", dur: 8, delay: -4, blur: 1 },
  ],
  login: [
    { kind: "sphere", x: 10, y: 16, size: 120, hue: "lilac", dur: 11 },
    { kind: "ring", x: 86, y: 18, size: 110, hue: "amber", rot: -18, dur: 12, delay: -4 },
    { kind: "pill", x: 88, y: 80, size: 120, hue: "pink", rot: 24, dur: 10, delay: -2 },
    { kind: "cube", x: 12, y: 82, size: 80, hue: "mint", rot: 16, dur: 9, delay: -6 },
    { kind: "sphere", x: 30, y: 60, size: 34, hue: "sky", dur: 7, delay: -3, blur: 1 },
    { kind: "sphere", x: 72, y: 36, size: 30, hue: "coral", dur: 8, delay: -1, blur: 1 },
  ],
  footer: [
    { kind: "sphere", x: 99, y: 6, size: 70, hue: "amber", dur: 9 },
    { kind: "ring", x: 100, y: 104, size: 64, hue: "lilac", rot: 16, dur: 11, delay: -6 },
    { kind: "sphere", x: 52, y: 96, size: 26, hue: "pink", dur: 8, delay: -3 },
  ],
};

function shapeStyle(s: Shape): React.CSSProperties {
  const [light, base, dark] = HUES[s.hue];
  const common: React.CSSProperties = {
    left: `${s.x}%`,
    top: `${s.y}%`,
    ["--rot" as string]: `${s.rot ?? 0}deg`,
    animationDuration: `${s.dur ?? 9}s`,
    animationDelay: `${s.delay ?? 0}s`,
    filter: s.blur ? `blur(${s.blur}px)` : undefined,
  };
  const volume = `radial-gradient(circle at 32% 26%, #ffffff 0%, ${light} 16%, ${base} 55%, ${dark} 100%)`;
  const drop = "0 22px 34px -14px rgba(38,52,69,0.28)";
  switch (s.kind) {
    case "sphere":
      return { ...common, width: s.size, height: s.size, borderRadius: "9999px", background: volume, boxShadow: drop };
    case "pill":
      return {
        ...common,
        width: s.size * 1.9,
        height: s.size * 0.8,
        borderRadius: "9999px",
        background: `linear-gradient(180deg, ${light} 0%, ${base} 48%, ${dark} 100%)`,
        boxShadow: `${drop}, inset 0 6px 10px rgba(255,255,255,0.7), inset 0 -6px 12px rgba(0,0,0,0.12)`,
      };
    case "ring":
      return {
        ...common,
        width: s.size,
        height: s.size,
        borderRadius: "9999px",
        border: `${Math.round(s.size * 0.2)}px solid ${base}`,
        boxShadow: `${drop}, inset 4px 4px 8px rgba(0,0,0,0.12), 3px 3px 0 ${light} inset`,
        background: "transparent",
      };
    case "cube":
      return {
        ...common,
        width: s.size,
        height: s.size,
        borderRadius: `${s.size * 0.32}px`,
        background: `linear-gradient(145deg, ${light} 0%, ${base} 55%, ${dark} 100%)`,
        boxShadow: `${drop}, inset 5px 5px 10px rgba(255,255,255,0.7), inset -5px -5px 12px rgba(0,0,0,0.12)`,
      };
  }
}

export default function ClayShapes({
  preset,
  className,
}: {
  preset: keyof typeof PRESETS;
  className?: string;
}) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}>
      {PRESETS[preset].map((s, i) => (
        <span key={i} className="clay-drift absolute -translate-x-1/2 -translate-y-1/2" style={shapeStyle(s)} />
      ))}
    </div>
  );
}
