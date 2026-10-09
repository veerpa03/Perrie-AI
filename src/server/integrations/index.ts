import { googleCalendar } from "./google/calendar";
import { googleContacts } from "./google/contacts";
import type { AppIntegration } from "./types";

/**
 * The owner's app integrations. To add one (Excel, GitHub, Notion, ...):
 * create an AppIntegration (status + zod-typed tools with roles and
 * side-effect flags) and list it here. The phone agent, task planner,
 * orchestrator, guardrails and the Integrations page pick it up automatically.
 */
export const APP_INTEGRATIONS: AppIntegration[] = [googleCalendar, googleContacts];

export const getAppIntegration = (id: string) => APP_INTEGRATIONS.find((i) => i.id === id);
