import type { OwnerProfile, ProfileFact } from "../db/types";
import { digitsOnly } from "../phone";

/**
 * Deterministic guardrails that run outside the model, so they hold even if
 * the model is confused or manipulated.
 */

// ---------------------------------------------------------------------------
// 1. Private-detail leak filter (non-owner conversations)
// ---------------------------------------------------------------------------

export type LeakFilter = (text: string) => { text: string; leaked: string[] };

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

/**
 * Blocks any outgoing sentence that contains a private value: private fact
 * values, the owner's own phone numbers, and e-mail addresses / digit runs
 * found in private facts. Matching is case-insensitive; phone-like values are
 * compared on digits so "four one five…" formatting tricks in text still
 * match when spoken as digits.
 */
export function buildLeakFilter(profile: OwnerProfile | null, facts: ProfileFact[]): LeakFilter {
  const privateFacts = facts.filter((f) => f.visibility === "private");
  const shareableText = facts
    .filter((f) => f.visibility === "shareable")
    .map((f) => f.value.toLowerCase())
    .join("\n");

  const phrases = new Set<string>();
  const digitRuns = new Set<string>();
  for (const f of privateFacts) {
    const v = f.value.trim().toLowerCase();
    // Whole short values ("12 Elm Street", "Acme Corp"); long free text is
    // covered by the e-mail / number checks below.
    if (v.length >= 4 && v.length <= 80 && !shareableText.includes(v)) phrases.add(v);
    for (const m of v.match(EMAIL) ?? []) phrases.add(m);
    for (const m of v.match(/\d[\d\s().-]{5,}\d/g) ?? []) {
      const d = digitsOnly(m);
      if (d.length >= 6) digitRuns.add(d);
    }
  }
  for (const p of profile?.phone_numbers ?? []) digitRuns.add(digitsOnly(p).slice(-10));

  return (text: string) => {
    const lower = text.toLowerCase();
    const textDigits = digitsOnly(text);
    const leaked: string[] = [];
    for (const p of phrases) if (lower.includes(p)) leaked.push(p);
    for (const d of digitRuns) if (d.length >= 6 && textDigits.includes(d)) leaked.push(`#${d.slice(-4)}`);
    if (!leaked.length) return { text, leaked };
    return { text: "Sorry — that's not something I can share.", leaked };
  };
}

// ---------------------------------------------------------------------------
// 2. Confirmation of side effects
// ---------------------------------------------------------------------------

const YES =
  /\b(yes|yeah|yep|yup|sure|ok(ay)?|go ahead|go for it|do it|please do|confirm(ed)?|correct|that'?s right|sounds good|absolutely|definitely|perfect|book it|send it|call (them|her|him))\b/i;
const NO = /\b(no|nope|don'?t|do not|wait|stop|cancel|hold on|not yet|never ?mind|actually)\b/i;

/** Did the person clearly say yes (and not "yes, but wait")? */
export function isAffirmative(text: string): boolean {
  return YES.test(text) && !NO.test(text);
}

/** Stable key for "the same action" (tool + canonical input). */
export function actionKey(tool: string, input: unknown): string {
  const canon = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(canon)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v as object)
              .sort()
              .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
          )
        : v;
  return `${tool}:${JSON.stringify(canon(input))}`;
}

// ---------------------------------------------------------------------------
// 3. Manipulation attempts (logged; the prompt already tells the model to
//    ignore them, and the role checks make them ineffective)
// ---------------------------------------------------------------------------

const INJECTION =
  /(ignore|forget|disregard) (all |any |your )?(previous |prior |earlier )?(instructions|rules)|system prompt|developer mode|jailbreak|you are now|pretend (to be|you are)|act as (my|an?) (assistant|agent)|i am (actually )?(the )?(owner|your (boss|master))/i;

export function looksLikeManipulation(text: string): boolean {
  return INJECTION.test(text);
}
