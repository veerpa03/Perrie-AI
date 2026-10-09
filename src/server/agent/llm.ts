import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";

export class LlmUnavailableError extends Error {
  constructor() {
    super("No language model configured: add ANTHROPIC_API_KEY to .env.local.");
  }
}

const g = globalThis as unknown as { __perrieAnthropic?: { key: string; client: Anthropic } };

export function llm(): Anthropic {
  const a = env.anthropic();
  if (!a) throw new LlmUnavailableError();
  if (g.__perrieAnthropic?.key !== a.apiKey) {
    g.__perrieAnthropic = { key: a.apiKey, client: new Anthropic({ apiKey: a.apiKey, maxRetries: 2 }) };
  }
  return g.__perrieAnthropic.client;
}

export const models = () => {
  const a = env.anthropic();
  if (!a) throw new LlmUnavailableError();
  return { voice: a.voiceModel, planner: a.plannerModel };
};

type ToolUseBlock = Anthropic.Messages.ToolUseBlock;

/**
 * Ask the model for structured output by forcing a single "submit" tool.
 * Returns the tool input (validated by the caller).
 */
export async function structured<T>(opts: {
  model: string;
  system: string;
  user: string;
  tool: { name: string; description: string; input_schema: Anthropic.Messages.Tool.InputSchema };
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
