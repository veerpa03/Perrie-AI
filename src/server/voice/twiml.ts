import { signToken } from "../crypto";
import { logGuardrail } from "../db";
import { env } from "../env";
import { isValidTwilioSignature } from "../integrations/twilio";

/** TwiML + webhook helpers for the /api/twilio/* route handlers. */

export const xmlEscape = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export function twiml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "Content-Type": "text/xml; charset=utf-8", "Cache-Control": "no-store" },
  });
}

const SAY_VOICE = "Polly.Joanna-Neural";
export const say = (text: string) => `<Say voice="${SAY_VOICE}">${xmlEscape(text)}</Say>`;

export const publicUrl = (pathAndQuery: string) => `${env.publicBaseUrl()}${pathAndQuery}`;

/** <Connect><Stream> with a short-lived signed token naming the call + role. */
export function connectStream(callId: string, role: "owner" | "guest" | "delegate"): string {
  const wss = `${env.publicBaseUrl()!.replace(/^http/, "ws")}/api/twilio/stream`;
  const token = signToken({ callId, role }, 300);
  return `<Connect><Stream url="${xmlEscape(wss)}"><Parameter name="token" value="${xmlEscape(token)}"/></Stream></Connect>`;
}

/**
 * Parse a Twilio webhook and verify X-Twilio-Signature against the public
 * URL Twilio called. Returns the params, or a 403 Response.
 */
export async function readTwilioWebhook(req: Request): Promise<{ params: Record<string, string>; url: URL } | Response> {
  const url = new URL(req.url);
  const base = env.publicBaseUrl();
  if (!base || !env.twilio()) return new Response("Twilio is not configured", { status: 503 });
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
  const ok = isValidTwilioSignature(`${base}${url.pathname}${url.search}`, params, req.headers.get("x-twilio-signature"));
  if (!ok) {
    await logGuardrail({
      kind: "twilio_signature_invalid",
      severity: "block",
      detail: `Rejected a request to ${url.pathname} that wasn't signed by Twilio.`,
    });
    return new Response("Forbidden", { status: 403 });
  }
  return { params, url };
}
