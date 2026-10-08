"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useAudio } from "./AudioProvider";

export default function AudioToggle() {
  const { enabled, toggle } = useAudio();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? "Mute sound" : "Enable sound"}
      title={enabled ? "Mute sound" : "Enable sound"}
      className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-slate)]/15 bg-white/70 text-[color:var(--color-slate)] transition hover:bg-white"
    >
      {enabled ? (
        <Volume2 className="h-4 w-4" aria-hidden="true" />
      ) : (
        <VolumeX className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
}
