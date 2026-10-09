import { finalizeCall } from "../agent/summarize";
import { db } from "../db";

/**
 * A call can end from two directions (media stream closes, Twilio status
 * callback). Summarise, monitor and report back exactly once.
 */
const g = globalThis as unknown as { __perrieFinalizing?: Set<string> };
const inFlight = (g.__perrieFinalizing ??= new Set<string>());

export async function finalizeCallOnce(callId: string): Promise<void> {
  if (inFlight.has(callId)) return;
  inFlight.add(callId);
  try {
    await finalizeCall(callId);
  } catch (err) {
    console.error("[voice] finalize failed", err);
  } finally {
    inFlight.delete(callId);
  }
}

/** Close out a call that ended without a clean hang-up (server restart, abandoned playground). */
export async function closeOutCall(callId: string, reason: string): Promise<void> {
  const call = await db().get("calls", callId);
  if (!call) return;
  if (call.status === "in-progress" || call.status === "dialing" || call.status === "queued" || call.status === "ringing") {
    const ended = new Date();
    const started = new Date(call.started_at ?? call.created_at);
    await db().update("calls", callId, {
      status: call.started_at ? "completed" : "failed",
      ended_at: call.ended_at ?? ended.toISOString(),
      duration_seconds: call.duration_seconds ?? Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000)),
    });
    console.warn(`[voice] closed out call ${callId}: ${reason}`);
  }
  await finalizeCallOnce(callId);
}

/**
 * On boot: Perrie runs as a single process, so any call still marked live
 * from before a restart is dead (its stream / playground session died with
 * the old process), and a call that ended without a summary was cut off
 * mid-finalisation. Close them out so they get a summary, an evaluation and —
 * for task calls — an outcome.
 */
export async function closeOutStaleCalls(): Promise<number> {
  const recent = await db().list("calls", { orderBy: "created_at", ascending: false, limit: 200 });
  const stale = recent.filter(
    (c) => ["in-progress", "dialing", "queued", "ringing"].includes(c.status) || (!!c.ended_at && !c.summary),
  );
  for (const c of stale) await closeOutCall(c.id, "unfinished when the server restarted");
  return stale.length;
}
