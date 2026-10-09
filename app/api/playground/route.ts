import { z } from "zod";
import { LlmUnavailableError } from "@/server/agent/llm";
import { AgentSession } from "@/server/agent/session";
import { db, getProfile, listFacts, listTurns } from "@/server/db";
import { closeOutCall, finalizeCallOnce } from "@/server/voice/finalize";

/**
 * Text playground for the phone agent: the same AgentSession, tools, role
 * checks and guardrails as a real call, without Twilio/Deepgram. Sessions
 * live in memory; transcripts are stored like calls (direction "web").
 * Dashboard-only (guarded by the server's local/password check).
 */

const g = globalThis as unknown as { __perriePlayground?: Map<string, { session: AgentSession; at: number }> };
const sessions = (g.__perriePlayground ??= new Map());

const body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    role: z.enum(["owner", "guest", "delegate"]),
    counterpart: z.string().trim().max(120).optional(),
    mission: z.string().trim().max(1500).optional(),
  }),
  z.object({ action: z.literal("say"), callId: z.string(), text: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal("end"), callId: z.string() }),
]);

const json = (data: unknown, status = 200) => Response.json(data, { status });

function sweep() {
  const cutoff = Date.now() - 30 * 60_000;
  for (const [id, s] of sessions) {
    if (s.at >= cutoff) continue;
    sessions.delete(id);
    // Abandoned conversation: still give it a summary (and a Bluejay score).
    void closeOutCall(id, "playground conversation abandoned").catch((err) => console.error("[playground] close-out failed", err));
  }
}

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Bad request" }, 400);
  const input = parsed.data;
  sweep();

  try {
    if (input.action === "start") {
      if (input.role === "delegate" && (!input.mission || input.mission.length < 10)) {
        return json({ error: "Give Perrie a mission for the call (at least a sentence)." }, 400);
      }
      const [profile, facts] = await Promise.all([getProfile(), listFacts()]);
      const call = await db().insert("calls", {
        twilio_call_sid: null,
        direction: "web",
        role: input.role,
        from_number: null,
        to_number: null,
        counterpart_name: input.counterpart || null,
        status: "in-progress",
        mission: input.role === "delegate" ? input.mission! : null,
        summary: null,
        outcome: null,
        task_id: null,
        task_step_id: null,
        started_at: new Date().toISOString(),
        ended_at: null,
        duration_seconds: null,
      });
      const session = await AgentSession.create({
        role: input.role,
        channel: "text",
        callId: call.id,
        profile,
        facts,
        mission: call.mission,
        counterpartName: call.counterpart_name,
        caller: { name: input.role === "guest" ? input.counterpart || null : null },
      });
      await session.logGreeting();
      sessions.set(call.id, { session, at: Date.now() });
      return json({ callId: call.id, greeting: session.greeting, tools: session.toolNames });
    }

    const entry = sessions.get(input.callId);
    if (input.action === "say") {
      if (!entry) return json({ error: "This conversation has expired — start a new one." }, 410);
      entry.at = Date.now();
      const before = (await listTurns(input.callId)).length;
      const { text, ended } = await entry.session.respond(input.text);
      const turns = (await listTurns(input.callId)).slice(before);
      return json({
        reply: text,
        ended,
        events: turns
          .filter((t) => t.speaker === "tool" || t.speaker === "system")
          .map((t) => ({ kind: t.speaker, text: t.text, meta: t.meta })),
      });
    }

    // end
    sessions.delete(input.callId);
    const call = await db().get("calls", input.callId);
    if (!call) return json({ error: "Not found" }, 404);
    if (!call.ended_at) {
      const ended = new Date();
      await db().update("calls", call.id, {
        status: "completed",
        ended_at: ended.toISOString(),
        duration_seconds: Math.round((ended.getTime() - new Date(call.started_at ?? call.created_at).getTime()) / 1000),
      });
    }
    await finalizeCallOnce(call.id);
    const done = await db().get("calls", call.id);
    return json({ summary: done?.summary ?? null });
  } catch (err) {
    if (err instanceof LlmUnavailableError) return json({ error: err.message }, 503);
    console.error("[playground]", err);
    return json({ error: (err as Error).message }, 500);
  }
}
