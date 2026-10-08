"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AudioController } from "@/lib/audioController";
import type { Ambience } from "@/lib/constants";

interface AudioContextValue {
  enabled: boolean;
  toggle: () => void;
  reportJourneyState: (ambience: Ambience, speed: number) => void;
}

const Ctx = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: React.ReactNode }) {
  const controllerRef = useRef<AudioController | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    controllerRef.current = new AudioController();
    const onVisibility = () => {
      controllerRef.current?.onVisibilityChange(document.hidden);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      controllerRef.current?.dispose();
    };
  }, []);

  const value = useMemo<AudioContextValue>(
    () => ({
      enabled,
      toggle: () =>
        setEnabled((prev) => {
          const next = !prev;
          controllerRef.current?.setEnabled(next);
          return next;
        }),
      reportJourneyState: (ambience, speed) => {
        controllerRef.current?.update(ambience, speed);
      },
    }),
    [enabled]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAudio() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}
