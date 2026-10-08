import type { OrbitIcon } from "@/lib/constants";

/**
 * Clay-style SVG illustrations for the feature cards. The supplied feather /
 * egg / clay-object assets were not present in the project, so these are
 * hand-built soft, rounded, voluminous shapes in the claymorphism aesthetic
 * (matte fills + broad top-left highlight + soft drop shadow) rather than thin
 * line icons.
 */

interface Props {
  name: OrbitIcon;
  className?: string;
  tone?: string; // base clay tone for the object
}

const TEAL = "#226D68";
const SLATE = "#2F3E50";

export default function ClayIcon({ name, className, tone = "#F3E7D6" }: Props) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-hidden="true">
      <defs>
        <radialGradient id={`clayHi-${name}`} cx="34%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.08" />
        </radialGradient>
        <filter id={`claySoft-${name}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#263445" floodOpacity="0.18" />
        </filter>
      </defs>

      <g filter={`url(#claySoft-${name})`}>
        {name === "calendar" && (
          <>
            <rect x="20" y="26" width="80" height="74" rx="20" fill={tone} />
            <rect x="20" y="26" width="80" height="26" rx="20" fill={TEAL} opacity="0.9" />
            <rect x="20" y="40" width="80" height="12" fill={TEAL} opacity="0.9" />
            <rect x="34" y="18" width="10" height="20" rx="5" fill={SLATE} />
            <rect x="76" y="18" width="10" height="20" rx="5" fill={SLATE} />
            <g fill={SLATE} opacity="0.75">
              <rect x="33" y="62" width="14" height="12" rx="4" />
              <rect x="53" y="62" width="14" height="12" rx="4" />
              <rect x="73" y="62" width="14" height="12" rx="4" />
              <rect x="33" y="80" width="14" height="12" rx="4" />
              <rect x="53" y="80" width="14" height="12" rx="4" fill={TEAL} />
            </g>
          </>
        )}

        {name === "envelope" && (
          <>
            <rect x="16" y="32" width="88" height="60" rx="18" fill={tone} />
            <path
              d="M20 40 L60 70 L100 40"
              fill="none"
              stroke={TEAL}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
            <circle cx="92" cy="40" r="13" fill="#F1A6A0" />
            <circle cx="92" cy="40" r="5" fill="#fff" opacity="0.8" />
          </>
        )}

        {name === "search" && (
          <>
            <circle cx="52" cy="52" r="30" fill={tone} />
            <circle cx="52" cy="52" r="16" fill={TEAL} opacity="0.85" />
            <circle cx="46" cy="46" r="6" fill="#fff" opacity="0.8" />
            <rect
              x="70"
              y="70"
              width="34"
              height="16"
              rx="8"
              fill={SLATE}
              transform="rotate(45 70 70)"
            />
          </>
        )}

        {name === "notebook" && (
          <>
            <rect x="26" y="20" width="72" height="80" rx="18" fill={tone} />
            <rect x="26" y="20" width="18" height="80" rx="9" fill={TEAL} opacity="0.9" />
            <g stroke={SLATE} strokeWidth="6" strokeLinecap="round" opacity="0.6">
              <line x1="54" y1="40" x2="86" y2="40" />
              <line x1="54" y1="56" x2="86" y2="56" />
              <line x1="54" y1="72" x2="74" y2="72" />
            </g>
            <circle cx="35" cy="36" r="4" fill="#fff" opacity="0.9" />
            <circle cx="35" cy="60" r="4" fill="#fff" opacity="0.9" />
            <circle cx="35" cy="84" r="4" fill="#fff" opacity="0.9" />
          </>
        )}

        {/* Clay volume highlight overlay. */}
        <rect x="14" y="14" width="92" height="92" rx="26" fill={`url(#clayHi-${name})`} />
      </g>
    </svg>
  );
}
