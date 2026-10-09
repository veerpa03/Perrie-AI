import { z } from "zod";
import { db } from "../../db";
import { env } from "../../env";
import { humanRange, parseInZone, toZonedIso } from "../../time";
import type { ToolDef } from "../../tools/types";
import type { AppIntegration } from "../types";
import { GOOGLE_SCOPES, googleFetch } from "./oauth";

const API = "https://www.googleapis.com/calendar/v3";
const ID = "google_calendar";

const when = z
  .string()
  .min(10)
  .describe('Date-time in the owner\'s timezone, "YYYY-MM-DDTHH:mm" (or a date "YYYY-MM-DD").');

type GEvent = {
  id: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email: string }[];
};

function eventView(e: GEvent, tz: string) {
  const allDay = !!e.start?.date && !e.start?.dateTime;
  const start = new Date(e.start?.dateTime ?? `${e.start?.date}T00:00:00Z`);
  const end = new Date(e.end?.dateTime ?? `${e.end?.date}T00:00:00Z`);
  return {
    id: e.id,
    title: e.summary ?? "(no title)",
    when: allDay ? `${e.start?.date} (all day)` : humanRange(start, end, tz),
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    location: e.location ?? null,
    attendees: e.attendees?.length ?? 0,
  };
}

async function busyBlocks(fromIso: string, toIso: string, tz: string) {
  const fb = await googleFetch<{ calendars: Record<string, { busy: { start: string; end: string }[] }> }>(
    ID,
    `${API}/freeBusy`,
    { method: "POST", body: JSON.stringify({ timeMin: fromIso, timeMax: toIso, timeZone: tz, items: [{ id: "primary" }] }) },
  );
  return (fb.calendars?.primary?.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

const listEvents: ToolDef = {
  name: "calendar_list_events",
  provider: ID,
  description: "List the owner's Google Calendar events between two times. Use for 'what's on my calendar' questions.",
  input: z.object({ from: when, to: when, query: z.string().max(100).optional().describe("Optional text filter") }),
  roles: ["owner", "system"],
  sideEffect: false,
  async run(input: { from: string; to: string; query?: string }, ctx) {
    const params = new URLSearchParams({
      timeMin: parseInZone(input.from, ctx.timezone).toISOString(),
      timeMax: parseInZone(input.to, ctx.timezone).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "25",
    });
    if (input.query) params.set("q", input.query);
    const res = await googleFetch<{ items?: GEvent[] }>(ID, `${API}/calendars/primary/events?${params}`);
    const events = (res.items ?? []).map((e) => eventView(e, ctx.timezone));
    return { count: events.length, events };
  },
};

const freeSlotsInput = z.object({
  from: when,
  to: when,
  duration_minutes: z.number().int().min(10).max(480),
  day_start_hour: z.number().int().min(0).max(23).default(9),
  day_end_hour: z.number().int().min(1).max(24).default(18),
  max_results: z.number().int().min(1).max(10).default(5),
});

const findFreeSlots: ToolDef = {
  name: "calendar_find_free_slots",
  provider: ID,
  description:
    "Find open slots in the owner's calendar of a given length between two times, within working hours. Use before proposing or booking a time.",
  input: freeSlotsInput,
  roles: ["owner", "system", "delegate"],
  sideEffect: false,
  async run(input: z.infer<typeof freeSlotsInput>, ctx) {
    const tz = ctx.timezone;
    const from = new Date(Math.max(parseInZone(input.from, tz).getTime(), Date.now()));
    const to = parseInZone(input.to, tz);
    if (to <= from) return { slots: [], note: "The window is in the past or empty." };
    const busy = await busyBlocks(from.toISOString(), to.toISOString(), tz);
    const step = 30 * 60_000;
    const dur = input.duration_minutes * 60_000;
    const slots: { start: string; end: string; when: string }[] = [];
    // Start on the next half hour.
    let t = Math.ceil(from.getTime() / step) * step;
    while (t + dur <= to.getTime() && slots.length < input.max_results) {
      const s = new Date(t);
      const e = new Date(t + dur);
      const localHour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(s));
      const endLocal = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "numeric", hourCycle: "h23" })
        .format(e)
        .split(":")
        .map(Number);
      const endHourFrac = endLocal[0] + endLocal[1] / 60;
      const inHours = localHour >= input.day_start_hour && endHourFrac <= input.day_end_hour && endHourFrac > localHour;
      const clash = busy.some((b) => b.start < e && b.end > s);
      if (inHours && !clash) {
        slots.push({ start: toZonedIso(s, tz), end: toZonedIso(e, tz), when: humanRange(s, e, tz) });
        t += dur; // don't offer overlapping slots
      } else {
        t += step;
      }
    }
    return { slots, timezone: tz };
  },
};

const createInput = z.object({
  title: z.string().min(1).max(200),
  start: when,
  end: when.optional(),
  duration_minutes: z.number().int().min(5).max(720).optional(),
  description: z.string().max(2000).optional(),
  location: z.string().max(300).optional(),
  attendee_emails: z.array(z.email()).max(20).optional(),
  allow_conflict: z.boolean().default(false).describe("Only true if the owner explicitly accepted a clash."),
});

const createEvent: ToolDef = {
  name: "calendar_create_event",
  provider: ID,
  description:
    "Create an event on the owner's Google Calendar. Refuses if it clashes with an existing event unless allow_conflict is true.",
  input: createInput,
  roles: ["owner", "system"],
  sideEffect: true,
  describe: (i: z.infer<typeof createInput>) => `add "${i.title}" to your calendar at ${i.start}`,
  async run(input: z.infer<typeof createInput>, ctx) {
    const tz = ctx.timezone;
    const start = parseInZone(input.start, tz);
    const end = input.end
      ? parseInZone(input.end, tz)
      : new Date(start.getTime() + (input.duration_minutes ?? 30) * 60_000);
    if (end <= start) throw new Error("The event must end after it starts.");
    if (!input.allow_conflict) {
      const clashes = await busyBlocks(start.toISOString(), end.toISOString(), tz);
      if (clashes.length) {
        return {
          created: false,
          conflict: true,
          message: `That time clashes with ${clashes.length} existing event(s). Ask the owner before double-booking.`,
        };
      }
    }
    const params = new URLSearchParams({ sendUpdates: input.attendee_emails?.length ? "all" : "none" });
    const ev = await googleFetch<GEvent>(ID, `${API}/calendars/primary/events?${params}`, {
      method: "POST",
      body: JSON.stringify({
        summary: input.title,
        description: input.description ? `${input.description}\n\n— booked by Perrie` : "Booked by Perrie",
        location: input.location,
        start: { dateTime: toZonedIso(start, tz), timeZone: tz },
        end: { dateTime: toZonedIso(end, tz), timeZone: tz },
        attendees: input.attendee_emails?.map((email) => ({ email })),
      }),
    });
    return { created: true, ...eventView(ev, tz), link: ev.htmlLink ?? null };
  },
};

export const googleCalendar: AppIntegration = {
  id: ID,
  name: "Google Calendar",
  category: "calendar",
  description: "Check your schedule, find free time and book events.",
  accent: "sky",
  icon: "calendar",
  connect: { kind: "oauth", provider: "google", scopes: GOOGLE_SCOPES.google_calendar },
  async status() {
    if (!env.google()) return { connected: false, hint: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." };
    const rec = await db().get("integrations", ID);
    if (rec?.status === "error") return { connected: false, label: rec.account_label, error: "Reconnect needed." };
    return rec?.status === "connected"
      ? { connected: true, label: rec.account_label }
      : { connected: false, hint: "Connect your Google account." };
  },
  tools: [listEvents, findFreeSlots, createEvent],
};
