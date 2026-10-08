import { CHAPTERS, type ChapterId } from "./constants";

/**
 * The journey section is a single pinned/tall scroll region, not a stack of
 * normal-flow elements, so jumping to a chapter means computing a pixel
 * offset inside that region. JourneySection publishes its scroll-trigger
 * start/end pixel offsets here, and navigation reads them to scroll to a
 * given chapter's midpoint.
 */
let journeyBounds: { start: number; end: number } | null = null;

export function setJourneyBounds(start: number, end: number) {
  journeyBounds = { start, end };
}

export function scrollToChapter(id: ChapterId) {
  const def = CHAPTERS.find((c) => c.id === id);
  if (!def) return;
  const mid = (def.from + def.to) / 2;
  if (!journeyBounds) {
    document.getElementById("journey-section")?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  const target = journeyBounds.start + mid * (journeyBounds.end - journeyBounds.start);
  window.scrollTo({ top: target, behavior: "smooth" });
}

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth" });
}
