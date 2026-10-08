import Image from "next/image";
import { SITE, CAPABILITIES } from "@/lib/constants";
import DemoPlanner from "./DemoPlanner";

/**
 * Static, non-animated fallback shown when the visitor has requested
 * reduced motion. Same content as the scroll journey, laid out as ordinary
 * stacked sections with a single representative image instead of the
 * frame-sequence animation.
 */
export default function ReducedMotionJourney() {
  return (
    <div className="bg-[color:var(--color-sky)]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 py-16 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl">
          <Image
            src="/frames/descent/lg/0344.webp"
            alt="Perrie the pigeon perched on a tree branch overlooking the city"
            width={1280}
            height={720}
            className="h-auto w-full"
            priority
          />
        </div>
        <div>
          <h1 className="font-heading text-4xl font-bold leading-tight text-[color:var(--color-slate)] sm:text-5xl">
            {SITE.headline}
          </h1>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-[color:var(--color-slate)]/80">
            {SITE.subhead}
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <a
              href="/dashboard"
              className="focus-ring rounded-full bg-[color:var(--color-teal-deep)] px-6 py-3 text-sm font-semibold text-white"
            >
              Meet Perrie
            </a>
            <a
              href="#capabilities"
              className="focus-ring rounded-full border border-[color:var(--color-slate)]/15 bg-white/70 px-6 py-3 text-sm font-semibold text-[color:var(--color-slate)]"
            >
              See how it works
            </a>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-3xl px-6 py-12 text-center">
        <h2 className="font-heading text-3xl font-bold text-[color:var(--color-slate)]">
          Your day has enough moving parts.
        </h2>
        <p className="mt-4 text-[color:var(--color-slate)]/80">
          Scattered to-dos, half-written messages, tabs you meant to close hours
          ago. Switching between a dozen tools just to get through the basics
          shouldn&apos;t be the job.
        </p>
      </section>

      <section id="capabilities" className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-center font-heading text-3xl font-bold text-[color:var(--color-slate)]">
          A few things off your plate
        </h2>
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CAPABILITIES.map((cap) => (
            <li
              key={cap.id}
              className="rounded-2xl border border-[color:var(--color-slate)]/10 bg-white p-5 shadow-sm"
            >
              <h3 className="font-heading text-sm font-semibold text-[color:var(--color-slate)]">
                {cap.title}
              </h3>
              <p className="mt-1 text-sm text-[color:var(--color-slate)]/70">{cap.description}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="how-it-works" className="mx-auto max-w-2xl px-6 py-12">
        <h2 className="text-center font-heading text-3xl font-bold text-[color:var(--color-slate)]">
          How it works
        </h2>
        <div className="mt-8">
          <DemoPlanner />
        </div>
      </section>

      <section className="mx-auto max-w-xl px-6 py-16 text-center">
        <h2 className="font-heading text-3xl font-bold text-[color:var(--color-slate)]">
          A little help. A lighter day.
        </h2>
        <div className="mt-6 flex justify-center gap-4">
          <a
            href="/dashboard"
            className="focus-ring rounded-full bg-[color:var(--color-teal-deep)] px-6 py-3 text-sm font-semibold text-white"
          >
            Try the demo dashboard
          </a>
          <a
            href="/sign-in"
            className="focus-ring rounded-full border border-[color:var(--color-slate)]/15 bg-white px-6 py-3 text-sm font-semibold text-[color:var(--color-slate)]"
          >
            Sign in
          </a>
        </div>
      </section>
    </div>
  );
}
