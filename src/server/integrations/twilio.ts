import { createHmac } from "node:crypto";
import { z } from "zod";
import { safeEqual } from "../crypto";
import { db, ownerName } from "../db";
import { env } from "../env";
import { normalizePhone } from "../phone";
import { getTwilioCredentials, saveTwilioCredentials, type TwilioCreds } from "./twilioCreds";
import type { IntegrationDef, ToolDef } from "./types";

/**
 * Twilio over its REST API (no SDK): outbound calls, SMS and webhook
 * signature validation. Live audio runs over Media Streams (see voice/).
 * Each tenant brings their OWN Twilio account (see twilioCreds.ts) — there is
 * no shared operator-level number.
 */

const ID = "twilio";
const MAX_OUTBOUND_PER_HOUR = 10;

async function twilioPost(creds: TwilioCreds, path: string, params: URLSearchParams) {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}/${path}.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${String(json.message ?? "request failed")}`);
  return json;
}

/** X-Twilio-Signature check: HMAC-SHA1 over URL + sorted POST params. Caller supplies the TENANT's auth token — there is no global default. */
export function isValidTwilioSignature(url: string, params: Record<string, string>, signature: string | null, authToken: string | null | undefined): boolean {
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

export async function startOutboundCall(creds: TwilioCreds, callId: string, to: string): Promise<string> {
  const base = env.publicBaseUrl();
  if (!base) throw new Error("PUBLIC_BASE_URL is not set, so Twilio can't reach Perrie.");
  const params = new URLSearchParams({
    To: to,
    From: creds.phoneNumber,
    Url: `${base}/api/twilio/voice?call_id=${encodeURIComponent(callId)}`,
    Method: "POST",
    StatusCallback: `${base}/api/twilio/status`,
    StatusCallbackMethod: "POST",
    Timeout: "30",
  });
  for (const e of ["initiated", "ringing", "answered", "completed"]) params.append("StatusCallbackEvent", e);
  const json = await twilioPost(creds, "Calls", params);
  return String(json.sid);
}

export async function hangUpCall(creds: TwilioCreds, callSid: string): Promise<void> {
  await twilioPost(creds, `Calls/${callSid}`, new URLSearchParams({ Status: "completed" }));
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
    const creds = await getTwilioCredentials(ctx.userId);
    if (!creds) throw new Error("Twilio isn't connected.");
    const hourAgo = Date.now() - 3600_000;
    const recent = (
      await db().list("calls", {
        where: { user_id: ctx.userId, direction: "outbound" },
        orderBy: "created_at",
        ascending: false,
        limit: 50,
      })
    ).filter((c) => new Date(c.created_at).getTime() > hourAgo);
    if (recent.length >= MAX_OUTBOUND_PER_HOUR) {
      throw new Error(`Safety limit: at most ${MAX_OUTBOUND_PER_HOUR} outbound calls per hour.`);
    }
    const call = await db().insert("calls", {
      user_id: ctx.userId,
      twilio_call_sid: null,
      direction: "outbound",
      role: "delegate",
      from_number: creds.phoneNumber,
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
      const sid = await startOutboundCall(creds, call.id, to);
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
    const creds = await getTwilioCredentials(ctx.userId);
    if (!creds) throw new Error("Twilio isn't connected.");
    const to = normalizePhone(input.to_number);
    if (!to || !isDialable(to)) throw new Error(`"${input.to_number}" isn't a valid number to text.`);
    const signed = `${input.body}\n— ${ctx.profile?.assistant_name ?? "Perrie"}, ${ownerName(ctx.profile)}'s assistant`;
    const json = await twilioPost(creds, "Messages", new URLSearchParams({ To: to, From: creds.phoneNumber, Body: signed }));
    return { sent: true, sid: json.sid };
  },
};

const connectInput = z.object({
  account_sid: z.string().trim().min(1, "Required."),
  auth_token: z.string().trim().min(1, "Required."),
  phone_number: z.string().trim().min(1, "Required."),
});

/** Called by the dashboard's Twilio credentials form. */
export async function connectTwilio(userId: string, raw: Record<string, unknown>): Promise<void> {
  const v = connectInput.parse(raw);
  const phoneNumber = normalizePhone(v.phone_number);
  if (!phoneNumber) throw new Error(`"${v.phone_number}" isn't a full international number (e.g. +14155550123).`);
  await saveTwilioCredentials(userId, { accountSid: v.account_sid, authToken: v.auth_token, phoneNumber });
}

export const twilio: IntegrationDef = {
  id: ID,
  name: "Twilio",
  category: "telephony",
  description: "Your own Twilio account: answers your calls, calls people for you, sends texts. Bring your own account SID, auth token and number.",
  accent: "coral",
  icon: "phone",
  connect: {
    kind: "credentials",
    fields: [
      { name: "account_sid", label: "Account SID", placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" },
      { name: "auth_token", label: "Auth token", secret: true },
      { name: "phone_number", label: "Phone number", placeholder: "+14155550123" },
    ],
  },
  async status(userId: string) {
    if (!env.publicBaseUrl()) return { connected: false, hint: "PUBLIC_BASE_URL isn't set — ask the site operator to configure it." };
    const creds = await getTwilioCredentials(userId);
    if (!creds) return { connected: false, hint: "Connect your own Twilio account SID, auth token and phone number." };
    return { connected: true, label: creds.phoneNumber };
  },
  tools: [phoneCall, sendSms],
};
