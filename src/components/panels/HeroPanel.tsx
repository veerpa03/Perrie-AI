"use client";

import { ArrowDown } from "lucide-react";
import { SITE } from "@/lib/constants";
import { scrollToStage } from "@/lib/scrollTargets";

export default function HeroPanel() {
  return (
    <div className="max-w-xl px-6 py-8 md:px-4">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[color:var(--color-teal-deep)]">
        Meet {SITE.name}
      </p>
      <h1 className="font-heading text-4xl font-bold leading-tight text-[color:var(--color-slate)] sm:text-5xl md:text-6xl">
        {SITE.headline}
      </h1>
      <p className="mt-5 max-w-md text-base leading-relaxed text-[color:var(--color-slate)]/80 sm:text-lg">
        {SITE.subhead}
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <a
          href="/dashboard"
          className="focus-ring rounded-full bg-[color:var(--color-teal-deep)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 sm:text-base"
        >
          Meet Perrie
        </a>
        <button
          type="button"
          onClick={() => scrollToStage("clouds")}
          className="focus-ring rounded-full border border-[color:var(--color-slate)]/15 bg-white/70 px-6 py-3 text-sm font-semibold text-[color:var(--color-slate)] transition hover:bg-white sm:text-base"
        >
          See how it works
        </button>
      </div>
      <button
        type="button"
        onClick={() => scrollToStage("clouds")}
        className="focus-ring mt-10 hidden items-center gap-2 text-sm text-[color:var(--color-slate)]/60 md:flex"
        aria-label="Scroll to learn more"
      >
        <span>Scroll</span>
        <ArrowDown className="h-4 w-4 animate-bounce" aria-hidden="true" />
      </button>
    </div>
  );
}
