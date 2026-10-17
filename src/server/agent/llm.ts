import { env } from "../env";

/**
 * Thin Groq (OpenAI-compatible chat completions) client shaped like the
 * Anthropic Messages API the rest of the agent code was written against:
 * content-block arrays, `tool_use`/`tool_result` blocks, `stop_reason`. This
 * means session.ts/executor.ts/planner.ts/summarize.ts don't need to know
 * which provider is behind `llm()` — only this file talks OpenAI-shape HTTP.
 */

export class LlmUnavailableError extends Error {
  constructor() {
    super("No language model configured: add GROQ_API_KEY to .env.local.");
  }
}

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}
export interface TextBlock {
  type: "text";
  text: string;
}
export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}
export type ContentBlock = TextBlock | ToolUseBlock;
export interface ToolResultBlockParam {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}
export interface MessageParam {
  role: "user" | "assistant";
  content: string | (ContentBlock | ToolResultBlockParam)[];
}
export interface Message {
  content: ContentBlock[];
  stop_reason: "tool_use" | "end_turn" | string;
}
export type ToolChoice = { type: "tool"; name: string } | { type: "any" } | { type: "auto" };

interface CreateParams {
  model: string;
  max_tokens: number;
  system: string;
  messages: MessageParam[];
  tools?: ToolSchema[];
  tool_choice?: ToolChoice;
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function apiKey(): string {
  const g = env.groq();
  if (!g) throw new LlmUnavailableError();
  return g.apiKey;
}

export const models = () => {
  const g = env.groq();
  if (!g) throw new LlmUnavailableError();
  return { voice: g.voiceModel, planner: g.plannerModel };
};

function toOpenAiTools(tools?: ToolSchema[]) {
  if (!tools?.length) return undefined;
  return tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

function toOpenAiToolChoice(tc?: ToolChoice) {
  if (!tc) return undefined;
  if (tc.type === "tool") return { type: "function" as const, function: { name: tc.name } };
  if (tc.type === "any") return "required" as const;
  return "auto" as const;
}

function toOpenAiMessages(system: string, messages: MessageParam[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [{ role: "system", content: system }];
  for (const m of messages) {
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content });
      continue;
    }
    if (m.role === "user") {
      const toolResults = m.content.filter((b): b is ToolResultBlockParam => b.type === "tool_result");
      if (toolResults.length) {
        for (const tr of toolResults) out.push({ role: "tool", tool_call_id: tr.tool_use_id, content: tr.content });
        continue;
      }
      const text = m.content.map((b) => ("text" in b ? b.text : "")).join("");
      out.push({ role: "user", content: text });
      continue;
    }
    const text = m.content
      .filter((b): b is TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const toolUses = m.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
    const assistantMsg: Record<string, unknown> = { role: "assistant", content: text || null };
    if (toolUses.length) {
      assistantMsg.tool_calls = toolUses.map((tu) => ({
        id: tu.id,
        type: "function",
        function: { name: tu.name, arguments: JSON.stringify(tu.input ?? {}) },
      }));
    }
    out.push(assistantMsg);
  }
  return out;
}

function parseToolArgs(raw: string): unknown {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

async function callGroq(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey()}` },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(`Groq API error ${res.status}: ${await res.text()}`);
  return res;
}

function messageFromChoice(choice: {
  message: { content: string | null; tool_calls?: { id: string; function: { name: string; arguments: string } }[] };
  finish_reason: string;
}): Message {
  const content: ContentBlock[] = [];
  if (choice.message.content) content.push({ type: "text", text: choice.message.content });
  for (const tc of choice.message.tool_calls ?? []) {
    content.push({ type: "tool_use", id: tc.id, name: tc.function.name, input: parseToolArgs(tc.function.arguments) });
  }
  return { content, stop_reason: choice.finish_reason === "tool_calls" ? "tool_use" : "end_turn" };
}

async function create(p: CreateParams): Promise<Message> {
  const res = await callGroq({
    model: p.model,
    max_tokens: p.max_tokens,
    messages: toOpenAiMessages(p.system, p.messages),
    tools: toOpenAiTools(p.tools),
    tool_choice: toOpenAiToolChoice(p.tool_choice),
    // gpt-oss models spend tokens on hidden reasoning before replying; "low"
    // keeps that overhead small so max_tokens goes to the actual answer.
    reasoning_effort: "low",
  });
  const json = (await res.json()) as { choices: Parameters<typeof messageFromChoice>[0][] };
  return messageFromChoice(json.choices[0]);
}

export interface StreamHandle {
  on(ev: "text", cb: (delta: string) => void): StreamHandle;
  finalMessage(): Promise<Message>;
}

interface StreamChunk {
  choices?: {
    delta?: {
      content?: string;
      tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
    };
    finish_reason?: string;
  }[];
}

function stream(p: CreateParams, opts: { signal?: AbortSignal } = {}): StreamHandle {
  const listeners: ((d: string) => void)[] = [];
  const handle: StreamHandle = {
    on(ev, cb) {
      if (ev === "text") listeners.push(cb);
      return handle;
    },
    async finalMessage() {
      const res = await callGroq(
        {
          model: p.model,
          max_tokens: p.max_tokens,
          messages: toOpenAiMessages(p.system, p.messages),
          tools: toOpenAiTools(p.tools),
          tool_choice: toOpenAiToolChoice(p.tool_choice),
          reasoning_effort: "low",
          stream: true,
        },
        opts.signal,
      );
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let text = "";
      const toolCalls = new Map<number, { id: string; name: string; args: string }>();
      let finishReason = "stop";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          let evt: StreamChunk;
          try {
            evt = JSON.parse(data);
          } catch {
            continue;
          }
          const choice = evt.choices?.[0];
          if (choice?.finish_reason) finishReason = choice.finish_reason;
          if (choice?.delta?.content) {
            text += choice.delta.content;
            listeners.forEach((l) => l(choice.delta!.content!));
          }
          for (const tc of choice?.delta?.tool_calls ?? []) {
            const entry = toolCalls.get(tc.index) ?? { id: tc.id ?? "", name: tc.function?.name ?? "", args: "" };
            if (tc.id) entry.id = tc.id;
            if (tc.function?.name) entry.name = tc.function.name;
            if (tc.function?.arguments) entry.args += tc.function.arguments;
            toolCalls.set(tc.index, entry);
          }
        }
      }
      const content: ContentBlock[] = [];
      if (text) content.push({ type: "text", text });
      for (const [, tc] of toolCalls) content.push({ type: "tool_use", id: tc.id, name: tc.name, input: parseToolArgs(tc.args) });
      return { content, stop_reason: finishReason === "tool_calls" ? "tool_use" : "end_turn" };
    },
  };
  return handle;
}

export interface LlmClient {
  messages: {
    create(p: CreateParams): Promise<Message>;
    stream(p: CreateParams, opts?: { signal?: AbortSignal }): StreamHandle;
  };
}

/** Tests substitute a scripted stand-in via globalThis.__perrieLlmOverride (see tests/helpers.ts). */
export function llm(): LlmClient {
  const override = (globalThis as unknown as { __perrieLlmOverride?: LlmClient }).__perrieLlmOverride;
  if (override) return override;
  if (!env.groq()) throw new LlmUnavailableError();
  return { messages: { create, stream } };
}

/**
 * Ask the model for structured output by forcing a single "submit" tool.
 * Returns the tool input (validated by the caller).
 */
export async function structured<T>(opts: {
  model: string;
  system: string;
  user: string;
  tool: ToolSchema;
  maxTokens?: number;
}): Promise<T> {
  const res = await llm().messages.create({
    model: opts.model,
    max_tokens: opts.maxTokens ?? 2048,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
    tools: [opts.tool],
    tool_choice: { type: "tool", name: opts.tool.name },
  });
  const block = res.content.find((b): b is ToolUseBlock => b.type === "tool_use");
  if (!block) throw new Error("The model did not return structured output.");
  return block.input as T;
}
