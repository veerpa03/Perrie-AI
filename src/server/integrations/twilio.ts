import { createHmac } from "node:crypto";
import { z } from "zod";
import { safeEqual } from "../crypto";
import { db, ownerName } from "../db";
import { env } from "../env";
import { normalizePhone } from "../phone";
import type { IntegrationDef, ToolDef } from "./types";

/**
 * Twilio over its REST API (no SDK): outbound calls, SMS and webhook
 * signature validation. Live audio runs over Media Streams (see voice/).
 */

const ID = "twilio";
const MAX_OUTBOUND_PER_HOUR = 10;

async function twilioPost(path: string, params: URLSearchParams) {
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

const callInput = z.object({
  to_number: z.string().describe("E.164 number, e.g. +14155550123 — from contacts or given by the owner, never guessed."),
  contact_name: z.string().min(1).max(120).describe("Who Perrie is calling."),
  mission: z
    .string()
    .min(10)
    .max(1500)
    .describe(
      "Exactly what to achieve on the call and what Perrie may agree to / share. Written as an instruction from the owner.",
    ),
});

const phoneCall: ToolDef = {
  name: "phone_call",
  integration: ID,
  description:
    "Phone someone on the owner's behalf with a clear mission. Perrie discloses it is an AI assistant, follows only the mission, and reports the outcome when the call ends.",
  input: callInput,
  roles: ["system"],
  sideEffect: true,
  async: true,
  describe: (i: z.infer<typeof callInput>) => `call ${i.contact_name} (${i.to_number}) to ${i.mission}`,
  async run(input: z.infer<typeof callInput>, ctx) {
    const to = normalizePhone(input.to_number);
    if (!to) throw new Error(`"${input.to_number}" isn't a valid international number.`);
    if (!isDialable(to)) throw new Error("Perrie won't place calls to emergency or short-code numbers.");
    const hourAgo = Date.now() - 3600_000;
    const recent = (await db().list("calls", { where: { direction: "outbound" }, orderBy: "created_at", ascending: false, limit: 50 }))
      .filter((c) => new Date(c.created_at).getTime() > hourAgo);
    if (recent.length >= MAX_OUTBOUND_PER_HOUR) {
      throw new Error(`Safety limit: at most ${MAX_OUTBOUND_PER_HOUR} outbound calls per hour.`);
    }
    const call = await db().insert("calls", {
      twilio_call_sid: null,
      direction: "outbound",
      role: "delegate",
      from_number: env.twilio()?.phoneNumber ?? null,
      to_number: to,
      counterpart_name: input.contact_name,
      status: "queued",
      mission: input.mission,
      summary: null,
      outcome: null,
      task_id: ctx.taskId ?? null,
      task_step_id: ctx.stepId ?? null,
      started_at: null,
      ended_at: null,
      duration_seconds: null,
    });
    try {
      const sid = await startOutboundCall(call.id, to);
      await db().update("calls", call.id, { twilio_call_sid: sid, status: "dialing" });
    } catch (err) {
      await db().update("calls", call.id, { status: "failed", summary: (err as Error).message });
      throw err;
    }
    return { call_id: call.id, status: "dialing", note: "Call placed; the outcome is reported when it ends." };
  },
};

const smsInput = z.object({
  to_number: z.string(),
  body: z.string().min(1).max(600),
});

const sendSms: ToolDef = {
  name: "send_sms",
  integration: ID,
  description: "Send a text message on the owner's behalf. The text is signed as coming from the owner's assistant.",
  input: smsInput,
  roles: ["owner", "system"],
  sideEffect: true,
  describe: (i: z.infer<typeof smsInput>) => `text ${i.to_number}: "${i.body}"`,
  async run(input: z.infer<typeof smsInput>, ctx) {
    const t = env.twilio();
    if (!t) throw new Error("Twilio is not configured.");
    const to = normalizePhone(input.to_number);
    if (!to || !isDialable(to)) throw new Error(`"${input.to_number}" isn't a valid number to text.`);
    const signed = `${input.body}\n— ${ctx.profile?.assistant_name ?? "Perrie"}, ${ownerName(ctx.profile)}'s assistant`;
    const json = await twilioPost("Messages", new URLSearchParams({ To: to, From: t.phoneNumber, Body: signed }));
    return { sent: true, sid: json.sid };
  },
};

export const twilio: IntegrationDef = {
  id: ID,
  name: "Twilio",
  category: "telephony",
  description: "Your assistant's phone number: answers your calls, calls people for you, sends texts.",
  accent: "coral",
  icon: "phone",
  connect: { kind: "env", vars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "PUBLIC_BASE_URL"] },
  async status() {
    const t = env.twilio();
    if (!t) return { connected: false, hint: "Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER." };
    if (!env.publicBaseUrl()) return { connected: false, label: t.phoneNumber, hint: "Set PUBLIC_BASE_URL so Twilio can reach Perrie." };
    return { connected: true, label: t.phoneNumber };
  },
  tools: [phoneCall, sendSms],
};
