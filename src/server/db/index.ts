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
  Row,
  Severity,
  Store,
  TableName,
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

/**
 * Tenant isolation lives here, not in the Store interface: every read below
 * filters by `where: { user_id }`, every insert stamps it, and every
 * update/remove-by-id (`assertOwned`) fetches first and checks ownership so
 * a guessed id from another tenant 404s instead of leaking data. Supabase
 * RLS has no policies (service-role access only) — this is the actual
 * tenant boundary.
 */
async function assertOwned<T extends TableName>(table: T, id: string, userId: string): Promise<Row<T>> {
  const row = await db().get(table, id);
  if (!row || row.user_id !== userId) throw new Error(`Not found: ${table}/${id}`);
  return row;
}

// ---------------------------------------------------------------------------
// Owner profile
// ---------------------------------------------------------------------------

export async function getProfile(userId: string): Promise<OwnerProfile | null> {
  const [p] = await db().list("owner_profile", { where: { user_id: userId }, limit: 1 });
  return p ?? null;
}

/**
 * Inbound Twilio calls arrive knowing only the dialed number — this resolves
 * the tenant. Every tenant brings their own Twilio number (see
 * src/server/integrations/twilioCreds.ts), so this is always an exact match;
 * there is no "the one unassigned profile" fallback anymore — that only ever
 * worked for a single tenant.
 */
export async function getProfileByPhoneNumber(toNumber: string | null): Promise<OwnerProfile | null> {
  if (!toNumber) return null;
  const [byNumber] = await db().list("owner_profile", { where: { assistant_phone_number: toNumber }, limit: 1 });
  return byNumber ?? null;
}

export async function saveProfile(
  userId: string,
  input: Omit<Insert<"owner_profile">, "pin_hash" | "user_id" | "assistant_phone_number"> & {
    pin_hash?: string | null;
    assistant_phone_number?: string | null;
  },
): Promise<OwnerProfile> {
  const existing = await getProfile(userId);
  if (existing) {
    const patch: Patch<"owner_profile"> = { ...input };
    if (input.pin_hash === undefined) delete patch.pin_hash;
    if (input.assistant_phone_number === undefined) delete patch.assistant_phone_number;
    return db().update("owner_profile", existing.id, patch);
  }
  return db().insert("owner_profile", {
    ...input,
    user_id: userId,
    pin_hash: input.pin_hash ?? null,
    assistant_phone_number: input.assistant_phone_number ?? null,
  });
}

export const listFacts = (userId: string) =>
  db().list("profile_facts", { where: { user_id: userId }, orderBy: "created_at" });

/** Facts visible to a given audience. Private facts are owner-only. */
export async function factsFor(userId: string, audience: "owner" | "others"): Promise<ProfileFact[]> {
  const all = await listFacts(userId);
  return audience === "owner" ? all : all.filter((f) => f.visibility === "shareable");
}

/** Display name used when speaking to or about the owner. */
export const ownerName = (p: OwnerProfile | null) => p?.preferred_name || p?.full_name || "the owner";

// ---------------------------------------------------------------------------
// Calls + transcripts
// ---------------------------------------------------------------------------

export const listCalls = (userId: string, limit = 50) =>
  db().list("calls", { where: { user_id: userId }, orderBy: "created_at", ascending: false, limit });

export async function findCallBySid(sid: string): Promise<CallRecord | null> {
  const [c] = await db().list("calls", { where: { twilio_call_sid: sid }, limit: 1 });
  return c ?? null;
}

export const listTurns = async (userId: string, callId: string) => {
  await assertOwned("calls", callId, userId);
  return db().list("call_turns", { where: { call_id: callId }, orderBy: "seq" });
};

const turnCounters = (g.__perrieTurnSeq ??= new Map<string, number>());

export async function addTurn(
  userId: string,
  callId: string,
  speaker: CallTurn["speaker"],
  text: string,
  meta: Record<string, unknown> = {},
): Promise<CallTurn> {
  let seq = turnCounters.get(callId);
  if (seq === undefined) seq = (await db().list("call_turns", { where: { call_id: callId } })).length;
  turnCounters.set(callId, seq + 1);
  return db().insert("call_turns", { user_id: userId, call_id: callId, seq, speaker, text, meta });
}

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

export const listTasks = (userId: string, limit = 50) =>
  db().list("tasks", { where: { user_id: userId }, orderBy: "created_at", ascending: false, limit });

export const listSteps = async (userId: string, taskId: string): Promise<TaskStep[]> => {
  await assertOwned("tasks", taskId, userId);
  return db().list("task_steps", { where: { task_id: taskId }, orderBy: "position" });
};

// ---------------------------------------------------------------------------
// Messages + guardrails
// ---------------------------------------------------------------------------

export const listMessages = (userId: string, limit = 50) =>
  db().list("messages", { where: { user_id: userId }, orderBy: "created_at", ascending: false, limit });

export async function logGuardrail(e: {
  userId: string;
  kind: string;
  detail: string;
  severity?: Severity;
  call_id?: string | null;
  task_id?: string | null;
  meta?: Record<string, unknown>;
}): Promise<GuardrailEvent | null> {
  try {
    return await db().insert("guardrail_events", {
      user_id: e.userId,
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

export const listGuardrails = (userId: string, limit = 50) =>
  db().list("guardrail_events", { where: { user_id: userId }, orderBy: "created_at", ascending: false, limit });
