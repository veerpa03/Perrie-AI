"use client";

import { useEffect, useRef } from "react";
import { FrameCache, loadManifest } from "@/lib/frameCache";
import { JourneyController, frameIndexFor } from "@/lib/journeyController";
import type { SequenceManifest, SequenceName } from "@/lib/types";
import type { StageId } from "@/lib/constants";
import { stageAt } from "@/lib/constants";

export interface JourneyCanvasHandle {
  setProgress: (p: number) => void;
}

interface Props {
  progressRef: React.MutableRefObject<number>;
  onStageChange?: (stage: StageId, sequence: SequenceName, speed: number) => void;
  tier: "lg" | "sm";
  className?: string;
}

/**
 * Sticky Canvas 2D renderer for the ascent/descent frame sequence. Driven
 * imperatively from a progress ref (0..1) rather than React state so scroll
 * updates never trigger a re-render — a single rAF loop reads the ref,
 * resolves the active sequence + frame via JourneyController, and draws.
 */
export default function JourneyCanvas({ progressRef, onStageChange, tier, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const controllerRef = useRef(new JourneyController());
  const cachesRef = useRef<Partial<Record<SequenceName, FrameCache>>>({});
  const manifestsRef = useRef<Partial<Record<SequenceName, SequenceManifest>>>({});
  const lastDrawnRef = useRef<HTMLImageElement | null>(null);
  const lastProgressForSpeedRef = useRef(0);
  const dprRef = useRef(1);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const [descentManifest, ascentManifest] = await Promise.all([
        loadManifest("descent"),
        loadManifest("ascent"),
      ]);
      if (cancelled) return;
      manifestsRef.current.descent = descentManifest;
      manifestsRef.current.ascent = ascentManifest;
      cachesRef.current.descent = new FrameCache(descentManifest, tier);
      cachesRef.current.ascent = new FrameCache(ascentManifest, tier);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      dprRef.current = Math.min(2, window.devicePixelRatio || 1);
      const resize = () => {
        const container = containerRef.current;
        if (!container || !canvas) return;
        const rect = container.getBoundingClientRect();
        canvas.width = Math.round(rect.width * dprRef.current);
        canvas.height = Math.round(rect.height * dprRef.current);
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      if (containerRef.current) resizeObserver.observe(containerRef.current);

      const draw = (img: HTMLImageElement) => {
        const canvasEl = canvasRef.current;
        if (!canvasEl) return;
        const cw = canvasEl.width;
        const ch = canvasEl.height;
        if (cw === 0 || ch === 0) return;
        ctx.clearRect(0, 0, cw, ch);
        const imgAspect = img.width / img.height;
        const canvasAspect = cw / ch;
        let dw: number, dh: number, dx: number, dy: number;
        if (imgAspect > canvasAspect) {
          dh = ch;
          dw = ch * imgAspect;
          dx = (cw - dw) / 2;
          dy = 0;
        } else {
          dw = cw;
          dh = cw / imgAspect;
          dx = 0;
          dy = (ch - dh) / 2;
        }
        // Soft sky-tinted letterbox instead of black bars.
        ctx.fillStyle = "#EAF3FA";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, dx, dy, dw, dh);
        lastDrawnRef.current = img;
      };

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        const progress = progressRef.current;
        const sequence = controllerRef.current.update(progress);
        const manifest = manifestsRef.current[sequence];
        const cache = cachesRef.current[sequence];
        if (!manifest || !cache) return;
        const idx = frameIndexFor(sequence, progress, manifest.count);
        const img = cache.getIfReady(idx);
        if (img) {
          draw(img);
        } else {
          void cache.request(idx);
          // Keep last valid frame on screen; never flash empty canvas.
          if (lastDrawnRef.current) draw(lastDrawnRef.current);
        }

        const speed = Math.min(1, Math.abs(progress - lastProgressForSpeedRef.current) * 12);
        lastProgressForSpeedRef.current = progress;
        onStageChange?.(stageAt(progress), sequence, speed);
      };
      tick();

      return () => {
        resizeObserver.disconnect();
      };
    }

    const cleanupPromise = setup();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps -- cachesRef is never reassigned, only mutated
      const caches = cachesRef.current;
      caches.descent?.dispose();
      caches.ascent?.dispose();
      void cleanupPromise.then((fn) => fn?.());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
    </div>
  );
}
