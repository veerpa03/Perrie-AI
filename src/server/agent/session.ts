import type Anthropic from "@anthropic-ai/sdk";
import { addTurn, logGuardrail } from "../db";
import type { OwnerProfile, ProfileFact } from "../db/types";
import { availableTools, executeTool, getTool, toAnthropicTools } from "../tools/registry";
import type { AnyTool } from "../tools/types";
import { actionKey, buildLeakFilter, isAffirmative, looksLikeManipulation, type LeakFilter } from "./guardrails";
import { llm, models } from "./llm";
import { greetingFor, systemPrompt, type Channel, type ConversationRole, type PromptContext } from "./prompts";

/**
 * One conversation with the agent (a phone call or a playground chat).
 *
 * Guardrails enforced here, outside the model:
 *  - tools are filtered by role; executeTool re-checks the role on every call;
 *  - side effects need confirmation: the first attempt is parked and the
 *    model is told to ask; it only runs when the model repeats the SAME
 *    action after the person has spoken and actually said yes;
 *  - for non-owners every sentence passes the private-detail leak filter
 *    before it is spoken;
 *  - manipulation attempts are logged.
 * Every turn and tool call is written to the call transcript.
 */

type MessageParam = Anthropic.Messages.MessageParam;
type ContentBlock = Anthropic.Messages.ContentBlock;

const MAX_TOOL_ROUNDS = 6;
const SENTENCE_END = /([.!?…]["')\]]?)(\s+)/;

export interface SessionOptions {
  role: ConversationRole;
  channel: Channel;
  callId: string | null;
  profile: OwnerProfile | null;
  facts: ProfileFact[];
  mission?: string | null;
  counterpartName?: string | null;
  caller?: { number?: string | null; name?: string | null };
}

export interface RespondOptions {
  signal?: AbortSignal;
  /** Called with each sentence as soon as it is ready (already filtered). */
  onSentence?: (sentence: string) => void;
}

export class AgentSession {
  readonly opts: SessionOptions;
  private readonly system: string;
  private readonly tools: AnyTool[];
  private readonly leakFilter: LeakFilter | null;
  private readonly messages: MessageParam[] = [];
  private userTurns = 0;
  private lastUserText = "";
  private parked: { key: string; atTurn: number } | null = null;
  ended = false;

  private constructor(opts: SessionOptions, tools: AnyTool[]) {
    this.opts = opts;
    this.tools = tools;
    const ctx: PromptContext = {
      role: opts.role,
      channel: opts.channel,
      profile: opts.profile,
      // Non-owners never even see private facts in the prompt.
      facts: opts.role === "owner" ? opts.facts : opts.facts.filter((f) => f.visibility === "shareable"),
      mission: opts.mission,
      counterpartName: opts.counterpartName,
      callerKnownAs: opts.caller?.name ?? null,
    };
    this.system = systemPrompt(ctx);
    this.leakFilter = opts.role === "owner" ? null : buildLeakFilter(opts.profile, opts.facts);
    const greeting = greetingFor(ctx);
    this.messages.push({ role: "user", content: "(The call has connected.)" }, { role: "assistant", content: greeting });
    this.greeting = greeting;
  }

  readonly greeting: string;

  static async create(opts: SessionOptions): Promise<AgentSession> {
    const tools = await availableTools(opts.role);
    return new AgentSession(opts, tools);
  }

  get toolNames() {
    return this.tools.map((t) => t.name);
  }

  private async log(speaker: "caller" | "agent" | "system" | "tool", text: string, meta: Record<string, unknown> = {}) {
    if (!this.opts.callId) return;
    try {
      await addTurn(this.opts.callId, speaker, text, meta);
    } catch (err) {
      console.error("[session] transcript write failed", err);
    }
  }

  /** Write the greeting to the transcript (call once when it is spoken). */
  async logGreeting() {
    await this.log("agent", this.greeting);
  }

  private filter(sentence: string): string {
    if (!this.leakFilter) return sentence;
    const { text, leaked } = this.leakFilter(sentence);
    if (leaked.length) {
      void logGuardrail({
        kind: "private_detail_blocked",
        severity: "block",
        detail: `Stopped a sentence that contained a private detail (${leaked.length} match${leaked.length > 1 ? "es" : ""}).`,
        call_id: this.opts.callId,
        meta: { role: this.opts.role },
      });
    }
    return text;
  }

  async respond(userText: string, ro: RespondOptions = {}): Promise<{ text: string; ended: boolean }> {
    this.userTurns += 1;
    this.lastUserText = userText;
    this.messages.push({ role: "user", content: userText });
    await this.log("caller", userText);
    if (looksLikeManipulation(userText)) {
      await logGuardrail({
        kind: "manipulation_attempt",
        severity: "warn",
        detail: `${this.opts.role === "owner" ? "Owner" : "Caller"} said something that looks like an attempt to override Perrie's rules.`,
        call_id: this.opts.callId,
        meta: { excerpt: userText.slice(0, 160) },
      });
    }

    const spoken: string[] = [];
    const say = (s: string) => {
      const clean = this.filter(s.trim());
      if (!clean) return;
      spoken.push(clean);
      ro.onSentence?.(clean);
    };

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (ro.signal?.aborted) break;
      let buffer = "";
      const stream = llm().messages.stream(
        {
          model: models().voice,
          max_tokens: this.opts.channel === "voice" ? 400 : 700,
          system: this.system,
          messages: this.messages,
          tools: toAnthropicTools(this.tools),
        },
        { signal: ro.signal },
      );
      stream.on("text", (delta) => {
        buffer += delta;
        let m: RegExpExecArray | null;
        while ((m = SENTENCE_END.exec(buffer))) {
          const end = m.index + m[1].length;
          say(buffer.slice(0, end));
          buffer = buffer.slice(end + m[2].length);
        }
      });

      let final: Anthropic.Messages.Message;
      try {
        final = await stream.finalMessage();
      } catch (err) {
        if (ro.signal?.aborted) {
          // Barge-in: keep what was actually said so the model knows.
          if (spoken.length) this.messages.push({ role: "assistant", content: `${spoken.join(" ")} …(interrupted)` });
          break;
        }
        throw err;
      }
      if (buffer.trim()) say(buffer);

      // Store the assistant turn with the filtered text so later turns can't
      // build on a blocked sentence.
      const content: ContentBlock[] = final.content.map((b) =>
        b.type === "text" && this.leakFilter ? { ...b, text: this.filter(b.text) } : b,
      );
      this.messages.push({ role: "assistant", content });

      const toolUses = content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use");
      if (final.stop_reason !== "tool_use" || !toolUses.length) break;

      const results: Anthropic.Messages.ToolResultBlockParam[] = [];
      for (const use of toolUses) results.push(await this.runTool(use));
      this.messages.push({ role: "user", content: results });
      if (this.ended) break;
    }

    const text = spoken.join(" ");
    if (text) await this.log("agent", text);
    return { text, ended: this.ended };
  }

  private async runTool(use: Anthropic.Messages.ToolUseBlock): Promise<Anthropic.Messages.ToolResultBlockParam> {
    const tool = getTool(use.name);
    const reply = (content: unknown, isError = false): Anthropic.Messages.ToolResultBlockParam => ({
      type: "tool_result",
      tool_use_id: use.id,
      content: JSON.stringify(content).slice(0, 6000),
      is_error: isError || undefined,
    });

    // Confirmation gate for actions that change something.
    if (tool?.sideEffect && tool.roles.includes(this.opts.role)) {
      const key = actionKey(use.name, use.input);
      const confirmed =
        this.parked?.key === key && this.userTurns > this.parked.atTurn && isAffirmative(this.lastUserText);
      if (!confirmed) {
        this.parked = { key, atTurn: this.userTurns };
        let what = use.name;
        try {
          what = tool.describe?.(tool.input.parse(use.input)) ?? use.name;
        } catch {
          /* invalid input is reported when it actually runs */
        }
        await this.log("system", `Waiting for a clear yes before: ${what}`, { tool: use.name, guard: "confirmation" });
        await logGuardrail({
          kind: "confirmation_required",
          severity: "info",
          detail: `Asked for confirmation before: ${what}`,
          call_id: this.opts.callId,
          meta: { tool: use.name },
        });
        return reply({
          status: "needs_confirmation",
          instruction: `Not done yet. Tell the person exactly what you're about to do (${what}) and ask them to confirm. Only if they clearly say yes, call ${use.name} again with the same input.`,
        });
      }
      this.parked = null;
    }

    const outcome = await executeTool(use.name, use.input, {
      role: this.opts.role,
      profile: this.opts.profile,
      timezone: this.opts.profile?.timezone ?? "UTC",
      callId: this.opts.callId,
      caller: this.opts.caller,
    });

    if (outcome.ok && use.name === "end_call") this.ended = true;
    await this.log(
      "tool",
      outcome.ok ? `${use.name} ✓` : `${use.name} ✗ ${outcome.error}`,
      {
        tool: use.name,
        ok: outcome.ok,
        blocked: !outcome.ok && outcome.blocked ? true : undefined,
        input: use.input,
        output: outcome.ok ? outcome.output : undefined,
      },
    );
    return outcome.ok ? reply(outcome.output) : reply({ error: outcome.error }, true);
  }
}
