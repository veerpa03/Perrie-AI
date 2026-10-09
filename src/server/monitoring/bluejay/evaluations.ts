import { db, getProfile, listTurns, type CallEvaluation, type CallRecord } from "../../db";
import { env } from "../../env";
import { BluejayError, BluejayToolMissingError, bluejayConfigured, bluejayRestGet, withBluejay } from "./client";
import { buildEvaluatePayload } from "./payload";
import { getMonitoringConfig } from "./state";

/**
 * Production-call monitoring: every finished call is sent to Bluejay's
 * `evaluate` tool, then its call log is polled until Bluejay's scores
 * (goal success, hallucination, latency, sentiment, Perrie's guardrail
 * metrics, ...) are ready and stored on the call.
 *
 * BLUEJAY_EVALUATE controls which calls are sent:
 *   all (default)  phone calls + playground conversations
 *   phone          real phone calls only
 *   non-owner      phone calls with callers / people Perrie phoned (not you)
 *   off            nothing
 */

export type EvaluateMode = "all" | "phone" | "non-owner" | "off";

export function evaluateMode(): EvaluateMode {
  const v = (process.env.BLUEJAY_EVALUATE ?? "all").trim().toLowerCase();
  return v === "phone" || v === "non-owner" || v === "off" ? v : "all";
}

export function shouldEvaluate(call: CallRecord): { ok: true } | { ok: false; reason: string } {
  const mode = evaluateMode();
  if (mode === "off") return { ok: false, reason: "BLUEJAY_EVALUATE=off" };
  if (call.direction === "web" && mode !== "all") return { ok: false, reason: "playground conversations aren't sent in this mode" };
  if (mode === "non-owner" && call.role === "owner") return { ok: false, reason: "your own calls aren't sent (BLUEJAY_EVALUATE=non-owner)" };
  return { ok: true };
}

export type MetricResult = {
  name: string;
  value: string;
  reasoning: string | null;
  passed: boolean | null;
  category: string | null;
  human_edited: boolean;
};

export type EvalScores = {
  call_log_status: string;
  goal_success: boolean | null;
  goal_reasoning: string | null;
  hallucination: boolean | null;
  hallucination_reasoning: string | null;
  redundancy: boolean | null;
  sentiment_label: string | null;
  sentiment_score: number | null;
  avg_latency: number | null;
  p90_latency: number | null;
  num_turns: number | null;
  agent_speak_percentage: number | null;
  call_summary: string | null;
  custom_evals_success_rate: number | null;
  metrics: MetricResult[];
  human_edited: boolean;
};

const TRUE = new Set(["true", "yes", "pass", "passed", "1"]);
const FALSE = new Set(["false", "no", "fail", "failed", "0"]);

type RawMetric = {
  name?: string;
  response_type?: string;
  response_value?: string;
  reasoning?: string | null;
  category?: string | null;
  human_edited?: boolean | null;
  human_response_value?: string | null;
  human_reasoning?: string | null;
};

type RawEvaluation = {
  created_at?: string;
  goal_success?: boolean | null;
  goal_reasoning?: string | null;
  hallucination?: boolean | null;
  hallucination_reasoning?: string | null;
  redundancy?: boolean | null;
  sentiment_label?: string | null;
  sentiment_score?: number | null;
  avg_agent_latency?: number | null;
  latency?: { avg_agent_latency?: number | null; p90_agent_latency?: number | null } | null;
  num_turns?: number | null;
  agent_speak_percentage?: number | null;
  call_summary?: string | null;
  custom_evals_success_rate?: number | null;
  custom_metrics?: RawMetric[] | null;
  human_edited?: boolean | null;
  human_goal_success?: boolean | null;
  human_goal_reasoning?: string | null;
  human_hallucination?: boolean | null;
  human_hallucination_reasoning?: string | null;
  human_redundancy?: boolean | null;
};

export type RawCallLog = { id?: string; status?: string; evaluations?: RawEvaluation[] | null; duration_ms?: number | null };

const pref = <T>(human: T | null | undefined, model: T | null | undefined): T | null =>
  human !== null && human !== undefined ? human : (model ?? null);

/** Bluejay CallLog -> the scores Perrie shows. Human overrides win. */
export function normalizeCallLog(log: RawCallLog): EvalScores {
  const evals = [...(log.evaluations ?? [])].sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")));
  const e = evals[evals.length - 1] ?? {};
  const metrics: MetricResult[] = (e.custom_metrics ?? []).map((m) => {
    const value = String(pref(m.human_response_value, m.response_value) ?? "");
    const v = value.trim().toLowerCase();
    // Only pass/fail-style metrics have a verdict; numbers and text don't.
    const rt = (m.response_type ?? "").toLowerCase();
    const boolish = rt ? /pass_fail|yes_no|bool/.test(rt) : TRUE.has(v) || FALSE.has(v);
    return {
      name: m.name ?? "metric",
      value,
      reasoning: pref(m.human_reasoning, m.reasoning),
      passed: boolish ? (TRUE.has(v) ? true : FALSE.has(v) ? false : null) : null,
      category: m.category ?? null,
      human_edited: !!m.human_edited,
    };
  });
  return {
    call_log_status: log.status ?? "UNKNOWN",
    goal_success: pref(e.human_goal_success, e.goal_success),
    goal_reasoning: pref(e.human_goal_reasoning, e.goal_reasoning),
    hallucination: pref(e.human_hallucination, e.hallucination),
    hallucination_reasoning: pref(e.human_hallucination_reasoning, e.hallucination_reasoning),
    redundancy: pref(e.human_redundancy, e.redundancy),
    sentiment_label: e.sentiment_label ?? null,
    sentiment_score: e.sentiment_score ?? null,
    avg_latency: e.latency?.avg_agent_latency ?? e.avg_agent_latency ?? null,
    p90_latency: e.latency?.p90_agent_latency ?? null,
    num_turns: e.num_turns ?? null,
    agent_speak_percentage: e.agent_speak_percentage ?? null,
    call_summary: e.call_summary ?? null,
    custom_evals_success_rate: e.custom_evals_success_rate ?? null,
    metrics,
    human_edited: !!e.human_edited || metrics.some((m) => m.human_edited),
  };
}

// ---------------------------------------------------------------------------

const g = globalThis as unknown as { __perrieEvalBusy?: Set<string> };
const busy = (g.__perrieEvalBusy ??= new Set<string>());

const GIVE_UP_MS = 3 * 3600_000;
const later = (ms: number) => new Date(Date.now() + ms).toISOString();
const backoff = (attempts: number) => Math.min(10 * 60_000, 20_000 * 2 ** Math.max(0, attempts - 1));

async function evaluationFor(callId: string): Promise<CallEvaluation | null> {
  const [row] = await db().list("call_evaluations", { where: { call_id: callId, provider: "bluejay" }, limit: 1 });
  return row ?? null;
}

/**
 * Queue (or re-queue with force) a call for Bluejay evaluation and submit it
 * right away. Safe to call more than once: one evaluation row per call.
 */
export async function queueCallEvaluation(callId: string, opts: { force?: boolean } = {}): Promise<CallEvaluation | null> {
  if (!bluejayConfigured()) return null;
  // A call can be finalised from two paths at once; queue it only once.
  const lock = `queue:${callId}`;
  if (busy.has(lock)) return evaluationFor(callId);
  busy.add(lock);
  try {
    return await queueLocked(callId, opts);
  } finally {
    busy.delete(lock);
  }
}

async function queueLocked(callId: string, opts: { force?: boolean }): Promise<CallEvaluation | null> {
  const call = await db().get("calls", callId);
  if (!call) return null;
  const existing = await evaluationFor(callId);
  if (existing && !opts.force && existing.status !== "failed") return existing;

  let allowed = opts.force ? ({ ok: true } as const) : shouldEvaluate(call);
  if (allowed.ok && !opts.force && call.direction === "inbound" && call.from_number) {
    const sims = (await getMonitoringConfig()).simulation_numbers ?? [];
    if (sims.includes(call.from_number)) {
      allowed = { ok: false, reason: "A Bluejay simulated caller — it's scored in its guardrail test run, not here." };
    }
  }
  const base = {
    call_id: callId,
    provider: "bluejay",
    external_call_id: null,
    scores: null,
    raw: null,
    attempts: 0,
    submitted_at: null,
    completed_at: null,
  };
  const row = existing
    ? await db().update("call_evaluations", existing.id, {
        ...base,
        status: allowed.ok ? "pending" : "skipped",
        error: allowed.ok ? null : allowed.reason,
        next_check_at: allowed.ok ? new Date().toISOString() : null,
      })
    : await db()
        // One row per call: the row id IS the call id, so a concurrent
        // second insert fails instead of creating a duplicate.
        .insert("call_evaluations", {
          id: callId,
          ...base,
          status: allowed.ok ? "pending" : "skipped",
          error: allowed.ok ? null : allowed.reason,
          next_check_at: allowed.ok ? new Date().toISOString() : null,
        })
        .catch(async (err) => {
          const raced = await evaluationFor(callId);
          if (raced) return raced;
          throw err;
        });
  if (row.status === "pending") await processEvaluation(row.id);
  return db().get("call_evaluations", row.id);
}

async function submit(row: CallEvaluation): Promise<void> {
  const call = await db().get("calls", row.call_id);
  if (!call) {
    await db().update("call_evaluations", row.id, { status: "failed", error: "The call no longer exists." });
    return;
  }
  const turns = await listTurns(call.id);
  if (!turns.some((t) => t.speaker === "caller")) {
    await db().update("call_evaluations", row.id, {
      status: "skipped",
      error: "Nobody spoke on this call, so there is nothing to evaluate.",
      next_check_at: null,
    });
    return;
  }
  const [profile, config, guardrails] = await Promise.all([
    getProfile(),
    getMonitoringConfig(),
    db().list("guardrail_events", { where: { call_id: call.id }, orderBy: "created_at" }),
  ]);
  const body = buildEvaluatePayload({
    call,
    turns,
    guardrails,
    profile,
    externalAgentId: config.agent_external_id,
    agentNumber: env.twilio()?.phoneNumber ?? null,
    withGuardrailMetrics: (config.metric_names?.length ?? 0) > 0,
  });
  const res = await withBluejay((s) => s.call<{ status?: string; call_id?: string; message?: string }>("evaluate", body));
  if (!res?.call_id) throw new BluejayError(`evaluate returned no call_id (${JSON.stringify(res).slice(0, 200)})`, "evaluate", res);
  await db().update("call_evaluations", row.id, {
    status: "submitted",
    external_call_id: String(res.call_id),
    submitted_at: new Date().toISOString(),
    attempts: 0,
    error: null,
    next_check_at: later(20_000),
  });
}

export async function fetchCallLog(externalCallId: string): Promise<RawCallLog> {
  const viaMcp = await withBluejay(async (s) => {
    const tool = s.pick("retrieve_call_log", "get_call_log");
    if (!tool) return null;
    return s.call<{ call_log?: RawCallLog } & RawCallLog>(tool, { call_id: externalCallId });
  }, 30_000);
  // No MCP tool for reading a call log: use the read-only REST endpoint.
  const data = viaMcp ?? (await bluejayRestGet<{ call_log?: RawCallLog } & RawCallLog>(`/v1/retrieve-call-log/${encodeURIComponent(externalCallId)}`));
  return (data?.call_log ?? data) as RawCallLog;
}

/** Keep the latest evaluation only, capped in size, for the "raw" view. */
function trimRaw(log: RawCallLog): Record<string, unknown> {
  const kept = { id: log.id ?? null, status: log.status ?? null, duration_ms: log.duration_ms ?? null, evaluation: log.evaluations?.at(-1) ?? null };
  const s = JSON.stringify(kept);
  return s.length <= 20_000 ? kept : { id: kept.id, status: kept.status, truncated: true };
}

async function poll(row: CallEvaluation): Promise<void> {
  const log = await fetchCallLog(row.external_call_id!);
  const status = String(log.status ?? "").toUpperCase();
  const hasEval = !!log.evaluations?.length;
  if (status === "COMPLETED" || (hasEval && status !== "EVALUATING" && status !== "QUEUED")) {
    const scores = normalizeCallLog(log);
    await db().update("call_evaluations", row.id, {
      status: "completed",
      scores: scores as unknown as Record<string, unknown>,
      raw: trimRaw(log),
      completed_at: new Date().toISOString(),
      next_check_at: null,
      error: null,
    });
    return;
  }
  if (status === "INCOMPLETED") {
    await db().update("call_evaluations", row.id, {
      status: "failed",
      error: "Bluejay couldn't complete the evaluation (INCOMPLETED).",
      next_check_at: null,
    });
    return;
  }
  const waited = Date.now() - new Date(row.submitted_at ?? row.created_at).getTime();
  if (waited > GIVE_UP_MS) {
    await db().update("call_evaluations", row.id, { status: "failed", error: "Timed out waiting for Bluejay's scores.", next_check_at: null });
    return;
  }
  const attempts = row.attempts + 1;
  await db().update("call_evaluations", row.id, { status: "evaluating", attempts, next_check_at: later(backoff(attempts)) });
}

/** Advance one evaluation (submit or poll). Never throws. */
export async function processEvaluation(id: string): Promise<void> {
  if (busy.has(id)) return;
  busy.add(id);
  try {
    const row = await db().get("call_evaluations", id);
    if (!row) return;
    try {
      if (row.status === "pending") await submit(row);
      else if ((row.status === "submitted" || row.status === "evaluating") && row.external_call_id) await poll(row);
    } catch (err) {
      // Give up only on a permanent problem or after GIVE_UP_MS overall —
      // "attempts" also counts ordinary not-ready-yet polls.
      const attempts = row.attempts + 1;
      const age = Date.now() - new Date(row.created_at).getTime();
      const permanent = err instanceof BluejayToolMissingError || age > GIVE_UP_MS;
      await db().update("call_evaluations", row.id, {
        attempts,
        error: (err as Error).message.slice(0, 500),
        status: permanent ? "failed" : row.status,
        next_check_at: permanent ? null : later(backoff(attempts)),
      });
    }
  } finally {
    busy.delete(id);
  }
}

/** Called by the background poller: submit/poll everything that's due. */
export async function processDueEvaluations(limit = 20): Promise<number> {
  if (!bluejayConfigured()) return 0;
  const now = Date.now();
  // Query each open status separately (equality filters work the same in
  // Supabase and the local store; completed rows never crowd them out).
  const byStatus = await Promise.all(
    (["pending", "submitted", "evaluating"] as const).map((status) =>
      db().list("call_evaluations", { where: { status }, orderBy: "created_at", ascending: false, limit: 200 }),
    ),
  );
  const open = byStatus
    .flat()
    .filter((r) => r.next_check_at && new Date(r.next_check_at).getTime() <= now)
    .sort((a, b) => String(a.next_check_at).localeCompare(String(b.next_check_at)));
  for (const r of open.slice(0, limit)) await processEvaluation(r.id);
  return Math.min(open.length, limit);
}
