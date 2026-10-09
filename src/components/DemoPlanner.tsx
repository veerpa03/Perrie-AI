"use client";

import { useId, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { DEMO_EXAMPLES } from "@/lib/constants";

type ExampleId = (typeof DEMO_EXAMPLES)[number]["id"];

interface Props {
  compact?: boolean;
  /** Example to show first (falls back to the first example). */
  initialId?: string;
}

export default function DemoPlanner({ compact = false, initialId }: Props) {
  const [activeId, setActiveId] = useState<ExampleId>(
    () => (DEMO_EXAMPLES.find((e) => e.id === initialId)?.id ?? DEMO_EXAMPLES[0].id) as ExampleId
  );
  const active = DEMO_EXAMPLES.find((e) => e.id === activeId) ?? DEMO_EXAMPLES[0];
  const groupId = useId();

  return (
    <div
      className={`rounded-2xl border border-[color:var(--color-slate)]/10 bg-white/80 shadow-sm backdrop-blur-sm ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate)]/50">
          Frontend preview · not connected to a live backend
        </p>
      </div>

      <div role="tablist" aria-label="Example requests" className="mb-4 flex flex-wrap gap-2">
        {DEMO_EXAMPLES.map((ex) => {
          const selected = ex.id === activeId;
          return (
            <button
              key={ex.id}
              role="tab"
              id={`${groupId}-tab-${ex.id}`}
              aria-selected={selected}
              aria-controls={`${groupId}-panel`}
              type="button"
              onClick={() => setActiveId(ex.id)}
              className={`focus-ring rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                selected
                  ? "bg-[color:var(--color-teal-deep)] text-white"
                  : "bg-[color:var(--color-teal)]/60 text-[color:var(--color-slate)] hover:bg-[color:var(--color-teal)]"
              }`}
            >
              {exampleLabel(ex.id)}
            </button>
          );
        })}
      </div>

      <div
        id={`${groupId}-panel`}
        role="tabpanel"
        aria-labelledby={`${groupId}-tab-${activeId}`}
        className="space-y-4"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate)]/50">
            You ask
          </p>
          <p className="mt-1 rounded-xl bg-[color:var(--color-sky)] px-4 py-3 text-sm leading-relaxed text-[color:var(--color-slate)]">
            &ldquo;{active.request}&rdquo;
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-slate)]/50">
            Perrie proposes
          </p>
          <ul className="mt-1 space-y-1.5">
            {active.plan.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[color:var(--color-slate)]/85">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-teal-deep)]"
                  aria-hidden="true"
                />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function exampleLabel(id: string): string {
  switch (id) {
    case "plan-day":
      return "Plan your day";
    case "draft-message":
      return "Draft a message";
    case "research":
      return "Research a topic";
    case "organize-tasks":
      return "Organize tasks";
    default:
      return id;
  }
}
