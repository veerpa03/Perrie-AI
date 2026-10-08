/**
 * A soft, pastel decorative feather (no feather asset was supplied, so this is
 * a lightweight hand-built SVG in the clay palette). Used sparingly as orbit
 * accents, per the brief — never as a substitute for feature content.
 */
export default function Feather({
  className,
  rotate = 0,
}: {
  className?: string;
  rotate?: number;
}) {
  return (
    <div className={`feather-drift ${className ?? ""}`} style={{ ["--rot" as string]: `${rotate}deg` }}>
      <svg viewBox="0 0 60 150" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="featherG" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E7DEF6" />
            <stop offset="55%" stopColor="#DCD3EF" />
            <stop offset="100%" stopColor="#CDDFF0" />
          </linearGradient>
        </defs>
        <path
          d="M30 4 C12 36 10 86 24 140 C26 146 34 146 36 140 C50 86 48 36 30 4 Z"
          fill="url(#featherG)"
          opacity="0.9"
        />
        <line x1="30" y1="14" x2="30" y2="138" stroke="#fff" strokeWidth="1.6" opacity="0.7" />
        <g stroke="#fff" strokeWidth="1" opacity="0.45">
          <line x1="30" y1="40" x2="18" y2="34" />
          <line x1="30" y1="40" x2="42" y2="34" />
          <line x1="30" y1="66" x2="16" y2="62" />
          <line x1="30" y1="66" x2="44" y2="62" />
          <line x1="30" y1="92" x2="18" y2="90" />
          <line x1="30" y1="92" x2="42" y2="90" />
        </g>
      </svg>
    </div>
  );
}
