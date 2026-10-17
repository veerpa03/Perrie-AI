import { decryptJSON, encryptJSON } from "../crypto";
import { db } from "../db";

/**
 * Per-tenant Twilio credentials. Each tenant brings their own Twilio account
 * (account SID, auth token, phone number) instead of sharing one operator-
 * level number — this is what makes the phone channel actually multi-tenant.
 * Stored the same way Google OAuth tokens are: AES-GCM encrypted in
 * integrations.credentials_enc (see google/oauth.ts for the identical pattern).
 */

const ID = "twilio";

export type TwilioCreds = { accountSid: string; authToken: string; phoneNumber: string };

async function findRow(userId: string) {
  const [row] = await db().list("integrations", { where: { user_id: userId, integration: ID }, limit: 1 });
  return row ?? null;
}

/** Confirms the credentials actually work before saving them. */
async function verify(creds: TwilioCreds): Promise<void> {
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${creds.accountSid}.json`, {
    headers: { Authorization: `Basic ${Buffer.from(`${creds.accountSid}:${creds.authToken}`).toString("base64")}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(res.status === 401 ? "That account SID / auth token pair was rejected by Twilio." : `Twilio API ${res.status}.`);
}

export async function saveTwilioCredentials(userId: string, creds: TwilioCreds): Promise<void> {
  await verify(creds);
  const [claimedBy] = await db().list("owner_profile", { where: { assistant_phone_number: creds.phoneNumber }, limit: 1 });
  if (claimedBy && claimedBy.user_id !== userId) {
    throw new Error(`${creds.phoneNumber} is already connected to another Perrie account.`);
  }
  const existing = await findRow(userId);
  const patch = {
    status: "connected" as const,
    account_label: creds.phoneNumber,
    credentials_enc: encryptJSON(creds),
    scopes: [],
    meta: {},
    connected_at: new Date().toISOString(),
  };
  if (existing) await db().update("integrations", existing.id, patch);
  else await db().insert("integrations", { user_id: userId, integration: ID, ...patch });
  // The profile row is the lookup key for inbound calls (getProfileByPhoneNumber).
  const [profile] = await db().list("owner_profile", { where: { user_id: userId }, limit: 1 });
  if (profile) await db().update("owner_profile", profile.id, { assistant_phone_number: creds.phoneNumber });
}

export async function disconnectTwilio(userId: string): Promise<void> {
  const rec = await findRow(userId);
  if (rec) await db().update("integrations", rec.id, { status: "disconnected", credentials_enc: null, account_label: null, connected_at: null });
  const [profile] = await db().list("owner_profile", { where: { user_id: userId }, limit: 1 });
  if (profile) await db().update("owner_profile", profile.id, { assistant_phone_number: null });
}

export async function getTwilioCredentials(userId: string): Promise<TwilioCreds | null> {
  const rec = await findRow(userId);
  if (!rec?.credentials_enc || rec.status !== "connected") return null;
  try {
    return decryptJSON<TwilioCreds>(rec.credentials_enc);
  } catch {
    return null;
  }
}
