import type { ToolProvider } from "../tools/types";

/**
 * App integrations: the owner's own apps Perrie can work with on their
 * behalf (Google Calendar, Google Contacts today; Excel, GitHub, ... later).
 * The voice stack (Twilio, Deepgram, Claude, Supabase) lives in platform/,
 * and voice-agent monitoring (Bluejay) in monitoring/ — neither is an
 * integration.
 */

export type IntegrationCategory = "calendar" | "contacts" | "documents" | "spreadsheets" | "developer" | "communication" | "other";

export interface AppIntegration extends ToolProvider {
  category: IntegrationCategory;
  description: string;
  /** Dashboard accent + icon key (see integrationIcons). */
  accent: "lilac" | "pink" | "amber" | "mint" | "sky" | "coral" | "slate";
  icon: string;
  /** How the owner connects it from the Integrations page. */
  connect: { kind: "oauth"; provider: "google"; scopes: string[] } | { kind: "api_key"; vars: string[] };
}
