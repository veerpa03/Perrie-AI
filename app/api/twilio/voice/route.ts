import { db, findCallBySid, getProfile, logGuardrail } from "@/server/db";
import { env } from "@/server/env";
import { samePhone } from "@/server/phone";
import { connectStream, publicUrl, readTwilioWebhook, say, twiml, xmlEscape } from "@/server/voice/twiml";
import { pinLockedOut } from "@/server/voice/pin";

/**
 * Twilio voice webhook — set it as your number's "A call comes in" URL:
 *   POST {PUBLIC_BASE_URL}/api/twilio/voice
 * Also used (with ?call_id=) when Perrie places a call on your behalf.
 */
export async function POST(req: Request) {
  const parsed = await readTwilioWebhook(req);
  if (parsed instanceof Response) return parsed;
  const { params, url } = parsed;
  const callSid = params.CallSid;

  if (!env.deepgram() || !env.anthropic()) {
    return twiml(`${say("Sorry, this assistant isn't fully set up yet. Please try again later.")}<Hangup/>`);
  }

  // Outbound: a call Perrie placed for a task.
  const outboundId = url.searchParams.get("call_id");
  if (outboundId) {
    const call = await db().get("calls", outboundId);
    if (!call || call.direction !== "outbound" || (call.twilio_call_sid && call.twilio_call_sid !== callSid)) {
      return twiml("<Hangup/>");
    }
    await db().update("calls", call.id, { twilio_call_sid: callSid, status: "in-progress" });
    return twiml(connectStream(call.id, "delegate"));
  }

  // Inbound.
  const existing = await findCallBySid(callSid);
  const call =
    existing ??
    (await db().insert("calls", {
      twilio_call_sid: callSid,
      direction: "inbound",
      role: "unverified",
      from_number: params.From ?? null,
      to_number: params.To ?? null,
      counterpart_name: null,
      status: "ringing",
      mission: null,
      summary: null,
      outcome: null,
      task_id: null,
      task_step_id: null,
      started_at: null,
      ended_at: null,
      duration_seconds: null,
    }));

  const profile = await getProfile();
  const fromOwnerNumber = !!profile?.phone_numbers.some((n) => samePhone(n, params.From));

  if (fromOwnerNumber && profile?.pin_hash) {
    if (await pinLockedOut()) {
      await logGuardrail({
        kind: "owner_pin_locked",
        severity: "block",
        detail: "Too many wrong PINs in the last hour — owner mode locked; call treated as a guest.",
        call_id: call.id,
      });
      return twiml(connectStream(call.id, "guest"));
    }
    const action = xmlEscape(publicUrl(`/api/twilio/voice/pin?call_id=${call.id}&attempt=1`));
    return twiml(
      `<Gather input="dtmf" numDigits="8" finishOnKey="#" timeout="10" action="${action}" method="POST">` +
        say("Hi! Please enter your PIN, then press pound.") +
        `</Gather><Redirect method="POST">${action}</Redirect>`,
    );
  }

  if (fromOwnerNumber) {
    await logGuardrail({
      kind: "owner_without_pin",
      severity: "warn",
      detail: "Call from your number, but no PIN is set — treated as a guest. Set a PIN in your profile to unlock owner mode.",
      call_id: call.id,
    });
  }
  return twiml(connectStream(call.id, "guest"));
}
