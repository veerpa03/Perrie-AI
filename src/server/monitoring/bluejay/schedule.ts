import { BluejayError, withBluejay } from "./client";
import { listIn } from "./setup";
import { getMonitoringConfig, saveMonitoringState, getMonitoringState } from "./state";

/**
 * Optional daily guardrail run (Bluejay create_schedule). Off until the owner
 * turns it on, because every simulated call is a real phone call.
 * Schedule shape: {"frequency":"daily","time":"HH:MM"} (Bluejay's DailySchedule).
 */
export async function scheduleDailyRun(time = "09:00"): Promise<string> {
  const config = await getMonitoringConfig();
  if (!config.simulation_id) throw new BluejayError("Set up monitoring first.");
  const id = await withBluejay(async (s) => {
    if (s.has("list_schedules")) {
      const all = listIn(await s.call("list_schedules"), "schedules");
      const hit = all.find((x) => String(x.simulation_id) === String(config.simulation_id));
      if (hit?.id !== undefined) return String(hit.id);
    }
    const res = await s.call<{ id?: unknown }>("create_schedule", {
      simulation_id: String(config.simulation_id),
      schedule: { frequency: "daily", time },
      enabled: true,
    });
    return res?.id !== undefined ? String(res.id) : "";
  });
  const row = await getMonitoringState();
  await saveMonitoringState(row?.status ?? "ready", { ...config, schedule_id: id || null }, row?.last_error ?? null);
  return id;
}
