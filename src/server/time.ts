/**
 * Timezone helpers without extra dependencies. Wall-clock strings
 * ("2026-10-12T15:00") are interpreted in the owner's IANA timezone.
 */

const WALL = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/** Offset (minutes, east positive) of `timeZone` at the given UTC instant. */
export function tzOffsetMinutes(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60000);
}

/**
 * Parse an ISO string. With an explicit offset/Z it is used as-is; a bare
 * wall-clock time is interpreted in `timeZone` (DST-correct).
 */
export function parseInZone(value: string, timeZone: string): Date {
  const v = value.trim();
  const m = WALL.exec(v);
  if (!m) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) throw new Error(`Unrecognised date/time "${value}"`);
    return d;
  }
  const [, y, mo, d, h = "00", mi = "00", s = "00"] = m;
  const guess = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  // Two passes handle DST transitions.
  let ts = guess - tzOffsetMinutes(timeZone, new Date(guess)) * 60000;
  ts = guess - tzOffsetMinutes(timeZone, new Date(ts)) * 60000;
  return new Date(ts);
}

/** RFC 3339 with the zone's offset, e.g. 2026-10-12T15:00:00-07:00. */
export function toZonedIso(date: Date, timeZone: string): string {
  const off = tzOffsetMinutes(timeZone, date);
  const local = new Date(date.getTime() + off * 60000);
  const sign = off >= 0 ? "+" : "-";
  const abs = Math.abs(off);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${local.toISOString().slice(0, 19)}${sign}${hh}:${mm}`;
}

/** "Thursday, October 9, 2026, 4:05 PM" in the owner's zone, for prompts. */
export function humanNow(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);
}

/** Speakable time range, e.g. "Tue Oct 14, 3:00 PM – 3:30 PM". */
export function humanRange(start: Date, end: Date, timeZone: string): string {
  const day = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
  const t = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  return `${day.format(start)}, ${t.format(start)} – ${t.format(end)}`;
}
