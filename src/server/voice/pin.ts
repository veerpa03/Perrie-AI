import { db } from "../db";

const MAX_FAILURES_PER_HOUR = 5;

/** Brute-force protection: too many wrong PINs in the last hour locks owner mode. */
export async function pinLockedOut(): Promise<boolean> {
  const since = Date.now() - 3600_000;
  const recent = await db().list("guardrail_events", {
    where: { kind: "owner_pin_failed" },
    orderBy: "created_at",
    ascending: false,
    limit: MAX_FAILURES_PER_HOUR,
  });
  return recent.filter((e) => new Date(e.created_at).getTime() > since).length >= MAX_FAILURES_PER_HOUR;
}
