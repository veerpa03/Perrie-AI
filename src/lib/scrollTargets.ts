import { STAGES, type StageId } from "./constants";

/**
 * The journey section is a single pinned/tall scroll region, not a stack of
 * normal-flow elements, so nav links can't just use anchor hashes. This
 * module lets JourneySection publish its scroll-trigger start/end pixel
 * offsets, and the navbar reads them to compute where to scroll for a given
 * story stage.
 */
let journeyBounds: { start: number; end: number } | null = null;

export function setJourneyBounds(start: number, end: number) {
  journeyBounds = { start, end };
}

export function scrollToStage(stage: StageId) {
  const def = STAGES.find((s) => s.id === stage);
  if (!def) return;
  const mid = (def.from + def.to) / 2;
  if (!journeyBounds) {
    document.getElementById("journey-section")?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  const target = journeyBounds.start + mid * (journeyBounds.end - journeyBounds.start);
  window.scrollTo({ top: target, behavior: "smooth" });
}
