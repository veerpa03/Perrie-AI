"use client";

import { useActionState } from "react";
import { CalendarClock, FlaskConical, Loader2, RefreshCw } from "lucide-react";
import {
  runGuardrailSimulationAction,
  scheduleDailyRunAction,
  setUpMonitoringAction,
  type MonitoringActionState,
} from "@/actions/monitoring";
import { RainbowButton, SoftButton } from "./ui";

function Status({ state }: { state: MonitoringActionState }) {
  if (!state) return null;
  return (
    <p role="status" aria-live="polite" className={`text-sm font-bold ${state.ok ? "text-[#1C7F62]" : "text-[#B5403A]"}`}>
      {state.message}
    </p>
  );
}

export function SetupButton({ label }: { label: string }) {
  const [state, action, pending] = useActionState<MonitoringActionState, FormData>(() => setUpMonitoringAction(), null);
  return (
    <form action={action} className="space-y-2">
      <RainbowButton type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
        {pending ? "Talking to Bluejay…" : label}
      </RainbowButton>
      <Status state={state} />
    </form>
  );
}

export function RunTestButtons({ canRun, hasSchedule }: { canRun: boolean; hasSchedule: boolean }) {
  const [runState, run, running] = useActionState<MonitoringActionState, FormData>(() => runGuardrailSimulationAction(), null);
  const [schedState, schedule, scheduling] = useActionState<MonitoringActionState, FormData>(() => scheduleDailyRunAction(), null);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <form action={run}>
          <SoftButton type="submit" disabled={!canRun || running} title={canRun ? undefined : "Set up monitoring first"}>
            {running ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FlaskConical className="h-4 w-4" aria-hidden="true" />}
            Run guardrail test now
          </SoftButton>
        </form>
        <form action={schedule}>
          <SoftButton type="submit" disabled={!canRun || scheduling || hasSchedule}>
            {scheduling ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CalendarClock className="h-4 w-4" aria-hidden="true" />}
            {hasSchedule ? "Runs daily" : "Run it daily"}
          </SoftButton>
        </form>
      </div>
      <p className="text-xs text-[color:var(--color-slate)]/55">Each run places real calls from Bluejay to Perrie&apos;s number.</p>
      <Status state={runState ?? schedState} />
    </div>
  );
}
