import { env } from "../env";
import { LocalStore } from "./localStore";
import { SupabaseStore } from "./supabaseStore";
import type {
  CallRecord,
  CallTurn,
  GuardrailEvent,
  Insert,
  OwnerProfile,
  Patch,
  ProfileFact,
  Severity,
  Store,
  TaskStep,
} from "./types";

export * from "./types";

/**
 * One store per process, kept on globalThis: the custom server (voice
 * gateway) and Next's bundled route handlers run in the same process but load
 * separate module copies, and they must share state.
 */
const g = globalThis as unknown as { __perrieStore?: Store; __perrieTurnSeq?: Map<string, number> };

export function db(): Store {
  if (g.__perrieStore) return g.__perrieStore;
  const sb = env.supabase();
  g.__perrieStore = sb ? new SupabaseStore(sb.url, sb.key) : new LocalStore();
  return g.__perrieStore;
}

// ---------------------------------------------------------------------------
// Owner profile
// ---------------------------------------------------------------------------

export async function getProfile(): Promise<OwnerProfile | null> {
  const [p] = await db().list("owner_profile", { limit: 1 });
  return p ?? null;
}

export async function saveProfile(
  input: Omit<Insert<"owner_profile">, "pin_hash"> & { pin_hash?: string | null },
): Promise<OwnerProfile> {
  const existing = await getProfile();
  if (existing) {
    const patch: Patch<"owner_profile"> = { ...input };
    if (input.pin_hash === undefined) delete patch.pin_hash;
    return db().update("owner_profile", existing.id, patch);
  }
  return db().insert("owner_profile", { ...input, pin_hash: input.pin_hash ?? null });
}

export const listFacts = () => db().list("profile_facts", { orderBy: "created_at" });

/** Facts visible to a given audience. Private facts are owner-only. */
export async function factsFor(audience: "owner" | "others"): Promise<ProfileFact[]> {
  const all = await listFacts();
  return audience === "owner" ? all : all.filter((f) => f.visibility === "shareable");
}

/** Display name used when speaking to or about the owner. */
export const ownerName = (p: OwnerProfile | null) => p?.preferred_name || p?.full_name || "the owner";

// ---------------------------------------------------------------------------
// Calls + transcripts
// ---------------------------------------------------------------------------

export const listCalls = (limit = 50) => db().list("calls", { orderBy: "created_at", ascending: false, limit });

export async function findCallBySid(sid: string): Promise<CallRecord | null> {
  const [c] = await db().list("calls", { where: { twilio_call_sid: sid }, limit: 1 });
  return c ?? null;
}

export const listTurns = (callId: string) =>
  db().list("call_turns", { where: { call_id: callId }, orderBy: "seq" });

const turnCounters = (g.__perrieTurnSeq ??= new Map<string, number>());

export async function addTurn(
  callId: string,
  speaker: CallTurn["speaker"],
  text: string,
  meta: Record<string, unknown> = {},
): Promise<CallTurn> {
  let seq = turnCounters.get(callId);
  if (seq === undefined) seq = (await listTurns(callId)).length;
  turnCounters.set(callId, seq + 1);
  return db().insert("call_turns", { call_id: callId, seq, speaker, text, meta });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const listTasks = (limit = 50) => db().list("tasks", { orderBy: "created_at", ascending: false, limit });

export const listSteps = (taskId: string): Promise<TaskStep[]> =>
  db().list("task_steps", { where: { task_id: taskId }, orderBy: "position" });

// ---------------------------------------------------------------------------
// Messages + guardrails
// ---------------------------------------------------------------------------

export const listMessages = (limit = 50) =>
  db().list("messages", { orderBy: "created_at", ascending: false, limit });

export async function logGuardrail(e: {
  kind: string;
  detail: string;
  severity?: Severity;
  call_id?: string | null;
  task_id?: string | null;
  meta?: Record<string, unknown>;
}): Promise<GuardrailEvent | null> {
  try {
    return await db().insert("guardrail_events", {
      kind: e.kind,
      detail: e.detail,
      severity: e.severity ?? "info",
      call_id: e.call_id ?? null,
      task_id: e.task_id ?? null,
      meta: e.meta ?? {},
    });
  } catch (err) {
    // Logging must never break a live call.
    console.error("[guardrail] failed to log", err);
    return null;
  }
}

export const listGuardrails = (limit = 50) =>
  db().list("guardrail_events", { orderBy: "created_at", ascending: false, limit });
