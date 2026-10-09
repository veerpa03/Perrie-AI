import { randomBytes } from "node:crypto";
import { decryptJSON, encryptJSON, signToken, verifyToken } from "../../crypto";
import { db } from "../../db";
import { env } from "../../env";

/**
 * Google OAuth 2.0 (authorization-code flow, offline access) with plain
 * fetch. Each Google integration (Calendar, Contacts, ...) gets its own
 * consent + tokens so they can be connected and disconnected independently.
 * Tokens are AES-GCM encrypted before they are stored.
 */

export type GoogleIntegrationId = "google_calendar" | "google_contacts";

export const GOOGLE_SCOPES: Record<GoogleIntegrationId, string[]> = {
  google_calendar: [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
  ],
  google_contacts: ["https://www.googleapis.com/auth/contacts.readonly"],
};

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

type StoredTokens = { access_token: string; refresh_token?: string; expires_at: number };

export const googleRedirectUri = () => `${env.appUrl()}/api/integrations/google/callback`;

export function isGoogleIntegration(id: string): id is GoogleIntegrationId {
  return id in GOOGLE_SCOPES;
}

/** Returns the consent URL plus a nonce to bind the flow to this browser (cookie). */
export function buildGoogleAuthUrl(integration: GoogleIntegrationId): { url: string; nonce: string } {
  const g = env.google();
  if (!g) throw new Error("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set.");
  const nonce = randomBytes(16).toString("base64url");
  const state = signToken({ i: integration, n: nonce }, 600);
  const params = new URLSearchParams({
    client_id: g.clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: ["openid", "email", ...GOOGLE_SCOPES[integration]].join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return { url: `${AUTH_URL}?${params}`, nonce };
}

export function readGoogleState(state: string | null): { integration: GoogleIntegrationId; nonce: string } | null {
  const p = verifyToken<{ i: string; n: string }>(state);
  if (!p || !isGoogleIntegration(p.i)) return null;
  return { integration: p.i, nonce: p.n };
}

function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8")) as { email?: string };
    return payload.email ?? null;
  } catch {
    return null;
  }
}

export async function completeGoogleConnection(integration: GoogleIntegrationId, code: string): Promise<void> {
  const g = env.google();
  if (!g) throw new Error("Google OAuth is not configured.");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: g.clientId,
      client_secret: g.clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    id_token?: string;
    error_description?: string;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(`Google token exchange failed: ${json.error_description ?? json.error ?? res.status}`);
  }
  const granted = (json.scope ?? "").split(" ").filter(Boolean);
  const missing = GOOGLE_SCOPES[integration].filter((s) => !granted.includes(s));
  if (missing.length) throw new Error(`Google didn't grant the required permissions (${missing.join(", ")}).`);

  const tokens: StoredTokens = {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  await db().upsert("integrations", {
    id: integration,
    status: "connected",
    account_label: emailFromIdToken(json.id_token),
    scopes: granted,
    credentials_enc: encryptJSON(tokens),
    meta: {},
    connected_at: new Date().toISOString(),
  });
}

export async function disconnectGoogle(integration: GoogleIntegrationId): Promise<void> {
  const rec = await db().get("integrations", integration);
  if (rec?.credentials_enc) {
    try {
      const t = decryptJSON<StoredTokens>(rec.credentials_enc);
      await fetch(`${REVOKE_URL}?token=${encodeURIComponent(t.refresh_token ?? t.access_token)}`, { method: "POST" });
    } catch {
      /* best effort */
    }
  }
  if (rec) {
    await db().update("integrations", integration, {
      status: "disconnected",
      credentials_enc: null,
      scopes: [],
      account_label: null,
      connected_at: null,
    });
  }
}

async function accessToken(integration: GoogleIntegrationId, forceRefresh = false): Promise<string> {
  const rec = await db().get("integrations", integration);
  if (!rec?.credentials_enc || rec.status === "disconnected") throw new Error(`${integration} is not connected.`);
  const t = decryptJSON<StoredTokens>(rec.credentials_enc);
  if (!forceRefresh && t.expires_at - 60_000 > Date.now()) return t.access_token;
  const g = env.google();
  if (!g || !t.refresh_token) throw new Error(`${integration}: token expired; reconnect it from Integrations.`);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: g.clientId,
      client_secret: g.clientSecret,
      refresh_token: t.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const json = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !json.access_token) {
    await db().update("integrations", integration, {
      status: "error",
      meta: { ...rec.meta, last_error: json.error ?? `HTTP ${res.status}` },
    });
    throw new Error(`${integration}: Google refused the refresh (${json.error ?? res.status}); reconnect it.`);
  }
  const next: StoredTokens = { ...t, access_token: json.access_token, expires_at: Date.now() + (json.expires_in ?? 3600) * 1000 };
  await db().update("integrations", integration, { credentials_enc: encryptJSON(next), status: "connected" });
  return next.access_token;
}

/** Authorised JSON request to a Google API; refreshes once on 401. */
export async function googleFetch<T>(integration: GoogleIntegrationId, url: string, init: RequestInit = {}): Promise<T> {
  let token = await accessToken(integration);
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      signal: init.signal ?? AbortSignal.timeout(10_000),
    });
    if (res.status === 401 && attempt === 0) {
      token = await accessToken(integration, true);
      continue;
    }
    const body = await res.text();
    if (!res.ok) {
      let msg = body.slice(0, 300);
      try {
        msg = (JSON.parse(body) as { error?: { message?: string } }).error?.message ?? msg;
      } catch {
        /* raw text */
      }
      throw new Error(`Google API ${res.status}: ${msg}`);
    }
    return (body ? JSON.parse(body) : {}) as T;
  }
  throw new Error("Google API: unauthorised");
}
