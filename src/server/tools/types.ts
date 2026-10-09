import type { z } from "zod";
import type { OwnerProfile } from "../db/types";

/**
 * Tool contracts shared by everything the agent can call. Tools come from
 * "tool providers": Perrie's built-in capabilities (core, telephony) and the
 * owner's app integrations (Google Calendar, Contacts, ...). The registry
 * (tools/registry.ts) collects them; every call goes through executeTool.
 */

/**
 * Who the agent is acting for in the current context:
 * - owner:    the verified owner (caller ID + PIN) on a live call / playground
 * - system:   the orchestrator executing an owner-approved task plan
 * - delegate: an outbound call Perrie places on the owner's behalf
 * - guest:    anyone else who calls the owner's assistant
 */
export type AgentRole = "owner" | "system" | "delegate" | "guest";

export interface ToolContext {
  role: AgentRole;
  profile: OwnerProfile | null;
  timezone: string;
  callId?: string | null;
  taskId?: string | null;
  stepId?: string | null;
  /** Caller details on live calls (used e.g. to prefill a message). */
  caller?: { number?: string | null; name?: string | null };
}

export interface ToolDef<S extends z.ZodType = z.ZodType, O = unknown> {
  /** Globally unique snake_case name, e.g. "calendar_create_event". */
  name: string;
  /** Id of the ToolProvider that owns it (gates availability). */
  provider: string;
  /** Written for the model: what it does and when to use it. */
  description: string;
  input: S;
  /** Roles allowed to use the tool. Enforced server-side, not by prompt. */
  roles: AgentRole[];
  /** Changes something in the world -> needs explicit confirmation on live calls. */
  sideEffect: boolean;
  /**
   * Completes later (e.g. a phone call). In a task plan the step waits until
   * the orchestrator is told the outcome.
   */
  async?: boolean;
  /** One-line human description of a concrete call, for read-backs + logs. */
  describe?(input: z.infer<S>): string;
  run(input: z.infer<S>, ctx: ToolContext): Promise<O>;
}

export type AnyTool = ToolDef<z.ZodType, unknown>;

export interface ProviderStatus {
  connected: boolean;
  /** e.g. the Google account e-mail, or the Twilio number. */
  label?: string | null;
  /** What's missing / how to connect. */
  hint?: string;
  error?: string;
}

/** Anything that contributes tools to the agent. */
export interface ToolProvider {
  id: string;
  name: string;
  status(): Promise<ProviderStatus>;
  tools: AnyTool[];
}
