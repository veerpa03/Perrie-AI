import { z } from "zod";
import { db, listMessages, listTasks } from "../db";
import { env } from "../env";
import type { IntegrationDef, ToolDef } from "./types";

/** Perrie's built-in tools: messages, tasks, and ending a call. */

const ID = "perrie";

const messageInput = z.object({
  caller_name: z.string().min(1).max(120).describe("The caller's name as they said it."),
  callback_number: z.string().max(30).optional().describe("Only if the caller gave one."),
  message: z.string().min(1).max(2000).describe("The message, in the caller's words (lightly cleaned up)."),
  urgency: z.enum(["low", "normal", "high"]).default("normal"),
});

const takeMessage: ToolDef = {
  name: "take_message",
  integration: ID,
  description: "Record a message for the owner from the person on the call. Read it back to them before saving.",
  input: messageInput,
  roles: ["guest", "delegate"],
  sideEffect: false,
  async run(input: z.infer<typeof messageInput>, ctx) {
    const m = await db().insert("messages", {
      call_id: ctx.callId ?? null,
      from_name: input.caller_name,
      from_number: input.callback_number ?? ctx.caller?.number ?? null,
      body: input.message,
      urgency: input.urgency,
      read: false,
    });
    return { saved: true, message_id: m.id };
  },
};

const listMessagesTool: ToolDef = {
  name: "list_messages",
  integration: ID,
  description: "Messages other callers left for the owner (newest first).",
  input: z.object({ unread_only: z.boolean().default(true) }),
  roles: ["owner"],
  sideEffect: false,
  async run(input: { unread_only: boolean }) {
    const all = await listMessages(20);
    const msgs = input.unread_only ? all.filter((m) => !m.read) : all;
    return {
      count: msgs.length,
      messages: msgs.map((m) => ({
        from: m.from_name ?? m.from_number ?? "Unknown caller",
        number: m.from_number,
        message: m.body,
        urgency: m.urgency,
        received: m.created_at,
      })),
    };
  },
};

const createTaskInput = z.object({
  request: z.string().min(5).max(2000).describe("The owner's request in full, including names, times and goals."),
});

const createTask: ToolDef = {
  name: "create_task",
  integration: ID,
  description:
    "Turn something the owner asked for (calling someone, booking, texting, multi-step errands) into a planned task. Returns the plan to read back; nothing runs until approve_task.",
  input: createTaskInput,
  roles: ["owner"],
  sideEffect: false,
  async run(input: z.infer<typeof createTaskInput>, ctx) {
    const { createTask: create } = await import("../orchestrator/planner");
    const { task, steps } = await create({
      request: input.request,
      source: ctx.callId ? "voice" : "playground",
      originCallId: ctx.callId ?? null,
    });
    if (task.status !== "awaiting_approval") {
      return { task_id: task.id, planned: false, problem: task.error ?? "Couldn't plan this." };
    }
    return {
      task_id: task.id,
      planned: true,
      summary: task.plan_summary,
      steps: steps.map((s) => s.title),
      next: "Read the plan back briefly and ask the owner to confirm before calling approve_task.",
    };
  },
};

const approveTask: ToolDef = {
  name: "approve_task",
  integration: ID,
  description: "Start a planned task after the owner clearly said yes to the plan you read back.",
  input: z.object({ task_id: z.string().min(1) }),
  roles: ["owner"],
  sideEffect: true,
  describe: () => "start the task we just planned",
  async run(input: { task_id: string }) {
    const { approveTask: approve } = await import("../orchestrator/executor");
    const task = await approve(input.task_id);
    return { task_id: task.id, status: task.status };
  },
};

const recentTasks: ToolDef = {
  name: "list_recent_tasks",
  integration: ID,
  description: "Status of the owner's recent tasks (what Perrie is doing / did).",
  input: z.object({}),
  roles: ["owner"],
  sideEffect: false,
  async run() {
    const tasks = await listTasks(8);
    return {
      tasks: tasks.map((t) => ({
        title: t.title,
        status: t.status,
        result: t.result_summary ?? t.error ?? null,
        created: t.created_at,
      })),
    };
  },
};

const endCall: ToolDef = {
  name: "end_call",
  integration: ID,
  description: "Hang up after you've said goodbye (conversation finished, or the caller is abusive).",
  input: z.object({ reason: z.string().max(200).default("conversation finished") }),
  roles: ["owner", "guest", "delegate"],
  sideEffect: false,
  async run() {
    return { ended: true };
  },
};

export const perrieCore: IntegrationDef = {
  id: ID,
  name: "Perrie core",
  category: "core",
  description: "Messages, task planning and call handling — always on.",
  accent: "lilac",
  icon: "sparkles",
  connect: { kind: "builtin" },
  async status() {
    return { connected: true, label: "Built in" };
  },
  tools: [takeMessage, listMessagesTool, createTask, approveTask, recentTasks, endCall],
};

// ---------------------------------------------------------------------------
// Service integrations without agent tools (configured via environment).
// ---------------------------------------------------------------------------

const envStatus = (ok: boolean, label: string | null, hint: string) =>
  ok ? { connected: true, label } : { connected: false, hint };

export const deepgram: IntegrationDef = {
  id: "deepgram",
  name: "Deepgram",
  category: "voice",
  description: "Hears callers (speech-to-text) and gives Perrie its voice (text-to-speech).",
  accent: "pink",
  icon: "waves",
  connect: { kind: "env", vars: ["DEEPGRAM_API_KEY"] },
  async status() {
    const d = env.deepgram();
    return envStatus(!!d, d ? `${d.sttModel} · ${d.ttsVoice}` : null, "Add DEEPGRAM_API_KEY.");
  },
  tools: [],
};

export const anthropic: IntegrationDef = {
  id: "anthropic",
  name: "Claude",
  category: "intelligence",
  description: "The reasoning behind conversations, task plans and call summaries.",
  accent: "amber",
  icon: "brain",
  connect: { kind: "env", vars: ["ANTHROPIC_API_KEY"] },
  async status() {
    const a = env.anthropic();
    return envStatus(!!a, a ? `${a.voiceModel} / ${a.plannerModel}` : null, "Add ANTHROPIC_API_KEY.");
  },
  tools: [],
};

export const supabase: IntegrationDef = {
  id: "supabase",
  name: "Supabase",
  category: "storage",
  description: "Stores your profile, calls, transcripts and tasks.",
  accent: "mint",
  icon: "database",
  connect: { kind: "env", vars: ["SUPABASE_URL", "SUPABASE_SECRET_KEY"] },
  async status() {
    const s = env.supabase();
    return s
      ? { connected: true, label: new URL(s.url).host }
      : { connected: false, hint: "Using local dev storage. Add SUPABASE_URL and SUPABASE_SECRET_KEY." };
  },
  tools: [],
};

export const bluejay: IntegrationDef = {
  id: "bluejay",
  name: "Bluejay",
  category: "quality",
  description: "Simulated callers and monitoring that test how well the voice agent performs.",
  accent: "sky",
  icon: "activity",
  connect: { kind: "env", vars: ["BLUEJAY_API_KEY"] },
  async status() {
    return envStatus(!!env.bluejay(), "MCP · api.getbluejay.ai", "Add BLUEJAY_API_KEY.");
  },
  tools: [],
};
