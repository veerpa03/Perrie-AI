"use client";

import { useEffect, useRef } from "react";
import { FrameCache, loadManifest } from "@/lib/frameCache";
import { frameIndexFor } from "@/lib/journeyController";
import type { SequenceManifest } from "@/lib/types";
import {
  chapterAt,
  JOURNEY_FOCAL,
  PRIMARY_SEQUENCE,
  type Ambience,
} from "@/lib/constants";

type Focal = { x: number; y: number };

interface Props {
  progressRef: React.MutableRefObject<number>;
  onStageChange?: (ambience: Ambience, speed: number) => void;
  tier: "lg" | "sm";
  className?: string;
  // Cover-fit focal point. A function receives normalized progress so the crop
  // can follow Perrie across frame on narrow screens; defaults to the static
  // desktop focal.
  focal?: Focal | ((progress: number) => Focal);
}

/**
 * Fullscreen Canvas 2D renderer for the flight sequence. The footage fills
 * the entire element edge-to-edge using a COVER fit (scale to fill, crop the
 * overflow) with a left-biased focal point so Perrie — who lives on the
 * left/centre of frame — is protected from the crop on off-ratio viewports.
 * There is no card, border, letterbox, or player chrome: the canvas is the
 * scene.
 *
 * Driven imperatively from a progress ref (0..1) rather than React state so
 * scroll updates never trigger a re-render. A single rAF loop reads the ref,
 * resolves the frame index, and draws. We scrub a single sequence (descent)
 * forwards and backwards for perfectly continuous reversible motion.
 */
export default function JourneyCanvas({
  progressRef,
  onStageChange,
  tier,
  className,
  focal = JOURNEY_FOCAL,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const cacheRef = useRef<FrameCache | null>(null);
  const manifestRef = useRef<SequenceManifest | null>(null);
  const lastDrawnRef = useRef<HTMLImageElement | null>(null);
  const lastProgressForSpeedRef = useRef(0);
  const dprRef = useRef(1);
  const focalRef = useRef<Focal>(typeof focal === "function" ? focal(0) : focal);
  const focalFnRef = useRef(focal);
  focalFnRef.current = focal;

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const manifest = await loadManifest(PRIMARY_SEQUENCE);
      if (cancelled) return;
      manifestRef.current = manifest;
      cacheRef.current = new FrameCache(manifest, tier);

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      dprRef.current = Math.min(2, window.devicePixelRatio || 1);
      const resize = () => {
        const container = containerRef.current;
        if (!container || !canvas) return;
        const rect = container.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(rect.width * dprRef.current));
        canvas.height = Math.max(1, Math.round(rect.height * dprRef.current));
        if (lastDrawnRef.current) draw(lastDrawnRef.current);
      };

      const draw = (img: HTMLImageElement) => {
        const canvasEl = canvasRef.current;
        if (!canvasEl) return;
        const cw = canvasEl.width;
        const ch = canvasEl.height;
        if (cw === 0 || ch === 0) return;
        const iw = img.width;
        const ih = img.height;
        if (iw === 0 || ih === 0) return;
        // COVER fit: scale to fill, anchor on the focal point, crop overflow.
        const scale = Math.max(cw / iw, ch / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (cw - dw) * focalRef.current.x;
        const dy = (ch - dh) * focalRef.current.y;
        // Fill sky first so any sub-pixel seam reads as sky, never black.
        ctx.fillStyle = "#EAF3FA";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, dx, dy, dw, dh);
        lastDrawnRef.current = img;
      };

      resize();
      const resizeObserver = new ResizeObserver(resize);
      if (containerRef.current) resizeObserver.observe(containerRef.current);

      // Draw the first frame as a poster as soon as it decodes.
      const cache = cacheRef.current;
      void cache?.request(0).then((img) => {
        if (!cancelled && img && !lastDrawnRef.current) draw(img);
      });

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        const progress = progressRef.current;
        const mf = manifestRef.current;
        const c = cacheRef.current;
        if (!mf || !c) return;
        const fn = focalFnRef.current;
        focalRef.current = typeof fn === "function" ? fn(progress) : fn;
        const idx = frameIndexFor(PRIMARY_SEQUENCE, progress, mf.count);
        const img = c.getIfReady(idx);
        if (img) {
          draw(img);
        } else {
          void c.request(idx);
          if (lastDrawnRef.current) draw(lastDrawnRef.current);
        }

        const speed = Math.min(1, Math.abs(progress - lastProgressForSpeedRef.current) * 12);
        lastProgressForSpeedRef.current = progress;
        onStageChange?.(chapterAt(progress).ambience, speed);
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
      cacheRef.current?.dispose();
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
