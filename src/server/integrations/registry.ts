import { z } from "zod";
import { logGuardrail } from "../db";
import { anthropic, bluejay, deepgram, perrieCore, supabase } from "./core";
import { googleCalendar } from "./google/calendar";
import { googleContacts } from "./google/contacts";
import { twilio } from "./twilio";
import type { AgentRole, AnyTool, IntegrationDef, IntegrationStatus, ToolContext } from "./types";

/**
 * The integration registry. To add an integration: create its IntegrationDef
 * (status + tools) and list it here. Tools then become available — subject to
 * their roles and the integration being connected — to the live voice agent,
 * the task planner and the orchestrator, and it appears on the dashboard.
 */
export const INTEGRATIONS: IntegrationDef[] = [
  perrieCore,
  twilio,
  googleCalendar,
  googleContacts,
  deepgram,
  anthropic,
  supabase,
  bluejay,
];

const TOOLS = new Map<string, AnyTool>();
for (const integ of INTEGRATIONS) {
  for (const t of integ.tools) {
    if (TOOLS.has(t.name)) throw new Error(`Duplicate tool name: ${t.name}`);
    TOOLS.set(t.name, t);
  }
}

export const getTool = (name: string) => TOOLS.get(name);
export const getIntegration = (id: string) => INTEGRATIONS.find((i) => i.id === id);

// Short cache so a conversation turn doesn't re-check every integration.
let statusCache: { at: number; value: Map<string, IntegrationStatus> } | null = null;

export async function integrationStatuses(fresh = false): Promise<Map<string, IntegrationStatus>> {
  if (!fresh && statusCache && Date.now() - statusCache.at < 5000) return statusCache.value;
  const entries = await Promise.all(
    INTEGRATIONS.map(async (i) => {
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

export function invalidateIntegrationStatus() {
  statusCache = null;
}

/** Tools a role may use right now (integration connected). */
export async function availableTools(role: AgentRole): Promise<AnyTool[]> {
  const statuses = await integrationStatuses();
  return [...TOOLS.values()].filter((t) => t.roles.includes(role) && statuses.get(t.integration)?.connected);
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
 *   3. its integration is connected,
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

  const status = (await integrationStatuses()).get(tool.integration);
  if (!status?.connected) {
    return { ok: false, error: `${tool.integration} isn't connected, so ${name} is unavailable. Say so honestly.` };
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
