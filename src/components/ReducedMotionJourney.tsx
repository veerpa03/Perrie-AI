"use client";

import Image from "next/image";
import { ArrowDown } from "lucide-react";
import { SITE, CHAPTERS } from "@/lib/constants";
import { scrollToId } from "@/lib/scrollTargets";
import { useDemoModal } from "./DemoModal";

/**
 * Static, non-animated fallback shown when the visitor prefers reduced motion.
 * Same story and chapters as the cinematic journey, laid out as ordinary
 * stacked sections with a representative still per chapter instead of the
 * scrubbed frame sequence. The page's capabilities / how-it-works / FAQ / CTA
 * sections still render below this (see app/page.tsx).
 */
const CHAPTER_STILLS: Record<string, string> = {
  hero: "/frames/descent/lg/0000.webp",
  clarity: "/frames/descent/lg/0055.webp",
  city: "/frames/descent/lg/0220.webp",
  landing: "/frames/descent/lg/0344.webp",
};

export default function ReducedMotionJourney() {
  const { open } = useDemoModal();

  return (
    <div id="journey-section" className="bg-[color:var(--color-sky)]">
      {/* Hero */}
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 pb-16 pt-28 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl">
          <Image
            src={CHAPTER_STILLS.hero}
            alt="Perrie the pigeon above a sea of soft clouds at sunrise"
            width={1280}
            height={720}
            className="h-auto w-full"
            priority
          />
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--color-teal-deep)]">
            Meet {SITE.name}
          </p>
          <h1 className="mt-3 font-heading text-4xl font-bold leading-[1.05] text-[color:var(--color-slate)] sm:text-5xl">
            {SITE.headline}
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-[color:var(--color-slate)]/80">
            {SITE.subhead}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={open}
              className="focus-ring rounded-full bg-[color:var(--color-teal-deep)] px-6 py-3 text-sm font-semibold text-white"
            >
              Meet Perrie
            </button>
            <button
              type="button"
              onClick={() => scrollToId("capabilities")}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-slate)]/15 bg-white/70 px-6 py-3 text-sm font-semibold text-[color:var(--color-slate)]"
            >
              Explore
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Remaining chapters, stacked */}
      {CHAPTERS.filter((c) => c.id !== "hero").map((c, i) => (
        <section
          key={c.id}
          className={`mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 py-14 md:grid-cols-2 ${
            i % 2 === 1 ? "md:[&>*:first-child]:order-2" : ""
          }`}
        >
          <div className="overflow-hidden rounded-3xl">
            <Image
              src={CHAPTER_STILLS[c.id]}
              alt={c.headline}
              width={1280}
              height={720}
              className="h-auto w-full"
            />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--color-teal-deep)]">
              {c.eyebrow}
            </p>
            <h2 className="mt-3 font-heading text-3xl font-bold leading-tight text-[color:var(--color-slate)] sm:text-4xl">
              {c.headline}
            </h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-[color:var(--color-slate)]/80">
              {c.support}
            </p>
            {c.id === "landing" && (
              <button
                type="button"
                onClick={open}
                className="focus-ring mt-6 rounded-full bg-[color:var(--color-teal-deep)] px-6 py-3 text-sm font-semibold text-white"
              >
                See an example
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
