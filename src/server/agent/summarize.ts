import { db, getProfile, listTurns, ownerName } from "../db";
import { bluejayConfigured } from "../monitoring/bluejay/client";
import { queueCallEvaluation } from "../monitoring/bluejay/evaluations";
import { completeAsyncStep } from "../orchestrator/executor";
import { LlmUnavailableError, models, structured } from "./llm";

/**
 * After a call: write a readable description + structured outcome from the
 * transcript alone, hand the call to Bluejay for monitoring, then (for calls
 * placed by a task) report back to the orchestrator so the task can continue.
 */

type Outcome = {
  summary: string;
  achieved: boolean | null;
  key_points: string[];
  agreed_time: string | null;
  follow_ups: string[];
};

const SUBMIT = {
  name: "submit_call_summary",
  description: "Submit the call summary.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "2–4 plain sentences: who called / was called, what they wanted, what happened.",
      },
      achieved: {
        type: ["boolean", "null"],
        description: "For a call with a mission: was it achieved? null if there was no mission.",
      },
      key_points: { type: "array", items: { type: "string" }, description: "Concrete facts stated in the call (names, times, numbers)." },
      agreed_time: {
        type: ["string", "null"],
        description: 'If a date/time was explicitly agreed: "YYYY-MM-DDTHH:mm" in the owner\'s timezone; otherwise null.',
      },
      follow_ups: { type: "array", items: { type: "string" }, description: "Things the owner needs to do or decide." },
    },
    required: ["summary", "achieved", "key_points", "agreed_time", "follow_ups"],
  },
};

const NOT_REACHED = new Set(["no-answer", "busy", "failed", "canceled"]);

export async function finalizeCall(callId: string): Promise<void> {
  const call = await db().get("calls", callId);
  if (!call || call.summary) return;
  const turns = await listTurns(callId);
  const spoken = turns.filter((t) => t.speaker === "caller" || t.speaker === "agent");
  const callerSpoke = turns.some((t) => t.speaker === "caller");
  const profile = await getProfile();
  const name = ownerName(profile);
  const who = call.counterpart_name ?? call.from_number ?? call.to_number ?? "the caller";

  let outcome: Outcome;
  if (!callerSpoke) {
    const why = NOT_REACHED.has(call.status) ? call.status.replace("-", " ") : "no one spoke";
    outcome = {
      summary:
        call.direction === "outbound"
          ? `Perrie called ${who} but didn't reach anyone (${why}).`
          : `${who} called but hung up before saying anything.`,
      achieved: call.mission ? false : null,
      key_points: [],
      agreed_time: null,
      follow_ups: [],
    };
  } else {
    const transcript = spoken
      .map((t) => `${t.speaker === "agent" ? profile?.assistant_name ?? "Perrie" : who}: ${t.text}`)
      .join("\n");
    const context = [
      `Call ${call.direction === "outbound" ? `placed by Perrie to ${who}` : `from ${who}`}; caller role: ${call.role}.`,
      call.mission ? `Mission: ${call.mission}` : "",
      `Owner: ${name}; timezone ${profile?.timezone ?? "UTC"}; call date ${call.started_at ?? call.created_at}.`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      outcome = await structured<Outcome>({
        model: models().voice,
        system:
          "You summarise phone calls for the owner. Use ONLY what is in the transcript. Never add details, times or commitments that weren't explicitly said. If something is unclear, say so.",
        user: `${context}\n\nTranscript:\n${transcript}`,
        tool: SUBMIT,
        maxTokens: 800,
      });
    } catch (err) {
      const why = err instanceof LlmUnavailableError ? "no language model configured" : (err as Error).message;
      outcome = {
        summary: `Call with ${who} (${spoken.length} turns). Automatic summary unavailable: ${why}.`,
        achieved: null,
        key_points: [],
        agreed_time: null,
        follow_ups: [],
      };
    }
  }

  await db().update("calls", callId, {
    summary: outcome.summary,
    outcome: {
      achieved: outcome.achieved,
      key_points: outcome.key_points ?? [],
      agreed_time: outcome.agreed_time ?? null,
      follow_ups: outcome.follow_ups ?? [],
    },
  });

  // Monitoring: runs once per call (this function returns early once a
  // summary exists) and never holds up the call or the task.
  if (bluejayConfigured()) {
    void queueCallEvaluation(callId).catch((err) => console.error("[monitoring] evaluate failed", err));
  }

  if (call.task_step_id) {
    if (!callerSpoke) {
      await completeAsyncStep(call.task_step_id, { ok: false, error: outcome.summary });
    } else {
      await completeAsyncStep(call.task_step_id, {
        ok: true,
        output: {
          call_id: callId,
          summary: outcome.summary,
          achieved: outcome.achieved,
          agreed_time: outcome.agreed_time,
          key_points: outcome.key_points,
          follow_ups: outcome.follow_ups,
        },
      });
    }
  }
}
