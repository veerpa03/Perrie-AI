import { z } from "zod";
import { logGuardrail } from "../db";
import { APP_INTEGRATIONS } from "../integrations";
import { perrieCore } from "./core";
import { telephony } from "./telephony";
import type { AgentRole, AnyTool, ProviderStatus, ToolContext, ToolProvider } from "./types";

/**
 * Every source of agent tools: Perrie's built-in capabilities plus the
 * owner's app integrations. A tool is usable only when its provider is
 * connected and the current role is allowed to use it.
 */
export const TOOL_PROVIDERS: ToolProvider[] = [perrieCore, telephony, ...APP_INTEGRATIONS];

const TOOLS = new Map<string, AnyTool>();
for (const p of TOOL_PROVIDERS) {
  for (const t of p.tools) {
    if (TOOLS.has(t.name)) throw new Error(`Duplicate tool name: ${t.name}`);
    if (t.provider !== p.id) throw new Error(`Tool ${t.name} declares provider ${t.provider} but is listed under ${p.id}`);
    TOOLS.set(t.name, t);
  }
}

export const getTool = (name: string) => TOOLS.get(name);
export const getProvider = (id: string) => TOOL_PROVIDERS.find((p) => p.id === id);

// Short cache so a conversation turn doesn't re-check every provider.
let statusCache: { at: number; value: Map<string, ProviderStatus> } | null = null;

export async function providerStatuses(fresh = false): Promise<Map<string, ProviderStatus>> {
  if (!fresh && statusCache && Date.now() - statusCache.at < 5000) return statusCache.value;
  const entries = await Promise.all(
    TOOL_PROVIDERS.map(async (i) => {
      try {
        return [i.id, await i.status()] as const;
      } catch (err) {
        return [i.id, { connected: false, error: (err as Error).message }] as const;
      }
    }),
  );
  statusCache = { at: Date.now(), value: new Map(entries) };
  return statusCache.value;
}

export function invalidateProviderStatus() {
  statusCache = null;
}

/** Tools a role may use right now (provider connected). */
export async function availableTools(role: AgentRole): Promise<AnyTool[]> {
  const statuses = await providerStatuses();
  return [...TOOLS.values()].filter((t) => t.roles.includes(role) && statuses.get(t.provider)?.connected);
}

/** JSON-schema tool definitions for the Anthropic Messages API. */
export function toAnthropicTools(tools: AnyTool[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: z.toJSONSchema(t.input, { io: "input", target: "draft-2020-12" }) as {
      type: "object";
      [k: string]: unknown;
    },
  }));
}

export type ToolOutcome =
  | { ok: true; output: unknown; tool: AnyTool; input: unknown }
  | { ok: false; error: string; blocked?: boolean };

/**
 * Single choke point for every tool call (voice agent, playground,
 * orchestrator). Enforces, independent of what the model says:
 *   1. the tool exists,
 *   2. the current role is allowed to use it (owner-only actions can never
 *      run for guests or the people Perrie calls),
 *   3. its provider (capability / app integration) is connected,
 *   4. the input validates against the schema.
 * Confirmation of side effects on live calls is enforced one level up, in
 * the agent session, which knows what the owner actually said.
 */
export async function executeTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const tool = TOOLS.get(name);
  if (!tool) return { ok: false, error: `Unknown tool "${name}".` };

  if (!tool.roles.includes(ctx.role)) {
    await logGuardrail({
      kind: "tool_blocked_for_role",
      severity: "block",
      detail: `Blocked ${name} for a ${ctx.role} — only ${tool.roles.join("/")} may use it.`,
      call_id: ctx.callId,
      task_id: ctx.taskId,
      meta: { tool: name },
    });
    return {
      ok: false,
      blocked: true,
      error: `Not permitted: you are acting for a ${ctx.role}, and ${name} is reserved for the owner. Politely decline.`,
    };
  }

  const status = (await providerStatuses()).get(tool.provider);
  if (!status?.connected) {
    const who = getProvider(tool.provider)?.name ?? tool.provider;
    return { ok: false, error: `${who} isn't connected, so ${name} is unavailable. Say so honestly.` };
  }

  const parsed = tool.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return { ok: false, error: `Invalid input for ${name}: ${z.prettifyError(parsed.error)}` };
  }

  try {
    const output = await tool.run(parsed.data, ctx);
    return { ok: true, output, tool, input: parsed.data };
  } catch (err) {
    return { ok: false, error: `${name} failed: ${(err as Error).message}` };
  }
}
