"use client";

import { useActionState, useRef } from "react";
import { Loader2, Wand2 } from "lucide-react";
import { createTaskAction, type TaskFormState } from "@/actions/tasks";
import { fieldClass, insetField, RainbowButton } from "./ui";

const EXAMPLES = [
  "Call Dr. Lee's office and move my dental cleaning to any weekday afternoon next week, then put it on my calendar.",
  "Find a free hour with no meetings tomorrow and block it as Focus time.",
  "Text Sam that I'm running 10 minutes late.",
  "What's on my calendar on Friday?",
];

export default function TaskForm() {
  const [state, action, pending] = useActionState<TaskFormState, FormData>(createTaskAction, null);
  const ref = useRef<HTMLTextAreaElement>(null);

  return (
    <form action={action} aria-label="New task" className="space-y-4">
      <label htmlFor="request" className="sr-only">
        What should Perrie do?
      </label>
      <textarea
        ref={ref}
        id="request"
        name="request"
        rows={3}
        required
        minLength={5}
        maxLength={2000}
        placeholder="e.g. Call the florist and order white tulips for Saturday, under $60…"
        className={`${fieldClass} mt-0 text-base`}
        style={insetField}
        aria-describedby="task-hint"
      />
      <div className="flex flex-wrap gap-2" aria-label="Examples">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              if (ref.current) {
                ref.current.value = ex;
                ref.current.focus();
              }
            }}
            className="focus-ring rounded-full px-3 py-1.5 text-left text-xs font-semibold text-[color:var(--color-slate)]/70 transition hover:text-[color:var(--color-slate)]"
            style={{ background: "rgba(255,255,255,0.75)", boxShadow: "inset 0 0 0 1px rgba(38,52,69,0.08)" }}
          >
            {ex.length > 64 ? `${ex.slice(0, 62)}…` : ex}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <RainbowButton type="submit" disabled={pending} className="px-6 py-3">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Wand2 className="h-4 w-4" aria-hidden="true" />}
          {pending ? "Planning…" : "Plan it"}
        </RainbowButton>
        <p id="task-hint" className="text-xs text-[color:var(--color-slate)]/55">
          Perrie plans first. Nothing happens until you approve the plan.
        </p>
        {state && !state.ok && (
          <p role="alert" className="text-sm font-bold text-[#B5403A]">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
