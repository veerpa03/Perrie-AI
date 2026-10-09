import { db, findCallBySid } from "@/server/db";
import { finalizeCallOnce } from "@/server/voice/finalize";
import { readTwilioWebhook } from "@/server/voice/twiml";

const TERMINAL = new Set(["completed", "busy", "no-answer", "failed", "canceled"]);

/** Twilio call status callback (set automatically for calls Perrie places). */
export async function POST(req: Request) {
  const parsed = await readTwilioWebhook(req);
  if (parsed instanceof Response) return parsed;
  const { params } = parsed;
  const call = await findCallBySid(params.CallSid ?? "");
  if (!call) return new Response(null, { status: 204 });

  const status = params.CallStatus ?? call.status;
  const terminal = TERMINAL.has(status);
  await db().update("calls", call.id, {
    status: call.status === "completed" && status !== "completed" ? call.status : status,
    ...(terminal
      ? {
          ended_at: call.ended_at ?? new Date().toISOString(),
          duration_seconds: params.CallDuration ? Number(params.CallDuration) : call.duration_seconds,
        }
      : {}),
  });

  // Calls that never connected (no answer, busy, failed) have no media stream
  // to finalise them, so do it here. Connected calls finalise when the
  // stream closes.
  if (terminal && !call.started_at) void finalizeCallOnce(call.id);
  return new Response(null, { status: 204 });
}
