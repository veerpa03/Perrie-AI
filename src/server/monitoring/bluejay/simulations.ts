import { db, type SimulationRun } from "../../db";
import { BluejayError, bluejayConfigured, withBluejay } from "./client";
import { getMonitoringConfig } from "./state";

/**
 * Guardrail simulation runs: Bluejay's simulated callers phone Perrie's
 * number, then each call is scored. Queue with `queue_simulation_run`, poll
 * with `get_simulation_results` (run status RUNNING -> COMPLETED plus
 * per-caller results).
 */

const later = (ms: number) => new Date(Date.now() + ms).toISOString();
const GIVE_UP_MS = 2 * 3600_000;

export type RunResult = {
  id: string;
  caller: string | null;
  status: string | null;
  duration_ms: number | null;
  goal_success: boolean | null;
  hallucination: boolean | null;
  metrics_passed: number;
  metrics_total: number;
  audio_url: string | null;
};

type RawResult = {
  id?: unknown;
  digital_human_id?: unknown;
  status?: string | null;
  duration?: number | null;
  audio_url?: string | null;
  result?: Record<string, unknown> | null;
  evaluations?: {
    goal_success?: boolean | null;
    human_goal_success?: boolean | null;
    hallucination?: boolean | null;
    human_hallucination?: boolean | null;
    custom_metrics?: { response_value?: string; human_response_value?: string | null }[] | null;
  }[];
};

type RawRunResponse = {
  simulation_run?: {
    status?: string | null;
    summary?: string | null;
    total_tests?: number | null;
    tests_passed?: number | null;
    tests_failed?: number | null;
    tests_completed?: number | null;
  };
  simulation_results?: RawResult[] | null;
};

const PASS = new Set(["true", "yes", "pass", "passed"]);

export function summarizeRun(data: RawRunResponse, callerNames: Record<string, string> = {}) {
  const run = data.simulation_run ?? {};
  const results: RunResult[] = (data.simulation_results ?? []).map((r) => {
    const e = r.evaluations?.at(-1);
    const metrics = e?.custom_metrics ?? [];
    const dh = r.digital_human_id != null ? String(r.digital_human_id) : null;
    return {
      id: String(r.id ?? ""),
      caller: dh ? (callerNames[dh] ?? `Caller ${dh}`) : null,
      status: r.status ?? null,
      duration_ms: r.duration ?? null,
      goal_success: e ? (e.human_goal_success ?? e.goal_success ?? null) : null,
      hallucination: e ? (e.human_hallucination ?? e.hallucination ?? null) : null,
      metrics_passed: metrics.filter((m) => PASS.has(String(m.human_response_value ?? m.response_value ?? "").toLowerCase())).length,
      metrics_total: metrics.length,
      audio_url: r.audio_url ?? null,
    };
  });
  return {
    status: String(run.status ?? "RUNNING").toUpperCase(),
    summary: {
      text: run.summary ?? null,
      total: run.total_tests ?? results.length,
      passed: run.tests_passed ?? null,
      failed: run.tests_failed ?? null,
      completed: run.tests_completed ?? null,
    },
    results,
  };
}

export async function queueGuardrailRun(): Promise<SimulationRun> {
  const config = await getMonitoringConfig();
  if (!config.simulation_id) throw new BluejayError("Set up monitoring first — there's no guardrail simulation yet.");
  const res = await withBluejay((s) =>
    s.call<{ simulation_run_id?: unknown; simulation_result_ids?: unknown[] }>("queue_simulation_run", {
      simulation_id: String(config.simulation_id),
    }),
  );
  if (res?.simulation_run_id === undefined || res?.simulation_run_id === null) {
    throw new BluejayError(`queue_simulation_run returned no run id (${JSON.stringify(res).slice(0, 200)})`);
  }
  return db().insert("simulation_runs", {
    provider: "bluejay",
    simulation_id: String(config.simulation_id),
    external_run_id: String(res.simulation_run_id),
    status: "queued",
    summary: { total: res.simulation_result_ids?.length ?? null },
    results: null,
    error: null,
    completed_at: null,
    next_check_at: later(60_000),
  });
}

export async function refreshRun(row: SimulationRun): Promise<SimulationRun> {
  if (!row.external_run_id) return row;
  try {
    const data = await withBluejay((s) =>
      s.call<RawRunResponse>(s.pick("get_simulation_results", "retrieve_simulation_results") ?? "get_simulation_results", {
        simulation_run_id: row.external_run_id,
      }),
    );
    const config = await getMonitoringConfig();
    const names = Object.fromEntries(Object.entries(config.digital_humans ?? {}).map(([k, v]) => [v, k]));
    const { status, summary, results } = summarizeRun(data, names);
    const done = status === "COMPLETED";
    const tooOld = Date.now() - new Date(row.created_at).getTime() > GIVE_UP_MS;
    return db().update("simulation_runs", row.id, {
      status: done ? "completed" : tooOld ? "failed" : "running",
      summary,
      results: { results } as unknown as Record<string, unknown>,
      error: !done && tooOld ? "Timed out waiting for the run to finish." : null,
      completed_at: done ? new Date().toISOString() : null,
      next_check_at: done || tooOld ? null : later(60_000),
    });
  } catch (err) {
    const tooOld = Date.now() - new Date(row.created_at).getTime() > GIVE_UP_MS;
    return db().update("simulation_runs", row.id, {
      error: (err as Error).message.slice(0, 300),
      ...(tooOld ? { status: "failed" as const, next_check_at: null } : { next_check_at: later(120_000) }),
    });
  }
}

export async function processDueSimulationRuns(): Promise<number> {
  if (!bluejayConfigured()) return 0;
  const now = Date.now();
  const open = await Promise.all(
    (["queued", "running"] as const).map((status) =>
      db().list("simulation_runs", { where: { status }, orderBy: "created_at", ascending: false, limit: 50 }),
    ),
  );
  const due = open.flat().filter((r) => r.next_check_at && new Date(r.next_check_at).getTime() <= now);
  for (const r of due.slice(0, 5)) await refreshRun(r);
  return due.length;
}
