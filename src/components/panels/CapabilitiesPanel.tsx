import { CalendarClock, PenLine, Search, ListChecks } from "lucide-react";
import { CAPABILITIES } from "@/lib/constants";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  "plan-day": CalendarClock,
  "draft-message": PenLine,
  research: Search,
  "organize-tasks": ListChecks,
};

export default function CapabilitiesPanel() {
  return (
    <div className="max-w-xl px-6 py-8 md:px-4">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[color:var(--color-teal-deep)]">
        What Perrie helps with
      </p>
      <h2 className="font-heading text-3xl font-bold leading-tight text-[color:var(--color-slate)] sm:text-4xl">
        A few things off your plate
      </h2>
      <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {CAPABILITIES.map((cap) => {
          const Icon = ICONS[cap.id];
          return (
            <li
              key={cap.id}
              className="rounded-2xl border border-[color:var(--color-slate)]/10 bg-white/70 p-4 shadow-sm backdrop-blur-sm"
            >
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-teal)]">
                <Icon className="h-4 w-4 text-[color:var(--color-teal-deep)]" aria-hidden="true" />
              </div>
              <h3 className="font-heading text-sm font-semibold text-[color:var(--color-slate)]">
                {cap.title}
              </h3>
              <p className="mt-1 text-sm leading-snug text-[color:var(--color-slate)]/70">
                {cap.description}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
