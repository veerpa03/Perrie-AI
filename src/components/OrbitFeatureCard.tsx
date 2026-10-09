"use client";

import { forwardRef } from "react";
import ClayIcon from "./ClayIcons";
import type { OrbitFeature } from "@/lib/constants";

interface Props {
  feature: OrbitFeature;
  onOpen: () => void;
  onHoverChange: (hovered: boolean) => void;
}

/**
 * One orbiting feature: a chunky floating 3D clay object that is also a real
 * button — click (or Enter / Space) opens its gist card; hover or keyboard
 * focus pauses the carousel so it is easy to hit. PerrieOrbitSection sets this
 * element's size / transform / opacity / blur / z-index every frame from the
 * one authoritative rotation value, so nothing else animates its transform.
 */
const OrbitFeatureCard = forwardRef<HTMLButtonElement, Props>(function OrbitFeatureCard(
  { feature, onOpen, onHoverChange },
  ref
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
      onFocus={() => onHoverChange(true)}
      onBlur={() => onHoverChange(false)}
      aria-label={`Learn about: ${feature.label.replace(/\.$/, "")}`}
      aria-haspopup="dialog"
      className="focus-ring absolute left-1/2 top-1/2 grid cursor-pointer place-items-center rounded-[32px]"
      style={{ willChange: "transform, opacity, filter" }}
    >
      <ClayIcon name={feature.icon} className="pointer-events-none h-full w-full" />
    </button>
  );
});

export default OrbitFeatureCard;
