"use client";

import { forwardRef } from "react";
import ClayIcon from "./ClayIcons";
import type { ORBIT_FEATURES } from "@/lib/constants";

type Feature = (typeof ORBIT_FEATURES)[number];

/**
 * A single orbiting feature: a standalone floating clay object (no card/tile),
 * like the reference. Purely presentational — PerrieOrbitSection sets this
 * element's size / transform / opacity / blur / z-index imperatively every
 * frame from the one authoritative rotation value. Marked aria-hidden; the
 * readable content lives in the synchronized caption and the sr-only list.
 */
const OrbitFeatureCard = forwardRef<HTMLDivElement, { feature: Feature }>(
  function OrbitFeatureCard({ feature }, ref) {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 grid place-items-center"
        style={{ willChange: "transform, opacity, filter" }}
      >
        <ClayIcon name={feature.icon} tone={feature.accent} className="h-full w-full" />
      </div>
    );
  }
);

export default OrbitFeatureCard;
