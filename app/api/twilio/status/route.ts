import { db, findCallBySid } from "@/server/db";
import { getTwilioCredentials } from "@/server/integrations/twilioCreds";
import { finalizeCallOnce } from "@/server/voice/finalize";
import { readTwilioWebhook, verifyTwilioSignature } from "@/server/voice/twiml";

const TERMINAL = new Set(["completed", "busy", "no-answer", "failed", "canceled"]);

/**
 * Twilio call status callback — only sent for calls Perrie places (see
 * startOutboundCall), so the call row (and its tenant) always exists by now.
 */
export async function POST(req: Request) {
  const parsed = await readTwilioWebhook(req);
  if (parsed instanceof Response) return parsed;
  const { params, url } = parsed;
  const call = await findCallBySid(params.CallSid ?? "");
  if (!call || !call.user_id) return new Response(null, { status: 204 });
  const creds = await getTwilioCredentials(call.user_id);
  const forbidden = verifyTwilioSignature(req, url, params, creds?.authToken);
  if (forbidden) return forbidden;

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
