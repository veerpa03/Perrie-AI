import { finalizeCall } from "../agent/summarize";

/**
 * A call can end from two directions (media stream closes, Twilio status
 * callback). Summarise + report back exactly once.
 */
const g = globalThis as unknown as { __perrieFinalizing?: Set<string> };
const inFlight = (g.__perrieFinalizing ??= new Set<string>());

export async function finalizeCallOnce(callId: string): Promise<void> {
  if (inFlight.has(callId)) return;
  inFlight.add(callId);
  try {
    await finalizeCall(callId);
  } catch (err) {
    console.error("[voice] finalize failed", err);
  } finally {
    inFlight.delete(callId);
  }
}
