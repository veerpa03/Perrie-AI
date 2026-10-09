import { db } from "../../db";

/**
 * What Perrie set up in Bluejay (kept in monitoring_state, id "bluejay").
 * The agent is addressed by Perrie's own external id, so evaluation works
 * even before Bluejay's numeric agent id is known.
 */
export type SetupStep = { key: string; label: string; ok: boolean; skipped?: boolean; detail: string };

export type MonitoringConfig = {
  agent_external_id: string;
  agent_id?: string | null;
  metric_names?: string[];
  metric_ids?: string[];
  /** Bluejay's own phone numbers: inbound calls from these are simulation calls. */
  simulation_numbers?: string[];
  simulation_id?: string | null;
  digital_human_count?: number;
  /** Scenario title -> Bluejay digital human id (to label simulation results). */
  digital_humans?: Record<string, string>;
  uptime_monitor_id?: string | null;
  schedule_id?: string | null;
  alert_ids?: string[];
  steps?: SetupStep[];
  last_sync_at?: string | null;
  mcp_server?: string | null;
};

export const DEFAULT_AGENT_EXTERNAL_ID = "perrie-voice";

export const agentExternalId = () => process.env.BLUEJAY_AGENT_EXTERNAL_ID?.trim() || DEFAULT_AGENT_EXTERNAL_ID;

export async function getMonitoringState() {
  return db().get("monitoring_state", "bluejay");
}

export async function getMonitoringConfig(): Promise<MonitoringConfig> {
  const row = await getMonitoringState();
  return { ...(row?.config as MonitoringConfig | undefined), agent_external_id: agentExternalId() };
}

export async function saveMonitoringState(
  status: "not_set_up" | "ready" | "partial" | "error",
  config: MonitoringConfig,
  lastError: string | null,
) {
  return db().upsert("monitoring_state", {
    id: "bluejay",
    status,
    config: config as unknown as Record<string, unknown>,
    last_error: lastError,
  });
}
