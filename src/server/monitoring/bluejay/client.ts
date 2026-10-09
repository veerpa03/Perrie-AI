import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { env } from "../../env";

/**
 * Bluejay MCP client (Streamable HTTP, stateless) — https://api.getbluejay.ai/mcp.
 * Authenticated only by the X-API-Key header; the key is never a tool
 * argument. Tool names follow Bluejay's MCP docs and request bodies follow
 * the field names in Bluejay's API models (see payload.ts / setup.ts); each
 * call is adapted to the tool's live inputSchema from tools/list.
 */

export type JsonSchema = {
  type?: string | string[];
  description?: string;
  enum?: unknown[];
  default?: unknown;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
};

export type BluejayTool = {
  name: string;
  description?: string;
  inputSchema: JsonSchema;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; title?: string };
};

export class BluejayError extends Error {
  constructor(
    message: string,
    readonly tool?: string,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

export class BluejayToolMissingError extends BluejayError {}

/** Tools Perrie must never call automatically (they spend money or delete things). */
export const NEVER_AUTO_CALL = new Set(["add_phone_number", "release_phone_number"]);

const TOOL_CACHE_MS = 10 * 60_000;
const g = globalThis as unknown as { __perrieBluejayTools?: { key: string; at: number; tools: BluejayTool[]; server: string | null } };

/**
 * Next.js wraps global fetch with its data cache; long-lived MCP streams must
 * bypass it (otherwise Next tries to buffer/cache them). Use the unwrapped
 * fetch when running inside Next, plain fetch elsewhere.
 */
const rawFetch: typeof fetch = (...args) => {
  const f = globalThis.fetch as typeof fetch & { _nextOriginalFetch?: typeof fetch };
  return (f._nextOriginalFetch ?? f)(...args);
};

export function bluejayConfigured() {
  return !!env.bluejay();
}

/** Text content of a tool result, parsed as JSON when possible. */
export function readToolResult(result: unknown): { data: unknown; isError: boolean } {
  const r = result as { content?: { type: string; text?: string }[]; structuredContent?: unknown; isError?: boolean };
  if (r.structuredContent !== undefined && r.structuredContent !== null) return { data: r.structuredContent, isError: !!r.isError };
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

const WRAPPERS = ["request", "body", "data", "payload", "input", "params"];

/**
 * Fit a request body to a tool's inputSchema. Bluejay's MCP tools mirror the
 * REST bodies, so usually the body is passed as-is; if a tool instead takes a
 * single wrapper object (e.g. {"request": {...}}), the body is nested.
 */
export function adaptArgs(schema: JsonSchema | undefined, body: Record<string, unknown>): Record<string, unknown> {
  const props = schema?.properties ?? {};
  const keys = Object.keys(props);
  if (!keys.length) return body;
  const bodyKeys = Object.keys(body);
  if (bodyKeys.every((k) => k in props)) return body;
  if (keys.length === 1) {
    const only = props[keys[0]];
    const t = Array.isArray(only.type) ? only.type : [only.type];
    if (!only.type || t.includes("object")) return { [keys[0]]: body };
  }
  const wrapper = WRAPPERS.find((w) => w in props);
  if (wrapper) {
    // Keep top-level keys the tool lists (e.g. path params), nest the rest.
    const top = Object.fromEntries(bodyKeys.filter((k) => k in props && k !== wrapper).map((k) => [k, body[k]]));
    return { ...top, [wrapper]: body };
  }
  if (schema?.additionalProperties === false) {
    return Object.fromEntries(bodyKeys.filter((k) => k in props).map((k) => [k, body[k]]));
  }
  return body;
}

function errorText(data: unknown): string {
  if (typeof data === "string") return data.slice(0, 500);
  const d = data as { detail?: unknown; error?: unknown; message?: unknown };
  if (Array.isArray(d?.detail)) {
    return (d.detail as { loc?: unknown[]; msg?: string }[])
      .map((e) => `${(e.loc ?? []).join(".")}: ${e.msg ?? ""}`)
      .join("; ")
      .slice(0, 500);
  }
  return String(d?.detail ?? d?.message ?? d?.error ?? JSON.stringify(data)).slice(0, 500);
}

/** One connected MCP session; reuse it for a batch of calls. */
export class BluejaySession {
  private readonly byName: Map<string, BluejayTool>;
  constructor(
    private readonly client: Client,
    readonly tools: BluejayTool[],
    readonly server: string | null,
  ) {
    this.byName = new Map(tools.map((t) => [t.name, t]));
  }

  has(name: string) {
    return this.byName.has(name);
  }

  tool(name: string) {
    return this.byName.get(name);
  }

  /** First tool that exists, from a list of candidate names. */
  pick(...names: string[]): string | undefined {
    return names.find((n) => this.byName.has(n));
  }

  async call<T = unknown>(name: string, body: Record<string, unknown> = {}): Promise<T> {
    if (NEVER_AUTO_CALL.has(name)) throw new BluejayError(`${name} is never called automatically.`, name);
    const tool = this.byName.get(name);
    if (!tool) throw new BluejayToolMissingError(`Bluejay's MCP server doesn't offer "${name}".`, name);
    const result = await this.client.callTool({ name, arguments: adaptArgs(tool.inputSchema, body) });
    const { data, isError } = readToolResult(result);
    if (isError) throw new BluejayError(`${name}: ${errorText(data)}`, name, data);
    return data as T;
  }
}

export async function withBluejay<T>(fn: (s: BluejaySession) => Promise<T>, timeoutMs = 60_000): Promise<T> {
  const cfg = env.bluejay();
  if (!cfg) throw new BluejayError("BLUEJAY_API_KEY is not set.");
  const client = new Client({ name: "perrie", version: "0.2.0" });
  const transport = new StreamableHTTPClientTransport(new URL(cfg.url), {
    requestInit: { headers: { "X-API-Key": cfg.apiKey }, cache: "no-store" },
    fetch: rawFetch,
  });
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      (async () => {
        await client.connect(transport);
        const cacheKey = `${cfg.url}|${cfg.apiKey.slice(-6)}`;
        let cached = g.__perrieBluejayTools;
        if (!cached || cached.key !== cacheKey || Date.now() - cached.at > TOOL_CACHE_MS) {
          const tools: BluejayTool[] = [];
          let cursor: string | undefined;
          do {
            const page = await client.listTools(cursor ? { cursor } : undefined);
            tools.push(...(page.tools as BluejayTool[]));
            cursor = page.nextCursor;
          } while (cursor && tools.length < 1000);
          const v = client.getServerVersion();
          cached = g.__perrieBluejayTools = { key: cacheKey, at: Date.now(), tools, server: v ? `${v.name} ${v.version}` : null };
        }
        return fn(new BluejaySession(client, cached.tools, cached.server));
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new BluejayError("Bluejay didn't respond in time.")), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    await client.close().catch(() => {});
  }
}

export function forgetBluejayTools() {
  g.__perrieBluejayTools = undefined;
}

export async function listBluejayTools(): Promise<{ tools: BluejayTool[]; server: string | null }> {
  return withBluejay(async (s) => ({ tools: s.tools, server: s.server }), 20_000);
}

export async function callBluejayTool(name: string, args: Record<string, unknown>) {
  return withBluejay(async (s) => {
    const data = await s.call(name, args);
    return { data, isError: false };
  }, 30_000);
}

/** Read-only-looking tools with no required inputs: safe to call for the dashboard snapshot. */
export function isSnapshotTool(t: BluejayTool): boolean {
  if (t.annotations?.destructiveHint) return false;
  const readish = t.annotations?.readOnlyHint === true || /^(list|get)_/.test(t.name);
  return readish && !t.inputSchema?.required?.length;
}

/** Group tools into the families the dashboard shows. */
export function familyOf(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("digital_human")) return "Digital humans";
  if (n.includes("simulation")) return "Simulations";
  if (n.includes("uptime")) return "Uptime monitors";
  if (n.includes("alert")) return "Alerts";
  if (n.includes("eval") || n.includes("metric") || n.includes("call_log")) return "Evaluation & metrics";
  if (n.includes("agent") || n.includes("prompt")) return "Agents";
  return "Other";
}

/** Read-only REST GET against Bluejay's API (same key), for endpoints without an MCP tool. */
export async function bluejayRestGet<T = unknown>(path: string): Promise<T> {
  const cfg = env.bluejay();
  if (!cfg) throw new BluejayError("BLUEJAY_API_KEY is not set.");
  const res = await rawFetch(new URL(path, new URL(cfg.url).origin), {
    headers: { "X-API-Key": cfg.apiKey, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* plain text */
  }
  if (!res.ok) throw new BluejayError(`GET ${path} ${res.status}: ${errorText(data)}`, undefined, data);
  return data as T;
}
