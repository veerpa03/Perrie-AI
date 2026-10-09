"use client";

import { useId } from "react";
import type { OrbitIcon } from "@/lib/constants";

/**
 * Chunky 3D clay objects for the four features, in a soft rainbow palette.
 * Each is built like a real clay toy: a darker "thickness" layer offset under
 * the body (extrusion), a body gradient (light top → deeper base), glossy
 * specular blobs, and a soft ground shadow. Hand-built SVG (no clay-object
 * assets were supplied); gradient ids are made unique per instance.
 */

interface Props {
  name: OrbitIcon;
  className?: string;
}

export default function ClayIcon({ name, className }: Props) {
  const uid = useId().replace(/:/g, "");
  const id = (k: string) => `${k}-${uid}`;
  const url = (k: string) => `url(#${id(k)})`;

  return (
    <svg viewBox="0 0 160 172" className={className} role="img" aria-hidden="true">
      <defs>
        <filter id={id("blurS")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        <filter id={id("blurH")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        {/* shared */}
        <linearGradient id={id("cream")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFEFA" />
          <stop offset="1" stopColor="#F1E2CF" />
        </linearGradient>
        <linearGradient id={id("lilac")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D2C4FF" />
          <stop offset="1" stopColor="#9277EA" />
        </linearGradient>
        <linearGradient id={id("mint")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B4F1DD" />
          <stop offset="1" stopColor="#47C29E" />
        </linearGradient>
        <linearGradient id={id("amber")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFE1A3" />
          <stop offset="1" stopColor="#F09A2E" />
        </linearGradient>
        <linearGradient id={id("pink")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFC5DC" />
          <stop offset="1" stopColor="#E9619E" />
        </linearGradient>
        <linearGradient id={id("coral")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFC2B8" />
          <stop offset="1" stopColor="#F2707C" />
        </linearGradient>
        <radialGradient id={id("lens")} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#F4FBFF" />
          <stop offset="0.55" stopColor="#BFE3FA" />
          <stop offset="1" stopColor="#7FBCE8" />
        </radialGradient>
      </defs>

      {/* Ground shadow */}
      <ellipse cx="80" cy="160" rx="48" ry="7" fill="#263445" opacity="0.18" filter={url("blurS")} />

      {name === "calendar" && (
        <g>
          {/* thickness */}
          <rect x="20" y="46" width="120" height="102" rx="28" fill="#D7C2AA" />
          {/* body */}
          <rect x="20" y="38" width="120" height="102" rx="28" fill={url("cream")} />
          {/* header */}
          <path d="M20 66 V62 a28 28 0 0 1 28 -24 H112 a28 28 0 0 1 28 24 V66 Z" fill={url("lilac")} />
          <rect x="20" y="60" width="120" height="14" fill={url("lilac")} />
          <rect x="20" y="72" width="120" height="5" fill="#7B60D6" opacity="0.35" />
          {/* rings */}
          <rect x="46" y="22" width="16" height="32" rx="8" fill="#CDB89F" />
          <rect x="46" y="18" width="16" height="32" rx="8" fill={url("cream")} />
          <rect x="98" y="22" width="16" height="32" rx="8" fill="#CDB89F" />
          <rect x="98" y="18" width="16" height="32" rx="8" fill={url("cream")} />
          {/* day tiles */}
          {[0, 1, 2].map((c) =>
            [0, 1].map((r) => {
              const x = 36 + c * 32;
              const y = 86 + r * 26;
              const special = c === 1 && r === 0 ? "coral" : c === 2 && r === 1 ? "mint" : null;
              return (
                <g key={`${c}-${r}`}>
                  <rect x={x} y={y + 3} width="24" height="19" rx="7" fill={special ? "#C25A68" : "#DCC8B2"} opacity={special ? 0.6 : 1} />
                  <rect x={x} y={y} width="24" height="19" rx="7" fill={special ? url(special) : "#EFE2D2"} />
                </g>
              );
            })
          )}
          {/* gloss */}
          <ellipse cx="50" cy="48" rx="20" ry="8" fill="#fff" opacity="0.75" filter={url("blurH")} />
        </g>
      )}

      {name === "envelope" && (
        <g>
          <rect x="16" y="52" width="128" height="90" rx="24" fill="#2E9E7D" />
          <rect x="16" y="44" width="128" height="90" rx="24" fill={url("mint")} />
          {/* flap with depth */}
          <path d="M28 58 L80 98 L132 58" fill="none" stroke="#2E9E7D" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" transform="translate(0 4)" />
          <path d="M28 58 L80 98 L132 58" fill="none" stroke="#E4FBF3" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          {/* heart seal */}
          <g transform="translate(80 100)">
            <circle r="15" cy="4" fill="#C25A68" opacity="0.55" />
            <circle r="15" fill={url("coral")} />
            <path d="M0 6 C-9 -1 -8 -9 -3 -9 C-1 -9 0 -7 0 -6 C0 -7 1 -9 3 -9 C8 -9 9 -1 0 6 Z" fill="#fff" opacity="0.92" />
          </g>
          <ellipse cx="44" cy="56" rx="22" ry="7" fill="#fff" opacity="0.7" filter={url("blurH")} />
        </g>
      )}

      {name === "search" && (
        <g>
          {/* handle */}
          <g transform="rotate(-45 104 112)">
            <rect x="92" y="96" width="24" height="64" rx="12" fill="#B9447C" />
            <rect x="92" y="90" width="24" height="64" rx="12" fill={url("pink")} />
            <ellipse cx="99" cy="104" rx="4" ry="12" fill="#fff" opacity="0.55" filter={url("blurH")} />
          </g>
          {/* ring */}
          <circle cx="68" cy="76" r="46" fill="#C9781F" />
          <circle cx="68" cy="70" r="46" fill={url("amber")} />
          {/* lens */}
          <circle cx="68" cy="70" r="31" fill="#5E9CC9" opacity="0.5" />
          <circle cx="68" cy="68" r="31" fill={url("lens")} />
          <ellipse cx="56" cy="54" rx="13" ry="7" fill="#fff" opacity="0.85" filter={url("blurH")} transform="rotate(-25 56 54)" />
          <circle cx="82" cy="82" r="4" fill="#fff" opacity="0.6" />
          <ellipse cx="44" cy="40" rx="16" ry="6" fill="#fff" opacity="0.65" filter={url("blurH")} transform="rotate(-30 44 40)" />
        </g>
      )}

      {name === "notebook" && (
        <g>
          {/* rainbow tabs */}
          {[
            { y: 40, g: "mint" },
            { y: 64, g: "amber" },
            { y: 88, g: "lilac" },
          ].map((t) => (
            <g key={t.y}>
              <rect x="112" y={t.y + 3} width="30" height="18" rx="8" fill="#9E8E80" opacity="0.4" />
              <rect x="112" y={t.y} width="30" height="18" rx="8" fill={url(t.g)} />
            </g>
          ))}
          {/* cover */}
          <rect x="28" y="30" width="96" height="120" rx="24" fill="#B9447C" />
          <rect x="28" y="22" width="96" height="120" rx="24" fill={url("pink")} />
          {/* spine */}
          <rect x="28" y="22" width="26" height="120" rx="13" fill="#D2508B" opacity="0.55" />
          {/* spiral */}
          {[36, 58, 80, 102, 124].map((y) => (
            <g key={y}>
              <rect x="20" y={y + 2} width="20" height="9" rx="4.5" fill="#B49C86" />
              <rect x="20" y={y} width="20" height="9" rx="4.5" fill={url("cream")} />
            </g>
          ))}
          {/* label */}
          <rect x="62" y="48" width="50" height="34" rx="10" fill="#C2507F" opacity="0.4" transform="translate(0 3)" />
          <rect x="62" y="48" width="50" height="34" rx="10" fill={url("cream")} />
          <rect x="70" y="57" width="34" height="5" rx="2.5" fill="#C9AFC0" />
          <rect x="70" y="68" width="24" height="5" rx="2.5" fill="#C9AFC0" />
          <ellipse cx="74" cy="32" rx="22" ry="7" fill="#fff" opacity="0.7" filter={url("blurH")} />
        </g>
      )}
    </svg>
  );
}
