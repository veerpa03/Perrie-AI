import { createHmac } from "node:crypto";
import { safeEqual } from "../crypto";
import { env } from "../env";

/**
 * Twilio (telephony layer of the voice stack) over its REST API, no SDK:
 * outbound calls, SMS, call control and webhook signature validation. Live
 * audio runs over Media Streams (see voice/). The agent-facing tools built on
 * this live in tools/telephony.ts.
 */

export async function twilioPost(path: string, params: URLSearchParams) {
  const t = env.twilio();
  if (!t) throw new Error("Twilio is not configured.");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${t.accountSid}/${path}.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${t.accountSid}:${t.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${String(json.message ?? "request failed")}`);
  return json;
}

/** X-Twilio-Signature check: HMAC-SHA1 over URL + sorted POST params. */
export function isValidTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
  authToken = env.twilio()?.authToken,
): boolean {
  if (!signature || !authToken) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const expected = createHmac("sha1", authToken).update(Buffer.from(data, "utf8")).digest("base64");
  return safeEqual(expected, signature);
}

/** Numbers Perrie must never dial on its own: emergency/short codes and premium-rate lines. */
export function isDialable(e164: string): boolean {
  const d = e164.replace(/\D/g, "");
  if (d.length < 8) return false; // 911 / 112 / 999 and SMS short codes
  if (/^1(900|976)/.test(d) || /^449/.test(d)) return false; // US / UK premium-rate
  return true;
}

export async function startOutboundCall(callId: string, to: string): Promise<string> {
  const t = env.twilio();
  const base = env.publicBaseUrl();
  if (!t) throw new Error("Twilio is not configured.");
  if (!base) throw new Error("PUBLIC_BASE_URL is not set, so Twilio can't reach Perrie.");
  const params = new URLSearchParams({
    To: to,
    From: t.phoneNumber,
    Url: `${base}/api/twilio/voice?call_id=${encodeURIComponent(callId)}`,
    Method: "POST",
    StatusCallback: `${base}/api/twilio/status`,
    StatusCallbackMethod: "POST",
    Timeout: "30",
  });
  for (const e of ["initiated", "ringing", "answered", "completed"]) params.append("StatusCallbackEvent", e);
  const json = await twilioPost("Calls", params);
  return String(json.sid);
}

export async function hangUpCall(callSid: string): Promise<void> {
  await twilioPost(`Calls/${callSid}`, new URLSearchParams({ Status: "completed" }));
}
