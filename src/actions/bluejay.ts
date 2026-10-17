"use server";

import { callBluejayTool, GUARDRAIL_SIMULATION_ID, listBluejayTools, type JsonSchema } from "@/server/integrations/bluejay";

export type BluejayRunState = { ok: boolean; tool: string; result: unknown; message?: string } | null;

/** Queue a run of the guardrail suite (the 6 guest-caller digital humans created for Perrie). */
export async function runGuardrailSuiteAction(): Promise<BluejayRunState> {
  const tool = "queue_simulation_run";
  try {
    const { data, isError } = await callBluejayTool(tool, { simulation_id: GUARDRAIL_SIMULATION_ID, channel: "voice" });
    return { ok: !isError, tool, result: data, message: isError ? "Bluejay returned an error." : undefined };
  } catch (err) {
    return { ok: false, tool, result: null, message: (err as Error).message };
  }
}

function coerce(raw: string, schema: JsonSchema | undefined): unknown {
  const t = Array.isArray(schema?.type) ? schema?.type.find((x) => x !== "null") : schema?.type;
  if (raw === "") return undefined;
  switch (t) {
    case "number":
    case "integer": {
      const n = Number(raw);
      if (Number.isNaN(n)) throw new Error(`"${raw}" isn't a number.`);
      return n;
    }
    case "boolean":
      return raw === "true" || raw === "on";
    case "array":
    case "object":
      return JSON.parse(raw);
    default:
      return raw;
  }
}

/** Run one Bluejay MCP tool with arguments typed in on the Voice QA page. */
export async function runBluejayToolAction(_prev: BluejayRunState, form: FormData): Promise<BluejayRunState> {
  const name = String(form.get("__tool") ?? "");
  try {
    const { tools } = await listBluejayTools();
    const tool = tools.find((t) => t.name === name);
    if (!tool) return { ok: false, tool: name, result: null, message: "Bluejay doesn't offer that tool." };
    const props = tool.inputSchema?.properties ?? {};
    const args: Record<string, unknown> = {};
    for (const key of Object.keys(props)) {
      const v = form.get(`arg:${key}`);
      if (typeof v !== "string") continue;
      const c = coerce(v.trim(), props[key]);
      if (c !== undefined) args[key] = c;
    }
    const missing = (tool.inputSchema?.required ?? []).filter((k) => args[k] === undefined);
    if (missing.length) return { ok: false, tool: name, result: null, message: `Missing: ${missing.join(", ")}` };
    const { data, isError } = await callBluejayTool(name, args);
    return { ok: !isError, tool: name, result: data, message: isError ? "Bluejay returned an error." : undefined };
  } catch (err) {
    return { ok: false, tool: name, result: null, message: (err as Error).message };
  }
}
