"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Liquid glass material.
 *
 * NOTE ON SOURCING: `npx uilayouts add liquid-glass` could not run in this
 * environment — its registry host (ui-layouts.com) is blocked by the egress
 * proxy and the CLI is interactive. This is a real, compatible implementation
 * of the material (not just a CSS class name): a translucent, backdrop-blurred,
 * saturated surface with specular edges, a moving highlight on interaction, an
 * optional SVG turbulence/displacement refraction layer, and a graceful solid
 * fallback where backdrop-filter is unsupported. Core glass styling lives in
 * app/globals.css (.liquid-glass); the refraction filter is defined here.
 */

/** Renders the shared SVG refraction filter once. Mount near the app root. */
export function LiquidGlassDefs() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, pointerEvents: "none" }}
    >
      <defs>
        <filter id="lg-refract" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.012 0.016"
            numOctaves="2"
            seed="7"
            result="noise"
          />
          <feGaussianBlur in="noise" stdDeviation="1.4" result="blurred" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="blurred"
            scale="14"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}

interface LiquidGlassProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Add a faint refractive texture overlay (uses the #lg-refract filter). */
  refract?: boolean;
}

/** A translucent liquid-glass surface. */
export function LiquidGlass({ className, children, refract = false, ...rest }: LiquidGlassProps) {
  return (
    <div className={cn("liquid-glass", className)} {...rest}>
      {refract && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[0.18]"
          style={{
            filter: "url(#lg-refract)",
            background:
              "repeating-linear-gradient(115deg, rgba(255,255,255,0.5) 0 2px, transparent 2px 10px)",
          }}
        />
      )}
      {children}
    </div>
  );
}

interface LiquidGlassControlProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** Visual size in px (square). */
  size?: number;
}

/** A small tactile glass control (carousel arrows, pagination dots, sound). */
export function LiquidGlassControl({
  className,
  children,
  active = false,
  size = 44,
  style,
  ...rest
}: LiquidGlassControlProps) {
  return (
    <button
      type="button"
      className={cn(
        "liquid-glass focus-ring relative flex items-center justify-center rounded-full text-[color:var(--color-slate)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-95",
        active && "ring-2 ring-[color:var(--color-teal-deep)]/60",
        className
      )}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}
