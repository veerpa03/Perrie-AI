"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useAudio } from "./AudioProvider";
import { LiquidGlassControl } from "./ui/liquid-glass";

/**
 * The audio feature is preserved from the cinematic section, but the navbar
 * that used to hold its toggle is gone. This is a single small glass control
 * in the lower-left — not a header or a row of links — so sound stays
 * controllable without reintroducing chrome at the top.
 */
export default function FloatingSoundToggle() {
  const { enabled, toggle } = useAudio();
  return (
    <div className="fixed bottom-4 left-4 z-50 sm:bottom-6 sm:left-6">
      <LiquidGlassControl
        size={40}
        onClick={toggle}
        aria-pressed={enabled}
        aria-label={enabled ? "Mute sound" : "Enable sound"}
        title={enabled ? "Mute sound" : "Enable sound"}
      >
        {enabled ? (
          <Volume2 className="h-4 w-4" aria-hidden="true" />
        ) : (
          <VolumeX className="h-4 w-4" aria-hidden="true" />
        )}
      </LiquidGlassControl>
    </div>
  );
}
