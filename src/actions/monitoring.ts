"use server";

import { revalidatePath } from "next/cache";
import { queueCallEvaluation, processEvaluation } from "@/server/monitoring/bluejay/evaluations";
import { scheduleDailyRun } from "@/server/monitoring/bluejay/schedule";
import { setUpBluejayMonitoring } from "@/server/monitoring/bluejay/setup";
import { queueGuardrailRun, refreshRun } from "@/server/monitoring/bluejay/simulations";
import { db } from "@/server/db";

export type MonitoringActionState = { ok: boolean; message: string } | null;

export async function setUpMonitoringAction(): Promise<MonitoringActionState> {
  const { status, config } = await setUpBluejayMonitoring();
  revalidatePath("/dashboard", "layout");
  const failed = (config.steps ?? []).filter((s) => !s.ok && !s.skipped).length;
  return {
    ok: status !== "error",
    message:
      status === "ready"
        ? "Bluejay is set up and monitoring Perrie."
        : status === "partial"
          ? `Mostly set up — ${failed} step(s) need attention (see below).`
          : "Couldn't reach Bluejay — see the details below.",
  };
}

export async function runGuardrailSimulationAction(): Promise<MonitoringActionState> {
  try {
    const run = await queueGuardrailRun();
    revalidatePath("/dashboard/monitoring");
    return { ok: true, message: `Queued guardrail run ${run.external_run_id}. Bluejay's callers will phone Perrie shortly.` };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function scheduleDailyRunAction(): Promise<MonitoringActionState> {
  try {
    await scheduleDailyRun();
    revalidatePath("/dashboard/monitoring");
    return { ok: true, message: "The guardrail test will run every day at 09:00 (Bluejay schedule)." };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function evaluateCallAction(form: FormData): Promise<void> {
  const callId = String(form.get("call_id") ?? "");
  const call = callId ? await db().get("calls", callId) : null;
  // Never score a call that's still going: the finished call is sent automatically.
  if (call && call.ended_at) await queueCallEvaluation(callId, { force: true });
  revalidatePath(`/dashboard/calls/${callId}`);
  revalidatePath("/dashboard/monitoring");
}

export async function refreshEvaluationAction(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  const row = id ? await db().get("call_evaluations", id) : null;
  if (row) {
    // Check now rather than waiting for the poller.
    await db().update("call_evaluations", row.id, { next_check_at: new Date().toISOString() });
    await processEvaluation(row.id);
    revalidatePath(`/dashboard/calls/${row.call_id}`);
  }
  revalidatePath("/dashboard/monitoring");
}

export async function refreshRunAction(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  const row = id ? await db().get("simulation_runs", id) : null;
  if (row) await refreshRun(row);
  revalidatePath("/dashboard/monitoring");
}
