import { verifyPin } from "@/server/crypto";
import { db, getProfile, logGuardrail } from "@/server/db";
import { pinLockedOut } from "@/server/voice/pin";
import { connectStream, publicUrl, readTwilioWebhook, say, twiml, xmlEscape } from "@/server/voice/twiml";

/** Receives the keypad PIN from <Gather>. Two attempts, then guest mode. */
export async function POST(req: Request) {
  const parsed = await readTwilioWebhook(req);
  if (parsed instanceof Response) return parsed;
  const { params, url } = parsed;
  const callId = url.searchParams.get("call_id") ?? "";
  const attempt = Number(url.searchParams.get("attempt") ?? "1");

  const call = callId ? await db().get("calls", callId) : null;
  if (!call || call.twilio_call_sid !== params.CallSid) return twiml("<Hangup/>");

  const profile = await getProfile();
  const digits = (params.Digits ?? "").replace(/\D/g, "");

  if (!(await pinLockedOut()) && digits && verifyPin(digits, profile?.pin_hash)) {
    await db().update("calls", call.id, { role: "owner" });
    await logGuardrail({ kind: "owner_verified", severity: "info", detail: "Caller ID and PIN matched: owner mode.", call_id: call.id });
    return twiml(connectStream(call.id, "owner"));
  }

  await logGuardrail({
    kind: "owner_pin_failed",
    severity: "warn",
    detail: digits ? `Wrong PIN entered (attempt ${attempt}).` : `No PIN entered (attempt ${attempt}).`,
    call_id: call.id,
  });

  if (attempt < 2 && !(await pinLockedOut())) {
    const action = xmlEscape(publicUrl(`/api/twilio/voice/pin?call_id=${call.id}&attempt=${attempt + 1}`));
    return twiml(
      `<Gather input="dtmf" numDigits="8" finishOnKey="#" timeout="10" action="${action}" method="POST">` +
        say("That didn't match. Please enter your PIN again, then press pound.") +
        `</Gather><Redirect method="POST">${action}</Redirect>`,
    );
  }
  return twiml(say("I couldn't verify you, so I'll treat this as a regular call.") + connectStream(call.id, "guest"));
}
