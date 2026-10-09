"use client";

import { useEffect, useRef } from "react";
import { FrameCache, loadManifest } from "@/lib/frameCache";
import { frameIndexFor, type TakeTarget } from "@/lib/journeyController";
import type { SequenceName } from "@/lib/types";
import { JOURNEY_FOCAL, TAKE_CROSSFADE_MS } from "@/lib/constants";

type Focal = { x: number; y: number };
type FocalInput = Focal | ((seq: SequenceName, frac: number) => Focal);

interface Props {
  /** Which take + frame fraction to show (written every frame by the parent). */
  targetRef: React.MutableRefObject<TakeTarget>;
  tier: "lg" | "sm";
  className?: string;
  /** Cover-fit focal point: static, or per take/frame so the crop follows Perrie. */
  focal?: FocalInput;
  /** Leading descent frames to prefetch so the opening fly-in is smooth. */
  prewarm?: number;
}

/**
 * Fullscreen Canvas 2D renderer for the two flight takes (descent + ascent).
 * The footage fills the element edge-to-edge with a COVER fit anchored on a
 * focal point, so Perrie is protected from the crop. No card, letterbox, or
 * player chrome.
 *
 * Driven imperatively from a ref via one rAF loop — scrolling never re-renders
 * React. The standby take is kept warm around the matching frame, and when the
 * active take changes the canvas cross-fades from the last shown frame of the
 * old take to the new one, so switching between two different takes never
 * jumps. The loop does no drawing while nothing changed or while off-screen.
 */
export default function JourneyCanvas({
  targetRef,
  tier,
  className,
  focal = JOURNEY_FOCAL,
  prewarm = 0,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const focalRef = useRef(focal);
  focalRef.current = focal;

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    const caches: Partial<Record<SequenceName, FrameCache>> = {};
    let cleanupObservers: (() => void) | null = null;

    const resolveFocal = (seq: SequenceName, frac: number): Focal => {
      const f = focalRef.current;
      return typeof f === "function" ? f(seq, frac) : f;
    };

    async function setup() {
      const [descent, ascent] = await Promise.all([
        loadManifest("descent"),
        loadManifest("ascent"),
      ]);
      if (cancelled) return;
      caches.descent = new FrameCache(descent, tier);
      caches.ascent = new FrameCache(ascent, tier);
      if (prewarm > 0) caches.descent.prefetchRange(0, prewarm - 1);

      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(2, window.devicePixelRatio || 1);

      // What is currently on screen.
      let shownSeq: SequenceName | null = null;
      let shownIdx = -1;
      let shownImg: HTMLImageElement | null = null;
      let shownFocal: Focal = { x: -1, y: -1 };
      let lastRequestedIdx = -1;
      let force = true;
      let fade: { img: HTMLImageElement; focal: Focal; start: number } | null = null;
      let visible = true;
      let tickCount = 0;

      const paint = (img: HTMLImageElement, f: Focal, alpha = 1) => {
        const cw = canvas.width;
        const ch = canvas.height;
        const iw = img.width;
        const ih = img.height;
        if (!cw || !ch || !iw || !ih) return;
        const scale = Math.max(cw / iw, ch / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, (cw - dw) * f.x, (ch - dh) * f.y, dw, dh);
        ctx.globalAlpha = 1;
      };

      const clear = () => {
        ctx.fillStyle = "#EAF3FA";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      };

      const resize = () => {
        const rect = container.getBoundingClientRect();
        canvas.width = Math.max(1, Math.round(rect.width * dpr));
        canvas.height = Math.max(1, Math.round(rect.height * dpr));
        force = true;
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(container);
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) visible = e.isIntersecting;
          if (visible) force = true;
        },
        { threshold: 0 }
      );
      io.observe(container);
      cleanupObservers = () => {
        ro.disconnect();
        io.disconnect();
      };

      const tick = () => {
        raf = requestAnimationFrame(tick);
        const t = targetRef.current;
        const cache = caches[t.seq];
        const otherSeq: SequenceName = t.seq === "descent" ? "ascent" : "descent";
        const other = caches[otherSeq];
        if (!cache || !other) return;

        // Keep the standby take decoded around the matching scene.
        if (++tickCount % 4 === 0) other.warm(frameIndexFor(t.otherFrac, other.count));
        if (!visible) return;

        const idx = frameIndexFor(t.frac, cache.count);
        if (idx !== lastRequestedIdx || t.seq !== shownSeq) {
          lastRequestedIdx = idx;
          void cache.request(idx).catch(() => undefined);
        }
        const f = resolveFocal(t.seq, t.frac);
        const img = cache.getIfReady(idx);
        const now = performance.now();

        // Switch takes only once the new take's frame is ready; cross-fade.
        if (img && shownSeq !== null && t.seq !== shownSeq && shownImg) {
          fade = { img: shownImg, focal: shownFocal, start: now };
        }

        if (fade) {
          const a = Math.min(1, (now - fade.start) / TAKE_CROSSFADE_MS);
          clear();
          paint(fade.img, fade.focal, 1);
          if (img) paint(img, f, a);
          if (a >= 1) fade = null;
        } else if (img) {
          const focalChanged = f.x !== shownFocal.x || f.y !== shownFocal.y;
          if (force || idx !== shownIdx || t.seq !== shownSeq || focalChanged) {
            clear();
            paint(img, f);
            force = false;
          }
        } else if (force && shownImg) {
          // Target still decoding — hold the last valid frame (never blank).
          clear();
          paint(shownImg, shownFocal);
          force = false;
        }

        if (img) {
          shownSeq = t.seq;
          shownIdx = idx;
          shownImg = img;
          shownFocal = f;
        }
      };

      // Poster: first descent frame as soon as it decodes.
      void caches.descent
        .request(0)
        .then((img) => {
          if (!cancelled && img && !shownImg) {
            clear();
            paint(img, resolveFocal("descent", 0));
          }
        })
        .catch(() => undefined);

      tick();
    }

    void setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      cleanupObservers?.();
      caches.descent?.dispose();
      caches.ascent?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tier]);

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />
    </div>
  );
}
