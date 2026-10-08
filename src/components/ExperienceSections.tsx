"use client";

import { CalendarClock, PenLine, Search, ListChecks } from "lucide-react";
import { CAPABILITIES, STEPS } from "@/lib/constants";
import DemoPlanner from "./DemoPlanner";
import { useDemoModal } from "./DemoModal";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "plan-day": CalendarClock,
  "draft-message": PenLine,
  research: Search,
  "organize-tasks": ListChecks,
};

export function CapabilitiesSection() {
  return (
    <section id="capabilities" className="scroll-mt-20 bg-[color:var(--color-cloud)]">
      <div className="mx-auto max-w-5xl px-6 py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--color-teal-deep)]">
            What Perrie helps with
          </p>
          <h2 className="mt-3 font-heading text-3xl font-bold leading-tight text-[color:var(--color-slate)] sm:text-4xl">
            A few things off your plate
          </h2>
          <p className="mt-4 text-[color:var(--color-slate)]/70">
            Four everyday workflows, shown as examples. The connected product comes next.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((cap) => {
            const Icon = ICONS[cap.id];
            return (
              <li
                key={cap.id}
                className="rounded-3xl border border-[color:var(--color-slate)]/10 bg-white p-6 transition hover:border-[color:var(--color-teal-deep)]/30"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--color-teal)]">
                  {Icon && <Icon className="h-5 w-5 text-[color:var(--color-teal-deep)]" />}
                </div>
                <h3 className="font-heading text-base font-semibold text-[color:var(--color-slate)]">
                  {cap.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-slate)]/70">
                  {cap.description}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-[color:var(--color-sky)]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 py-20 sm:py-24 lg:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[color:var(--color-teal-deep)]">
            How it works
          </p>
          <h2 className="mt-3 font-heading text-3xl font-bold leading-tight text-[color:var(--color-slate)] sm:text-4xl">
            Three simple steps
          </h2>
          <ol className="mt-8 space-y-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-lavender)] text-sm font-bold text-[color:var(--color-slate)]">
                  {i + 1}
                </span>
                <div>
                  <p className="font-heading text-base font-semibold text-[color:var(--color-slate)]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-[color:var(--color-slate)]/70">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <DemoPlanner />
        </div>
      </div>
    </section>
  );
}

export function FinalCTA() {
  const { open } = useDemoModal();
  return (
    <section className="bg-[color:var(--color-cloud)]">
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h2 className="font-heading text-3xl font-bold leading-tight text-[color:var(--color-slate)] sm:text-4xl">
          A little help goes a long way.
        </h2>
        <p className="mt-4 text-[color:var(--color-slate)]/75">
          Start with a request, review the next step, and keep your day moving.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={open}
            className="focus-ring rounded-full bg-[color:var(--color-teal-deep)] px-7 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-[0.98] sm:text-base"
          >
            See an example
          </button>
          <a
            href="/sign-in"
            className="focus-ring rounded-full border border-[color:var(--color-slate)]/15 bg-white px-7 py-3 text-sm font-semibold text-[color:var(--color-slate)] transition hover:bg-[color:var(--color-teal)]/30 sm:text-base"
          >
            Sign in
          </a>
        </div>
      </div>
    </section>
  );
}
