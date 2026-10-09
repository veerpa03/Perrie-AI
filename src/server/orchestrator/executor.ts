import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  db,
  getProfile,
  listFacts,
  listSteps,
  logGuardrail,
  ownerName,
  type TaskRecord,
  type TaskStep,
} from "../db";
import { llm, models } from "../agent/llm";
import { executeTool, getTool, toAnthropicTools } from "../integrations/registry";
import { humanNow } from "../time";

/**
 * Executor: runs an approved plan step by step. For each ready step the
 * model fills in that step's tool input from the task request and the REAL
 * outputs of the steps it depends on (it may only call that one tool, or
 * declare it can't proceed). Inputs are validated and run through the same
 * guarded executeTool as the live agent. Phone calls are async: the step
 * waits and the task resumes when the call's outcome is in.
 */

const g = globalThis as unknown as { __perrieRunning?: Set<string> };
const running = (g.__perrieRunning ??= new Set<string>());

const CANNOT_PROCEED = {
  name: "cannot_proceed",
  description:
    "Use when this step can't be done correctly with the information available (e.g. the number wasn't found, the call didn't reach anyone, no slot was agreed).",
  input_schema: {
    type: "object" as const,
    properties: { reason: { type: "string", description: "Short, plain explanation for the owner." } },
    required: ["reason"],
  },
};

export async function approveTask(taskId: string): Promise<TaskRecord> {
  const task = await db().get("tasks", taskId);
  if (!task) throw new Error("Task not found.");
  if (task.status !== "awaiting_approval") throw new Error(`Task is ${task.status.replace("_", " ")}, not awaiting approval.`);
  const updated = await db().update("tasks", taskId, { status: "running" });
  void runTask(taskId).catch((err) => console.error("[orchestrator] run failed", err));
  return updated;
}

export async function cancelTask(taskId: string): Promise<TaskRecord> {
  const task = await db().get("tasks", taskId);
  if (!task) throw new Error("Task not found.");
  if (["completed", "failed", "canceled"].includes(task.status)) return task;
  for (const s of await listSteps(taskId)) {
    if (s.status === "pending") await db().update("task_steps", s.id, { status: "skipped" });
  }
  return db().update("tasks", taskId, { status: "canceled", completed_at: new Date().toISOString() });
}

async function finish(task: TaskRecord, steps: TaskStep[], status: "completed" | "failed", error?: string) {
  let result: string | null = null;
  if (status === "completed") result = await summarizeResult(task, steps);
  for (const s of steps) {
    if (s.status === "pending") await db().update("task_steps", s.id, { status: "skipped" });
  }
  await db().update("tasks", task.id, {
    status,
    result_summary: result,
    error: error ?? null,
    completed_at: new Date().toISOString(),
  });
}

export async function runTask(taskId: string): Promise<void> {
  if (running.has(taskId)) return;
  running.add(taskId);
  try {
    for (let guard = 0; guard < 20; guard++) {
      const task = await db().get("tasks", taskId);
      if (!task || !["running", "waiting"].includes(task.status)) return;
      const steps = await listSteps(taskId);

      const failed = steps.find((s) => s.status === "failed");
      if (failed) return finish(task, steps, "failed", `${failed.title}: ${failed.error ?? "failed"}`);

      const done = (n: number) => steps.find((s) => s.position === n)?.status === "succeeded";
      const ready = steps.filter((s) => s.status === "pending" && s.depends_on.every(done));
      if (!ready.length) {
        if (steps.every((s) => s.status === "succeeded" || s.status === "skipped")) {
          return finish(task, steps, "completed");
        }
        if (steps.some((s) => s.status === "waiting" || s.status === "running")) {
          if (task.status !== "waiting") await db().update("tasks", taskId, { status: "waiting" });
          return;
        }
        return finish(task, steps, "failed", "The plan's steps can't be ordered (dependency problem).");
      }
      if (task.status !== "running") await db().update("tasks", taskId, { status: "running" });
      await executeStep(task, ready[0], steps);
    }
  } finally {
    running.delete(taskId);
  }
}

async function executeStep(task: TaskRecord, step: TaskStep, steps: TaskStep[]) {
  await db().update("task_steps", step.id, { status: "running", started_at: new Date().toISOString() });
  const profile = await getProfile();
  const tz = profile?.timezone ?? "UTC";
  const fail = async (error: string) => {
    await db().update("task_steps", step.id, { status: "failed", error, finished_at: new Date().toISOString() });
  };

  const tool = getTool(step.tool);
  if (!tool) return fail(`Tool ${step.tool} no longer exists.`);

  let input: unknown;
  try {
    const resolved = await resolveInput(task, step, steps, tz);
    if ("cannot" in resolved) return fail(resolved.cannot);
    input = resolved.input;
  } catch (err) {
    return fail(`Couldn't prepare this step: ${(err as Error).message}`);
  }

  const outcome = await executeTool(step.tool, input, {
    role: "system",
    profile,
    timezone: tz,
    taskId: task.id,
    stepId: step.id,
  });
  if (!outcome.ok) {
    await db().update("task_steps", step.id, { input: (input ?? null) as Record<string, unknown> | null });
    return fail(outcome.error);
  }
  await db().update("task_steps", step.id, {
    input: outcome.input as Record<string, unknown>,
    output: outcome.output as Record<string, unknown>,
    status: tool.async ? "waiting" : "succeeded",
    finished_at: tool.async ? null : new Date().toISOString(),
  });
}

async function resolveInput(
  task: TaskRecord,
  step: TaskStep,
  steps: TaskStep[],
  tz: string,
): Promise<{ input: unknown } | { cannot: string }> {
  const tool = getTool(step.tool)!;
  const [profile, facts] = await Promise.all([getProfile(), listFacts()]);
  const deps = steps
    .filter((s) => step.depends_on.includes(s.position))
    .map((s) => `Step ${s.position} — ${s.title} (${s.tool}) result:\n${JSON.stringify(s.output ?? null)}`)
    .join("\n\n");

  const system = [
    `You fill in the exact input for ONE step of a task Perrie is doing for ${profile?.full_name ?? ownerName(profile)}.`,
    `Now: ${humanNow(tz)} (${tz}). Write times as "YYYY-MM-DDTHH:mm" in ${tz}.`,
    `Use ONLY information from the request, the owner facts, and the earlier step results below. Never invent phone numbers, e-mails, names or times.`,
    `If the information needed isn't there, or an earlier result shows the goal can't be met, call cannot_proceed instead.`,
    profile?.rules.length ? `Owner's standing rules:\n${profile.rules.map((r) => `- ${r}`).join("\n")}` : "",
    `Owner facts:\n${facts.map((f) => `- ${f.label}: ${f.value}`).join("\n") || "- (none)"}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const user = [
    `Task request: """${task.request}"""`,
    `This step (${step.position}): ${step.title}\n${step.description}`,
    deps ? `Earlier results:\n${deps}` : "No earlier results.",
  ].join("\n\n");

  const res = await llm().messages.create({
    model: models().planner,
    max_tokens: 1500,
    system,
    messages: [{ role: "user", content: user }],
    tools: [...toAnthropicTools([tool]), CANNOT_PROCEED],
    tool_choice: { type: "any" },
  });
  const block = res.content.find((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use");
  if (!block) throw new Error("no tool input returned");
  if (block.name === CANNOT_PROCEED.name) {
    const reason = String((block.input as { reason?: string }).reason ?? "Not enough information.");
    await logGuardrail({
      kind: "step_cannot_proceed",
      severity: "info",
      detail: `${step.title}: ${reason}`,
      task_id: task.id,
    });
    return { cannot: reason };
  }
  if (block.name !== tool.name) throw new Error(`model chose ${block.name} instead of ${tool.name}`);
  return { input: block.input };
}

async function summarizeResult(task: TaskRecord, steps: TaskStep[]): Promise<string> {
  const fallback = `Done: ${steps.map((s) => s.title).join(" → ")}.`;
  try {
    const res = await llm().messages.create({
      model: models().voice,
      max_tokens: 300,
      system:
        "Write a 1–3 sentence report to the owner of what was done, in plain friendly language. Use ONLY the step results given; do not add details that aren't in them.",
      messages: [
        {
          role: "user",
          content: `Request: ${task.request}\n\n${steps
            .map((s) => `${s.title}: ${JSON.stringify(s.output ?? s.error ?? null)}`)
            .join("\n")}`,
        },
      ],
    });
    const text = res.content.find((b) => b.type === "text");
    return text && "text" in text ? text.text.trim() : fallback;
  } catch {
    return fallback;
  }
}

/** Called when an async step (a phone call) finishes. */
export async function completeAsyncStep(
  stepId: string,
  result: { ok: true; output: Record<string, unknown> } | { ok: false; error: string },
): Promise<void> {
  const step = await db().get("task_steps", stepId);
  if (!step || step.status !== "waiting") return;
  await db().update("task_steps", stepId, {
    status: result.ok ? "succeeded" : "failed",
    output: result.ok ? { ...(step.output ?? {}), ...result.output } : step.output,
    error: result.ok ? null : result.error,
    finished_at: new Date().toISOString(),
  });
  await db().update("tasks", step.task_id, { status: "running" });
  await runTask(step.task_id);
}

/**
 * On boot: steps that were mid-run when the server stopped are marked failed
 * (never silently retried — that could call or book twice); waiting call
 * steps whose call already ended are completed.
 */
export async function resumeInterruptedTasks(): Promise<void> {
  const tasks = await db().list("tasks", { orderBy: "created_at", ascending: false, limit: 100 });
  for (const task of tasks) {
    if (task.status !== "running" && task.status !== "waiting") continue;
    const steps = await listSteps(task.id);
    for (const s of steps) {
      if (s.status === "running") {
        await db().update("task_steps", s.id, {
          status: "failed",
          error: "Interrupted by a server restart — not retried automatically to avoid doing it twice.",
        });
      }
      if (s.status === "waiting") {
        const callId = (s.output as { call_id?: string } | null)?.call_id;
        const call = callId ? await db().get("calls", callId) : null;
        if (call?.ended_at && call.summary) {
          await completeAsyncStep(s.id, { ok: true, output: { summary: call.summary, outcome: call.outcome ?? {} } });
        }
      }
    }
    await runTask(task.id);
  }
}

export const taskInputSchema = z.object({ request: z.string().trim().min(5, "Describe the task in a few words.").max(2000) });
