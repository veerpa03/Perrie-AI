"use client";

import { useActionState } from "react";
import { Loader2, Play } from "lucide-react";
import { runGuardrailSuiteAction, type BluejayRunState } from "@/actions/bluejay";
import ResultView from "./ResultView";
import { RainbowButton } from "./ui";

/** One-click runner for the 6 guest-caller digital humans already created in Bluejay. */
export default function RunGuardrailSuite() {
  const [state, action, pending] = useActionState<BluejayRunState, FormData>(() => runGuardrailSuiteAction(), null);

  return (
    <form action={action} className="space-y-3">
      <RainbowButton type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
        Run guardrail suite now
      </RainbowButton>
      <p className="text-xs text-[color:var(--color-slate)]/75">
        Places 6 real test calls to Perrie&apos;s line via Bluejay digital humans. Check results on{" "}
        <a href="https://app.getbluejay.ai" target="_blank" rel="noreferrer" className="font-bold underline">
          app.getbluejay.ai
        </a>{" "}
        once it finishes.
      </p>
      {state && (
        <div className="rounded-3xl p-4" style={{ background: state.ok ? "rgba(221,245,236,0.6)" : "rgba(255,231,227,0.7)" }} aria-live="polite">
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate)]/75">{state.ok ? "Queued" : "Failed"}</p>
          {state.message && <p className="mb-2 text-sm font-bold text-[#B5403A]">{state.message}</p>}
          <ResultView data={state.result} />
        </div>
      )}
    </form>
  );
}
