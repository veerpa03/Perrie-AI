import { bluejayConfigured } from "./bluejay/client";
import { processDueEvaluations } from "./bluejay/evaluations";
import { processDueSimulationRuns } from "./bluejay/simulations";

/**
 * Background loop (started by server/index.ts): submits queued call
 * evaluations, polls Bluejay for finished scores and simulation results.
 */
const g = globalThis as unknown as { __perrieMonitorTimer?: NodeJS.Timeout };

export function startMonitoringPoller(everyMs = 30_000) {
  if (g.__perrieMonitorTimer) return;
  let running = false;
  g.__perrieMonitorTimer = setInterval(async () => {
    if (running || !bluejayConfigured()) return;
    running = true;
    try {
      await processDueEvaluations();
      await processDueSimulationRuns();
    } catch (err) {
      console.error("[monitoring] poll failed", err);
    } finally {
      running = false;
    }
  }, everyMs);
  g.__perrieMonitorTimer.unref?.();
}
