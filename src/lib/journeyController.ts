import {
  DIRECTION_HYSTERESIS,
  TOP_SETTLE_MS,
  ascentFracFor,
  descentFracFor,
} from "./constants";
import type { SequenceName } from "./types";

export interface TakeTarget {
  /** Which take to show. */
  seq: SequenceName;
  /** Frame fraction (0..1) within that take. */
  frac: number;
  /** Matching frame fraction in the other take, kept warm for an instant switch. */
  otherFrac: number;
}

/**
 * Chooses the flight take for the current scroll position.
 *
 *  - Scrolling DOWN shows the DESCENT take; scrolling UP shows the ASCENT take
 *    (played forward, so going back up is a real flight, not a rewind).
 *  - A direction change only switches takes after sustained movement the other
 *    way (DIRECTION_HYSTERESIS), so jitter and tiny reversals never flap.
 *  - When the page comes to rest at the very top on the ascent take, it hands
 *    back to the descent hero frame — the same stable pose the opening fly-in
 *    lands on — instead of replaying anything.
 *
 * The canvas cross-fades whenever `seq` changes, so the switch between the two
 * (different) takes never shows a hard jump.
 */
export class DirectionalSequencer {
  private active: SequenceName = "descent";
  private lastP = 0;
  private against = 0;
  private lastMoveAt = 0;
  private started = false;

  get activeSequence(): SequenceName {
    return this.active;
  }

  update(p: number, now: number): TakeTarget {
    if (!this.started) {
      this.started = true;
      this.lastP = p;
      this.lastMoveAt = now;
    }
    const dp = p - this.lastP;
    this.lastP = p;

    if (Math.abs(dp) > 1e-5) {
      this.lastMoveAt = now;
      const down = dp > 0;
      const matches =
        (this.active === "descent" && down) || (this.active === "ascent" && !down);
      if (matches) {
        this.against = 0;
      } else {
        this.against += Math.abs(dp);
        if (this.against >= DIRECTION_HYSTERESIS) {
          this.active = down ? "descent" : "ascent";
          this.against = 0;
        }
      }
    }

    // At rest at the top on the ascent: settle back to the stable hero frame.
    if (this.active === "ascent" && p < 0.02 && now - this.lastMoveAt > TOP_SETTLE_MS) {
      this.active = "descent";
      this.against = 0;
    }

    const d = descentFracFor(p);
    const a = ascentFracFor(p);
    return this.active === "descent"
      ? { seq: "descent", frac: d, otherFrac: a }
      : { seq: "ascent", frac: a, otherFrac: d };
  }

  reset() {
    this.active = "descent";
    this.against = 0;
    this.started = false;
  }
}

export function frameIndexFor(frac: number, count: number): number {
  const f = Math.min(1, Math.max(0, frac));
  return Math.round(f * (count - 1));
}
