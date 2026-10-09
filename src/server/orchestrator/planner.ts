import { z } from "zod";
import { db, getProfile, listFacts, logGuardrail, ownerName, type TaskRecord, type TaskStep } from "../db";
import { models, structured } from "../agent/llm";
import { availableTools } from "../integrations/registry";
import type { AnyTool } from "../integrations/types";
import { humanNow } from "../time";

/**
 * Planner: request -> short plan of tool steps the owner can review.
 * The plan names WHICH tool each step uses and WHAT it must achieve; concrete
 * tool inputs are resolved at run time from earlier steps' real outputs, so
 * the plan never contains guessed phone numbers or times.
 */

const MAX_STEPS = 8;

const planSchema = z.object({
  title: z.string().min(1).max(80),
  summary: z.string().min(1).max(500),
  needs_clarification: z.string().max(300).optional().nullable(),
  steps: z
    .array(
      z.object({
        title: z.string().min(1).max(120),
        tool: z.string().min(1),
        description: z.string().min(1).max(1500),
        depends_on: z.array(z.number().int().min(1)).default([]),
      }),
    )
    .max(MAX_STEPS),
});
type Plan = z.infer<typeof planSchema>;

const SUBMIT_PLAN = {
  name: "submit_plan",
  description: "Submit the plan for the owner's request.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "Short task title, max 60 characters." },
      summary: {
        type: "string",
        description: "1–2 plain sentences describing what will happen, written to be read aloud to the owner.",
      },
      needs_clarification: {
        type: "string",
        description: "Only if the request is ambiguous or impossible with the tools: one short question. Then return no steps.",
      },
      steps: {
        type: "array",
        maxItems: MAX_STEPS,
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short step title, e.g. 'Find Sam's number'." },
            tool: { type: "string", description: "Exact tool name from the list." },
            description: {
              type: "string",
              description: "Everything needed to fill the tool's input later: who, what, when (owner's timezone), and the goal.",
            },
            depends_on: {
              type: "array",
              items: { type: "integer" },
              description: "1-based numbers of earlier steps whose output this step needs.",
            },
          },
          required: ["title", "tool", "description", "depends_on"],
        },
      },
    },
    required: ["title", "summary", "steps"],
  },
};

function toolCatalog(tools: AnyTool[]): string {
  return tools
    .map((t) => {
      const schema = JSON.stringify(z.toJSONSchema(t.input, { io: "input" }));
      return `- ${t.name}${t.sideEffect ? " [changes things]" : ""}${t.async ? " [waits for a phone call to finish]" : ""}: ${t.description}\n  input: ${schema}`;
    })
    .join("\n");
}

function validate(plan: Plan, tools: AnyTool[]): string[] {
  const names = new Set(tools.map((t) => t.name));
  const errors: string[] = [];
  if (!plan.needs_clarification && plan.steps.length === 0) errors.push("The plan has no steps.");
  plan.steps.forEach((s, i) => {
    if (!names.has(s.tool)) errors.push(`Step ${i + 1} uses "${s.tool}", which is not an available tool.`);
    for (const d of s.depends_on) if (d >= i + 1) errors.push(`Step ${i + 1} depends on step ${d}, which isn't earlier.`);
  });
  return errors;
}

async function plannerPrompt(): Promise<{ system: string; tools: AnyTool[] }> {
  const [profile, facts, tools] = await Promise.all([getProfile(), listFacts(), availableTools("system")]);
  const tz = profile?.timezone ?? "UTC";
  const name = ownerName(profile);
  const system = [
    `You are the planning module of ${profile?.assistant_name ?? "Perrie"}, the personal assistant of ${profile?.full_name ?? name}.`,
    `Turn the owner's request into the shortest plan that fully does what they asked, using ONLY the tools below.`,
    ``,
    `Now: ${humanNow(tz)} (${tz}). All times are in ${tz}.`,
    ``,
    `Rules:`,
    `- One tool per step, exact tool names. Prefer 1–4 steps; never add actions the owner didn't ask for.`,
    `- Never invent phone numbers, e-mails, times or facts. If a number is needed and not in the request or the facts below, look it up with contacts_search first (if available); otherwise ask for clarification.`,
    `- Calls on the owner's behalf: the step description is the mission — say exactly what to achieve, what may be agreed (e.g. acceptable time windows), and what must not be shared.`,
    `- To book something agreed on a call, add a calendar step after the call that depends on it.`,
    `- If the request is ambiguous, unsafe, or impossible with these tools, set needs_clarification and return no steps.`,
    profile?.rules.length ? `- The owner's standing rules (always respect):\n${profile.rules.map((r) => `  • ${r}`).join("\n")}` : "",
    ``,
    `Owner facts (may be used to plan):`,
    facts.length ? facts.map((f) => `- ${f.label}: ${f.value}`).join("\n") : "- (none)",
    ``,
    `Available tools:`,
    tools.length ? toolCatalog(tools) : "(none connected)",
  ]
    .filter((l) => l !== "")
    .join("\n");
  return { system, tools };
}

/** Create a task and plan it. Never throws for planning problems: the task records them. */
export async function createTask(opts: {
  request: string;
  source: TaskRecord["source"];
  originCallId?: string | null;
}): Promise<{ task: TaskRecord; steps: TaskStep[] }> {
  const task = await db().insert("tasks", {
    title: opts.request.slice(0, 80),
    request: opts.request,
    source: opts.source,
    status: "planning",
    plan_summary: null,
    result_summary: null,
    error: null,
    origin_call_id: opts.originCallId ?? null,
    completed_at: null,
  });
  return planTask(task);
}

export async function planTask(task: TaskRecord): Promise<{ task: TaskRecord; steps: TaskStep[] }> {
  try {
    const { system, tools } = await plannerPrompt();
    let feedback = "";
    let plan: Plan | null = null;
    for (let attempt = 0; attempt < 2 && !plan; attempt++) {
      const raw = await structured<unknown>({
        model: models().planner,
        system,
        user: `Owner's request:\n"""${task.request}"""${feedback}`,
        tool: SUBMIT_PLAN,
      });
      const parsed = planSchema.safeParse(raw);
      const errors = parsed.success ? validate(parsed.data, tools) : [z.prettifyError(parsed.error)];
      if (!errors.length && parsed.success) plan = parsed.data;
      else {
        feedback = `\n\nYour previous plan was rejected:\n${errors.join("\n")}\nFix it.`;
        await logGuardrail({
          kind: "plan_rejected",
          severity: "warn",
          detail: `Planner output rejected: ${errors.join("; ")}`,
          task_id: task.id,
        });
      }
    }
    if (!plan) throw new Error("Couldn't produce a valid plan with the connected tools.");

    if (plan.needs_clarification) {
      const t = await db().update("tasks", task.id, {
        title: plan.title,
        status: "failed",
        error: `Needs clarification: ${plan.needs_clarification}`,
        plan_summary: plan.summary,
      });
      return { task: t, steps: [] };
    }

    const steps: TaskStep[] = [];
    for (const [i, s] of plan.steps.entries()) {
      steps.push(
        await db().insert("task_steps", {
          task_id: task.id,
          position: i + 1,
          title: s.title,
          description: s.description,
          tool: s.tool,
          depends_on: s.depends_on,
          status: "pending",
          input: null,
          output: null,
          error: null,
          started_at: null,
          finished_at: null,
        }),
      );
    }
    const t = await db().update("tasks", task.id, {
      title: plan.title,
      plan_summary: plan.summary,
      status: "awaiting_approval",
    });
    return { task: t, steps };
  } catch (err) {
    const t = await db().update("tasks", task.id, { status: "failed", error: (err as Error).message });
    return { task: t, steps: [] };
  }
}
