import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir, env } from "./env";

/**
 * Secrets helpers: the app secret (signing + encryption), owner PIN hashing,
 * encrypted credential blobs and short-lived signed tokens.
 */


let cachedSecret: string | null = null;

/**
 * PERRIE_SECRET from the environment. In development, if it is missing, a
 * random one is generated once and kept in .perrie/secret (gitignored) so the
 * app works out of the box. Production refuses to run without it.
 */
export function appSecret(): string {
  if (cachedSecret) return cachedSecret;
  const fromEnv = env.secret();
  if (fromEnv) return (cachedSecret = fromEnv);
  if (env.isProduction()) {
    throw new Error("PERRIE_SECRET must be set in production (32+ random characters).");
  }
  const file = path.join(dataDir(), "secret");
  if (existsSync(file)) {
    cachedSecret = readFileSync(file, "utf8").trim();
  } else {
    mkdirSync(path.dirname(file), { recursive: true });
    cachedSecret = randomBytes(32).toString("base64url");
    writeFileSync(file, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}

const keyFor = (purpose: string) => createHash("sha256").update(`${purpose}:${appSecret()}`).digest();

/** AES-256-GCM encrypt a JSON value -> "v1.<iv>.<tag>.<ciphertext>" (base64url). */
export function encryptJSON(value: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor("enc"), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv, tag, data].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

export function decryptJSON<T = unknown>(blob: string): T {
  const [v, iv, tag, data] = blob.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised encrypted blob");
  const decipher = createDecipheriv("aes-256-gcm", keyFor("enc"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const out = Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]);
  return JSON.parse(out.toString("utf8")) as T;
}

/** scrypt hash for the owner's PIN: "scrypt$<salt>$<hash>". */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPin(pin: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = scryptSync(pin, Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Compact HMAC-signed token with expiry, e.g. to authorise a media stream. */
export function signToken(payload: Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", keyFor("token")).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string | undefined | null): T | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", keyFor("token")).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp?: number };
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}
