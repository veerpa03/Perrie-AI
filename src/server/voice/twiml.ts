import { signToken } from "../crypto";
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
 * Parse a Twilio webhook's form body. Does NOT verify the signature — Twilio
 * credentials are per-tenant now (see twilioCreds.ts), so there is no single
 * auth token to check against until the route resolves which tenant this
 * request belongs to. Every route MUST call verifyTwilioSignature once it
 * knows the tenant's auth token, before trusting params or acting on them.
 */
export async function readTwilioWebhook(req: Request): Promise<{ params: Record<string, string>; url: URL } | Response> {
  const url = new URL(req.url);
  if (!env.publicBaseUrl()) return new Response("PUBLIC_BASE_URL is not set", { status: 503 });
  const form = await req.formData();
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") params[k] = v;
  return { params, url };
}

/** Call once the tenant (and so their Twilio auth token) is known. Returns a 403 Response on failure, null on success. */
export function verifyTwilioSignature(
  req: Request,
  url: URL,
  params: Record<string, string>,
  authToken: string | null | undefined,
): Response | null {
  const base = env.publicBaseUrl()!;
  const ok = isValidTwilioSignature(`${base}${url.pathname}${url.search}`, params, req.headers.get("x-twilio-signature"), authToken);
  if (ok) return null;
  console.warn(`[twilio] rejected a request to ${url.pathname} that wasn't signed by Twilio`);
  return new Response("Forbidden", { status: 403 });
}
