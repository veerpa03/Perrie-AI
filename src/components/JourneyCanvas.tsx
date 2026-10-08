"use client";

import { useEffect, useRef } from "react";
import { FrameCache, loadManifest } from "@/lib/frameCache";
import { frameIndexFor } from "@/lib/journeyController";
import type { SequenceManifest } from "@/lib/types";
import { JOURNEY_FOCAL, PRIMARY_SEQUENCE } from "@/lib/constants";

type Focal = { x: number; y: number };

interface Props {
  // Normalized FRAME progress (0..1 over the whole sequence) — drives which
  // frame is drawn. The fly-in and the scroll both feed this ref.
  progressRef: React.MutableRefObject<number>;
  tier: "lg" | "sm";
  className?: string;
  // Cover-fit focal point. A function receives the current frame progress so
  // the crop can follow Perrie across frame on narrow screens; defaults to the
  // static desktop focal.
  focal?: Focal | ((progress: number) => Focal);
  // How many leading frames to eagerly prewarm so the opening fly-in is smooth.
  prewarm?: number;
}

/**
 * Fullscreen Canvas 2D renderer for the flight sequence. The footage fills the
 * entire element edge-to-edge using a COVER fit (scale to fill, crop the
 * overflow) with a focal point so Perrie is protected from the crop on
 * off-ratio viewports. No card, border, letterbox, or player chrome — the
 * canvas is the scene.
 *
 * Driven imperatively from a frame-progress ref (0..1) via a single rAF loop;
 * scroll/intro updates never trigger a re-render. A single sequence (descent)
 * is scrubbed forwards and backwards for perfectly continuous motion.
 */
export default function JourneyCanvas({
  progressRef,
  tier,
  className,
  focal = JOURNEY_FOCAL,
  prewarm = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const cacheRef = useRef<FrameCache | null>(null);
  const manifestRef = useRef<SequenceManifest | null>(null);
  const lastDrawnRef = useRef<HTMLImageElement | null>(null);
  const dprRef = useRef(1);
  const focalRef = useRef<Focal>(typeof focal === "function" ? focal(0) : focal);
  const focalFnRef = useRef(focal);
  focalFnRef.current = focal;
  // Dirty-check + visibility gating so an idle, on-screen scene does no work
  // and an off-screen scene does none at all.
  const lastShownIdxRef = useRef(-1);
  const lastFocalRef = useRef<Focal>({ x: -1, y: -1 });
  const visibleRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const manifest = await loadManifest(PRIMARY_SEQUENCE);
      if (cancelled) return;
      manifestRef.current = manifest;
      const cache = new FrameCache(manifest, tier);
      cacheRef.current = cache;

      // Prewarm leading frames so the fly-in doesn't stutter waiting on decodes.
      const warm = Math.min(manifest.count, Math.max(0, prewarm));
      for (let i = 0; i < warm; i++) void cache.request(i).catch(() => {});

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
        // Force a fresh draw of the current frame on the next tick.
        lastShownIdxRef.current = -1;
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
        const scale = Math.max(cw / iw, ch / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (cw - dw) * focalRef.current.x;
        const dy = (ch - dh) * focalRef.current.y;
        ctx.fillStyle = "#EAF3FA";
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, dx, dy, dw, dh);
        lastDrawnRef.current = img;
      };

      resize();
      const resizeObserver = new ResizeObserver(resize);
      if (containerRef.current) resizeObserver.observe(containerRef.current);

      // Pause all drawing while the scene is scrolled out of view.
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) visibleRef.current = e.isIntersecting;
        },
        { threshold: 0 }
      );
      if (containerRef.current) io.observe(containerRef.current);

      // Poster: draw the very first frame as soon as it decodes.
      void cache
        .request(0)
        .then((img) => {
          if (!cancelled && img && !lastDrawnRef.current) draw(img);
        })
        .catch(() => {});

      const tick = () => {
        rafRef.current = requestAnimationFrame(tick);
        const mf = manifestRef.current;
        const c = cacheRef.current;
        if (!mf || !c) return;
        const progress = progressRef.current;
        const fn = focalFnRef.current;
        const f = typeof fn === "function" ? fn(progress) : fn;
        focalRef.current = f;
        if (!visibleRef.current) return;

        const idx = frameIndexFor(PRIMARY_SEQUENCE, progress, mf.count);
        const focalChanged = f.x !== lastFocalRef.current.x || f.y !== lastFocalRef.current.y;
        if (idx === lastShownIdxRef.current && !focalChanged) return; // nothing changed

        const img = c.getIfReady(idx);
        if (img) {
          draw(img);
          lastShownIdxRef.current = idx;
          lastFocalRef.current = { x: f.x, y: f.y };
        } else {
          void c.request(idx).catch(() => {});
          // Hold the last valid frame while the target decodes.
          if (lastDrawnRef.current) draw(lastDrawnRef.current);
          lastFocalRef.current = { x: f.x, y: f.y };
        }
      };
      tick();

      return () => {
        resizeObserver.disconnect();
        io.disconnect();
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
