/**
 * Monitoring tables come from their own migration
 * (supabase/migrations/20261009010000_monitoring.sql). Pages that only show
 * monitoring alongside other things read them through this, so a database
 * without that migration still renders — the Monitoring page says what's
 * missing.
 */
export async function orEmpty<T>(read: Promise<T>, fallback: T): Promise<{ value: T; missing: boolean }> {
  try {
    return { value: await read, missing: false };
  } catch (err) {
    console.warn("[monitoring] read failed (is the monitoring migration applied?)", (err as Error).message);
    return { value: fallback, missing: true };
  }
}
