import type { CallRecord, CallTurn, GuardrailEvent, OwnerProfile } from "../../db/types";

/**
 * Builds the body for Bluejay's `evaluate` tool (POST /v1/evaluate,
 * CallRequestUsingExternalAgentID) from a finished Perrie call. Field names
 * and enums follow Bluejay's API models exactly:
 *   required: external_agent_id, start_time_utc, participants[{role}]
 *   transcript[{start_offset_ms, end_offset_ms, speaker: AGENT|USER, utterance}]
 *   tool_calls[{name, start_offset_ms, ...}], events[{title, start_offset_ms, ...}]
 *   call_direction INBOUND|OUTBOUND, interface PHONE|WEB, conversation_ended_by AGENT|USER
 *
 * Offsets are measured from the call's start using the times Perrie logged
 * each turn, so they are close to (not exactly) when words were spoken.
 */

export const GUARDRAIL_METRIC_TAG = "perrie-guardrails";

export type EvaluateBody = {
  external_agent_id: string;
  start_time_utc: string;
  participants: { role: "AGENT" | "USER"; name?: string; phone_number?: string; spoke_first?: boolean }[];
  transcript: { start_offset_ms: number; end_offset_ms: number; speaker: "AGENT" | "USER"; utterance: string }[];
  tool_calls?: { name: string; start_offset_ms: number; description?: string; parameters?: Record<string, unknown>; output?: unknown }[];
  events?: { title: string; start_offset_ms: number; description?: string; tags?: string[]; metadata?: Record<string, unknown> }[];
  call_direction: "INBOUND" | "OUTBOUND";
  interface: "PHONE" | "WEB";
  conversation_ended_by?: "AGENT" | "USER";
  tags: string[];
  trace_id: string;
  metadata: Record<string, unknown>;
  custom_metric_tags?: string[];
};

const MS_PER_WORD = 380; // ~158 wpm speaking rate, used to estimate utterance length
const MAX_JSON = 2000;

function trimJson(v: unknown): unknown {
  if (v === undefined) return undefined;
  const s = JSON.stringify(v);
  if (s === undefined || s.length <= MAX_JSON) return v;
  return { truncated: true, preview: s.slice(0, MAX_JSON) };
}

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner (verified)",
  guest: "Caller",
  delegate: "Person called on the owner's behalf",
  unverified: "Caller",
};

export function buildEvaluatePayload(opts: {
  call: CallRecord;
  turns: CallTurn[];
  guardrails: GuardrailEvent[];
  profile: OwnerProfile | null;
  externalAgentId: string;
  agentNumber: string | null;
  withGuardrailMetrics: boolean;
}): EvaluateBody {
  const { call, turns, guardrails, profile } = opts;
  const startIso = call.started_at ?? turns[0]?.created_at ?? call.created_at;
  const start = new Date(startIso).getTime();
  const offset = (iso: string) => Math.max(0, new Date(iso).getTime() - start);

  const spoken = turns.filter((t) => t.speaker === "caller" || t.speaker === "agent").sort((a, b) => a.seq - b.seq);
  const transcript: EvaluateBody["transcript"] = [];
  let cursor = 0;
  spoken.forEach((t, i) => {
    const words = t.text.trim().split(/\s+/).filter(Boolean).length || 1;
    const loggedAt = offset(t.created_at);
    const estimated = words * MS_PER_WORD;
    // Perrie logs a caller turn when they finish speaking, and an agent turn
    // when its reply is ready; estimate the span and keep offsets monotonic.
    const begin = Math.max(cursor, t.speaker === "caller" ? loggedAt - estimated : loggedAt);
    const next = spoken[i + 1] ? offset(spoken[i + 1].created_at) : Number.POSITIVE_INFINITY;
    const end = Math.max(begin + 1, Math.min(begin + estimated, Number.isFinite(next) && next > begin ? next : begin + estimated));
    transcript.push({
      start_offset_ms: Math.round(begin),
      end_offset_ms: Math.round(end),
      speaker: t.speaker === "agent" ? "AGENT" : "USER",
      utterance: t.text,
    });
    cursor = end;
  });

  const toolTurns = turns.filter((t) => t.speaker === "tool");
  // With the owner, tools touch private data (calendar, contacts, messages):
  // send only which tool ran and whether it worked, never its inputs/outputs.
  const ownerCall = call.role === "owner";
  const tool_calls = toolTurns.map((t) => {
    const meta = t.meta as { tool?: string; ok?: boolean; blocked?: boolean; input?: unknown; output?: unknown };
    const name = meta.tool ?? t.text.split(" ")[0];
    if (ownerCall) {
      return { name, start_offset_ms: offset(t.created_at), description: meta.ok === false ? `${name} failed` : `${name} ran` };
    }
    return {
      name,
      start_offset_ms: offset(t.created_at),
      description: t.text.slice(0, 300),
      parameters: (trimJson(meta.input) as Record<string, unknown> | undefined) ?? undefined,
      output: trimJson(meta.ok === false ? { ok: false, blocked: !!meta.blocked, message: t.text } : meta.output),
    };
  });

  const events: NonNullable<EvaluateBody["events"]> = [
    ...turns
      .filter((t) => t.speaker === "system")
      .map((t) => ({ title: "Confirmation required", start_offset_ms: offset(t.created_at), description: t.text, tags: ["guardrail"] })),
    ...guardrails.map((gr) => ({
      title: gr.kind.replace(/_/g, " "),
      start_offset_ms: offset(gr.created_at),
      description: gr.detail,
      tags: ["guardrail", gr.severity],
      metadata: { kind: gr.kind, severity: gr.severity },
    })),
  ].sort((a, b) => a.start_offset_ms - b.start_offset_ms);

  const lastTool = toolTurns[toolTurns.length - 1];
  const endedByAgent = !!lastTool && (lastTool.meta as { tool?: string }).tool === "end_call";
  const otherNumber = call.direction === "outbound" ? call.to_number : call.from_number;

  const body: EvaluateBody = {
    external_agent_id: opts.externalAgentId,
    start_time_utc: new Date(startIso).toISOString(),
    participants: [
      {
        role: "AGENT",
        name: profile?.assistant_name ?? "Perrie",
        ...(opts.agentNumber ? { phone_number: opts.agentNumber } : {}),
        spoke_first: true,
      },
      {
        role: "USER",
        name: call.role === "owner" ? "Owner" : (call.counterpart_name ?? ROLE_LABEL[call.role] ?? "Caller"),
        ...(otherNumber && call.direction !== "web" && !ownerCall ? { phone_number: otherNumber } : {}),
        spoke_first: false,
      },
    ],
    transcript,
    call_direction: call.direction === "outbound" ? "OUTBOUND" : "INBOUND",
    interface: call.direction === "web" ? "WEB" : "PHONE",
    tags: ["perrie", `role:${call.role}`, `direction:${call.direction}`, ...(call.direction === "web" ? ["playground"] : [])],
    trace_id: call.id,
    metadata: {
      perrie_call_id: call.id,
      perrie_role: call.role,
      perrie_status: call.status,
      duration_seconds: call.duration_seconds,
      ...(call.mission ? { mission: call.mission } : {}),
      ...(call.summary ? { perrie_summary: call.summary } : {}),
      transcript_offsets: "estimated from logged turn times",
    },
  };
  if (tool_calls.length) body.tool_calls = tool_calls;
  if (events.length) body.events = events;
  if (transcript.length) body.conversation_ended_by = endedByAgent ? "AGENT" : "USER";
  if (opts.withGuardrailMetrics) body.custom_metric_tags = [GUARDRAIL_METRIC_TAG];
  return body;
}
