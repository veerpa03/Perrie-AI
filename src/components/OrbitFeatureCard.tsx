"use client";

import { forwardRef } from "react";
import ClayIcon from "./ClayIcons";
import { LiquidGlass } from "./ui/liquid-glass";
import type { ORBIT_FEATURES } from "@/lib/constants";

type Feature = (typeof ORBIT_FEATURES)[number];

/**
 * A single orbiting feature card: a soft clay outer form with a liquid-glass
 * inset face holding a clay illustration and a short Anton title. Purely
 * presentational — PerrieOrbitSection sets this card's transform / opacity /
 * blur / width / z-index imperatively every frame from the one authoritative
 * rotation value, so there is no competing animation on the same transform.
 * Marked aria-hidden; the readable content lives in the synchronized caption
 * and the sr-only feature list.
 */
const OrbitFeatureCard = forwardRef<HTMLDivElement, { feature: Feature }>(
  function OrbitFeatureCard({ feature }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className="absolute left-1/2 top-1/2"
        style={{ willChange: "transform, opacity, filter" }}
      >
        {/* Icon-only: the active feature's words live in the synchronized
            caption, so rotated cards never become competing text. */}
        <div
          className="clay flex items-center justify-center p-5"
          style={{ background: feature.accent, borderRadius: 32 }}
        >
          <LiquidGlass
            refract
            className="flex items-center justify-center rounded-[26px]"
            style={{ width: 110, height: 110 }}
          >
            <ClayIcon name={feature.icon} className="h-[76px] w-[76px]" tone="#F6ECDD" />
          </LiquidGlass>
        </div>
      </div>
    );
  }
);

export default OrbitFeatureCard;
