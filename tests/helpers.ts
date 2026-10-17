import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/** Isolated data dir + clean env for each test file (never touches .perrie/). */
export function isolate() {
  process.env.PERRIE_DATA_DIR = mkdtempSync(path.join(tmpdir(), "perrie-test-"));
  process.env.PERRIE_SECRET = "test-secret-test-secret-test-secret";
  for (const k of [
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GROQ_API_KEY",
    "PUBLIC_BASE_URL",
    "DEEPGRAM_API_KEY",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "BLUEJAY_API_KEY",
  ])
    delete process.env[k];
}

/** Twilio is per-tenant now (see src/server/integrations/twilioCreds.ts) — write the connected row directly rather than going through the live-API verify() step. */
export async function enableTwilio(userId: string, captured: { url: string; body: string }[]) {
  process.env.PUBLIC_BASE_URL = "https://perrie.example";
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("api.twilio.com")) {
      captured.push({ url: u, body: String(init?.body ?? "") });
      return new Response(JSON.stringify({ sid: `SM${captured.length}` }), { status: 201 });
    }
    throw new Error(`Unexpected fetch in test: ${u}`);
  }) as typeof fetch;
  const { encryptJSON } = await import("../src/server/crypto");
  const { db } = await import("../src/server/db");
  await db().insert("integrations", {
    user_id: userId,
    integration: "twilio",
    status: "connected",
    account_label: "+14155550100",
    scopes: [],
    credentials_enc: encryptJSON({ accountSid: "ACtest", authToken: "authtoken", phoneNumber: "+14155550100" }),
    meta: {},
    connected_at: new Date().toISOString(),
  });
}

type Step = { text?: string; tools?: { name: string; input: unknown }[] };

/** Scripted stand-in for the Groq-backed llm() client (stream + create). */
export function fakeLlm(script: Step[]) {
  const requests: Record<string, unknown>[] = [];
  let n = 0;
  const reply = (step: Step) => {
    const content: Record<string, unknown>[] = [];
    if (step.text) content.push({ type: "text", text: step.text });
    for (const t of step.tools ?? []) content.push({ type: "tool_use", id: `tu_${++n}`, name: t.name, input: t.input });
    return { content, stop_reason: step.tools?.length ? "tool_use" : "end_turn" };
  };
  const client = {
    messages: {
      stream(params: Record<string, unknown>) {
        requests.push(params);
        const step = script.shift() ?? { text: "" };
        const listeners: ((d: string) => void)[] = [];
        return {
          on(ev: string, cb: (d: string) => void) {
            if (ev === "text") listeners.push(cb);
            return this;
          },
          async finalMessage() {
            for (const w of step.text?.match(/\S+\s*/g) ?? []) listeners.forEach((l) => l(w));
            return reply(step);
          },
        };
      },
      async create(params: Record<string, unknown>) {
        requests.push(params);
        return reply(script.shift() ?? { text: "" });
      },
    },
  };
  process.env.GROQ_API_KEY = "test-key";
  (globalThis as unknown as { __perrieLlmOverride: unknown }).__perrieLlmOverride = client;
  return { requests, script };
}
