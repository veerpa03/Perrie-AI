import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { env } from "../env";

/**
 * Bluejay MCP client (Streamable HTTP, stateless). Authenticated with the
 * X-API-Key header — the key never travels as a tool argument. Tool names
 * are discovered at runtime (tools/list), so new Bluejay tools appear on the
 * Voice QA page without code changes.
 */

export type BluejayTool = {
  name: string;
  description?: string;
  inputSchema: { type?: string; properties?: Record<string, JsonSchema>; required?: string[] };
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; title?: string };
};
export type JsonSchema = {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: JsonSchema;
};

/**
 * Bluejay agent/simulation created for Perrie's guest-caller guardrails
 * (agent 176701, "Perrie (guest line)", PHONE connection to TWILIO_PHONE_NUMBER).
 * Covers the inbound scenarios: privacy refusal, impersonation resistance,
 * prompt-injection resistance, message-taking accuracy, unknown-fact honesty,
 * noisy-line handling. The two outbound scenarios ("are you a robot?", "mission
 * creep") aren't covered — they need Perrie to place the call, which has no
 * webhook trigger wired yet, so Bluejay can't initiate them.
 */
export const GUARDRAIL_SIMULATION_ID = "34513";

export async function withBluejay<T>(fn: (client: Client) => Promise<T>, timeoutMs = 15_000): Promise<T> {
  const cfg = env.bluejay();
  if (!cfg) throw new Error("BLUEJAY_API_KEY is not set.");
  const client = new Client({ name: "perrie-dashboard", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(cfg.url), {
    requestInit: { headers: { "X-API-Key": cfg.apiKey } },
  });
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      (async () => {
        await client.connect(transport);
        return fn(client);
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Bluejay didn't respond in time.")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    await client.close().catch(() => {});
  }
}

export async function listBluejayTools(): Promise<{ tools: BluejayTool[]; server: string | null }> {
  return withBluejay(async (c) => {
    const tools: BluejayTool[] = [];
    let cursor: string | undefined;
    do {
      const page = await c.listTools(cursor ? { cursor } : undefined);
      tools.push(...(page.tools as BluejayTool[]));
      cursor = page.nextCursor;
    } while (cursor && tools.length < 500);
    const v = c.getServerVersion();
    return { tools, server: v ? `${v.name} ${v.version}` : null };
  });
}

export type BluejaySnapshot = { tool: BluejayTool; data: unknown; isError: boolean; error: string | null };

/**
 * Voice QA dashboard load: list tools AND call the handful of read-only
 * snapshot tools, all over ONE Bluejay connection instead of one per call —
 * opening 7 separate MCP sessions per page view was timing out under load.
 */
export async function loadBluejaySnapshot(
  maxSnapshots = 6,
): Promise<{ tools: BluejayTool[]; server: string | null; snapshots: BluejaySnapshot[] }> {
  return withBluejay(async (c) => {
    const tools: BluejayTool[] = [];
    let cursor: string | undefined;
    do {
      const page = await c.listTools(cursor ? { cursor } : undefined);
      tools.push(...(page.tools as BluejayTool[]));
      cursor = page.nextCursor;
    } while (cursor && tools.length < 500);
    const v = c.getServerVersion();
    const snapshotTools = tools.filter(isSnapshotTool).slice(0, maxSnapshots);
    const snapshots = await Promise.all(
      snapshotTools.map(async (t): Promise<BluejaySnapshot> => {
        try {
          const { data, isError } = readToolResult(await c.callTool({ name: t.name, arguments: {} }));
          return { tool: t, data, isError, error: null };
        } catch (err) {
          return { tool: t, data: null, isError: true, error: (err as Error).message };
        }
      }),
    );
    return { tools, server: v ? `${v.name} ${v.version}` : null, snapshots };
  }, 20_000);
}

/** Text content of a tool result, parsed as JSON when possible. */
export function readToolResult(result: unknown): { data: unknown; isError: boolean } {
  const r = result as { content?: { type: string; text?: string }[]; structuredContent?: unknown; isError?: boolean };
  if (r.structuredContent !== undefined) return { data: r.structuredContent, isError: !!r.isError };
  const text = (r.content ?? [])
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n");
  try {
    return { data: JSON.parse(text), isError: !!r.isError };
  } catch {
    return { data: text, isError: !!r.isError };
  }
}

export async function callBluejayTool(name: string, args: Record<string, unknown>) {
  return withBluejay(async (c) => readToolResult(await c.callTool({ name, arguments: args })), 30_000);
}

/** Read-only-looking tools with no required inputs: safe to call for the dashboard snapshot. */
export function isSnapshotTool(t: BluejayTool): boolean {
  if (t.annotations?.destructiveHint) return false;
  const readish = t.annotations?.readOnlyHint === true || /^(list|get|search)_/.test(t.name);
  return readish && !(t.inputSchema?.required?.length);
}

/** Group tools into the families the dashboard shows. */
export function familyOf(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("digital_human") || n.includes("persona")) return "Digital humans";
  if (n.includes("simulation")) return "Simulations";
  if (n.includes("eval") || n.includes("metric")) return "Evaluation & metrics";
  if (n.includes("alert")) return "Alerts";
  if (n.includes("monitor") || n.includes("uptime")) return "Monitoring";
  if (n.includes("agent")) return "Agents";
  return "Other";
}
