import { FRAME_CACHE } from "./constants";
import type { SequenceManifest, SequenceName } from "./types";

/**
 * Bounded decoded-frame cache for a single sequence. Keeps at most
 * `maxDecoded` HTMLImageElements resident (decoded bitmaps, not just
 * compressed bytes) and evicts the frames furthest from the last
 * requested index. Decoding is capped at a small concurrency so a fast
 * scroll doesn't fire hundreds of simultaneous image loads.
 */
export class FrameCache {
  private manifest: SequenceManifest;
  private tier: "lg" | "sm";
  private cache = new Map<number, HTMLImageElement>();
  private pending = new Map<number, Promise<HTMLImageElement>>();
  // Indices whose decode has failed, with how many attempts. A known-bad frame
  // is skipped (up to MAX_DECODE_TRIES) instead of being re-decoded every frame.
  private failed = new Map<number, number>();
  private lastIndex = 0;
  private inFlight = 0;
  private queue: number[] = [];
  private disposed = false;

  private static readonly MAX_DECODE_TRIES = 3;

  constructor(manifest: SequenceManifest, tier: "lg" | "sm") {
    this.manifest = manifest;
    this.tier = tier;
  }

  get count() {
    return this.manifest.count;
  }

  private urlFor(index: number) {
    const clamped = Math.min(this.manifest.count - 1, Math.max(0, index));
    const tierInfo = this.manifest.tiers[this.tier];
    return `${tierInfo.path}${this.manifest.frames[clamped]}`;
  }

  getIfReady(index: number): HTMLImageElement | undefined {
    const clamped = Math.min(this.manifest.count - 1, Math.max(0, index));
    return this.cache.get(clamped);
  }

  private isExhausted(index: number): boolean {
    return (this.failed.get(index) ?? 0) >= FrameCache.MAX_DECODE_TRIES;
  }

  /** Request a frame, decode it if needed, and opportunistically preload neighbors. */
  async request(index: number): Promise<HTMLImageElement | undefined> {
    this.lastIndex = index;
    const clamped = Math.min(this.manifest.count - 1, Math.max(0, index));
    const cached = this.cache.get(clamped);
    this.preloadAround(clamped);
    if (cached) return cached;
    if (this.isExhausted(clamped)) return undefined;
    return this.decode(clamped).catch(() => undefined);
  }

  private preloadAround(center: number) {
    const r = FRAME_CACHE.preloadRadius;
    for (let offset = -r; offset <= r; offset++) {
      const idx = center + offset;
      if (idx < 0 || idx >= this.manifest.count) continue;
      if (this.cache.has(idx) || this.pending.has(idx) || this.isExhausted(idx)) continue;
      this.enqueue(idx);
    }
  }

  private enqueue(index: number) {
    if (this.queue.includes(index)) return;
    this.queue.push(index);
    this.drain();
  }

  private drain() {
    while (this.inFlight < FRAME_CACHE.concurrency && this.queue.length) {
      const idx = this.queue.shift()!;
      if (this.cache.has(idx) || this.pending.has(idx) || this.isExhausted(idx)) continue;
      void this.decode(idx).catch(() => undefined);
    }
  }

  private decode(index: number): Promise<HTMLImageElement> {
    const existing = this.pending.get(index);
    if (existing) return existing;
    this.inFlight++;
    const p = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        this.inFlight--;
        this.pending.delete(index);
        if (!this.disposed) {
          this.cache.set(index, img);
          this.evictFar();
        }
        this.drain();
        resolve(img);
      };
      img.onerror = (err) => {
        this.inFlight--;
        this.pending.delete(index);
        this.failed.set(index, (this.failed.get(index) ?? 0) + 1);
        this.drain();
        reject(err);
      };
      img.src = this.urlFor(index);
    });
    this.pending.set(index, p);
    return p;
  }

  private evictFar() {
    if (this.cache.size <= FRAME_CACHE.maxDecoded) return;
    const entries = Array.from(this.cache.keys()).sort(
      (a, b) => Math.abs(b - this.lastIndex) - Math.abs(a - this.lastIndex)
    );
    const overflow = this.cache.size - FRAME_CACHE.maxDecoded;
    for (let i = 0; i < overflow; i++) {
      this.cache.delete(entries[i]);
    }
  }

  dispose() {
    this.disposed = true;
    this.cache.clear();
    this.pending.clear();
    this.failed.clear();
    this.queue = [];
  }
}

export async function loadManifest(sequence: SequenceName): Promise<SequenceManifest> {
  const res = await fetch(`/frames/${sequence}.manifest.json`);
  if (!res.ok) throw new Error(`Failed to load ${sequence} manifest`);
  return res.json();
}
