/** Date / duration formatting shared by dashboard pages (owner's timezone). */

export function fmtDateTime(iso: string | null | undefined, timeZone = "UTC"): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en", {
      timeZone,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return new Date(iso).toISOString().replace("T", " ").slice(0, 16);
  }
}

export function fmtTime(iso: string | null | undefined, timeZone = "UTC"): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export function timeAgo(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const diff = Math.max(0, now - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

/** Greeting for the owner's local time of day. */
export function greeting(timeZone = "UTC"): string {
  let hour = 12;
  try {
    hour = Number(new Intl.DateTimeFormat("en", { timeZone, hour: "numeric", hourCycle: "h23" }).format(new Date()));
  } catch {
    /* default */
  }
  return hour < 5 ? "Hello" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** "2026-10-14T15:30" (already in the owner's zone) -> "Tue, Oct 14, 3:30 PM". */
export function fmtWallTime(wall: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(wall);
  if (!m) return wall;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)));
  return new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(m[4] ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(d);
}
