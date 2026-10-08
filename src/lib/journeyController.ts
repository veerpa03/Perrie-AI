import { DIRECTION_HYSTERESIS } from "./constants";
import type { SequenceName } from "./types";

/**
 * Tracks which frame sequence (ascent vs descent) should be considered
 * "active" as journey progress changes, with hysteresis so a few pixels
 * of jitter near a scroll direction change doesn't flap the sequence.
 *
 * Both sequences are indexed by the same normalized progress (0 = sky,
 * 1 = perched): descent frame = progress * (count-1); ascent frame =
 * (1-progress) * (count-1). See CHAPTERS in constants.ts for how the
 * chapter boundaries map onto the descent frames.
 *
 * NOTE: the cinematic renderer (JourneyCanvas) scrubs the descent sequence
 * directly in both directions, so this controller is retained only for the
 * frameIndexFor helper below and as a reference for sequence switching.
 */
export class JourneyController {
  private active: SequenceName = "descent";
  private lastProgress = 0;
  private accumulatedAgainstActive = 0;

  get activeSequence(): SequenceName {
    return this.active;
  }

  update(progress: number): SequenceName {
    const delta = progress - this.lastProgress;
    this.lastProgress = progress;

    if (delta === 0) return this.active;

    const movingDown = delta > 0;
    const activeMatchesDirection =
      (this.active === "descent" && movingDown) ||
      (this.active === "ascent" && !movingDown);

    if (activeMatchesDirection) {
      this.accumulatedAgainstActive = 0;
      return this.active;
    }

    this.accumulatedAgainstActive += Math.abs(delta);
    if (this.accumulatedAgainstActive >= DIRECTION_HYSTERESIS) {
      this.active = movingDown ? "descent" : "ascent";
      this.accumulatedAgainstActive = 0;
    }
    return this.active;
  }

  reset() {
    this.active = "descent";
    this.lastProgress = 0;
    this.accumulatedAgainstActive = 0;
  }
}

export function frameIndexFor(
  sequence: SequenceName,
  progress: number,
  count: number
): number {
  const p = Math.min(1, Math.max(0, progress));
  const last = count - 1;
  if (sequence === "descent") return Math.round(p * last);
  return Math.round((1 - p) * last);
}
