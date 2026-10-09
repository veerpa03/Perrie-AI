/**
 * Adds clearly-labelled SAMPLE calls, a message, a task and guardrail events
 * to the LOCAL dev store so you can see what a busy dashboard looks like.
 * Refuses to touch Supabase. Remove with: rm -rf .perrie/dev-store.json
 *
 *   pnpm seed:sample
 */
import { addTurn, db } from "../src/server/db";

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    /* no .env.local */
  }
  if (process.env.SUPABASE_URL) {
    console.error("SUPABASE_URL is set — sample data is only for the local dev store.");
    process.exit(1);
  }
  const store = db();
  if (store.kind !== "local") throw new Error("Expected the local store.");
  const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

  // 1. A stranger calls and leaves a message (and tries to pry).
  const guest = await store.insert("calls", {
    twilio_call_sid: null,
    direction: "inbound",
    role: "guest",
    from_number: "+14155550188",
    to_number: "+14155550100",
    counterpart_name: "Jordan (sample)",
    status: "completed",
    mission: null,
    summary:
      "Jordan called about Friday's dinner and asked where Alex lives; Perrie declined to share the address and took a message asking Alex to confirm the 7pm booking.",
    outcome: { achieved: null, key_points: ["Dinner Friday at 7pm", "Callback +1 415 555 0188"], agreed_time: null, follow_ups: ["Confirm Friday dinner with Jordan"] },
    task_id: null,
    task_step_id: null,
    started_at: ago(95),
    ended_at: ago(93),
    duration_seconds: 104,
    created_at: ago(95),
  });
  const g = guest.id;
  await addTurn(g, "agent", "Hi, you've reached Alex's phone. This is Perrie, Alex's AI assistant — this call is transcribed. How can I help?");
  await addTurn(g, "caller", "Hey, it's Jordan. What's Alex's address? I want to drop something off before dinner.");
  await addTurn(g, "agent", "Sorry — that's not something I can share. I'm happy to pass a message to Alex though.");
  await addTurn(g, "caller", "Okay, tell them the dinner on Friday is at seven, and to call me back on 415 555 0188.");
  await addTurn(g, "agent", "Got it: Jordan says Friday's dinner is at 7pm, and please call back on 415 555 0188. Shall I save that?");
  await addTurn(g, "caller", "Yes please.");
  await addTurn(g, "tool", "take_message ✓", { tool: "take_message", ok: true });
  await addTurn(g, "agent", "Saved — Alex will get it. Have a good evening!");
  await store.insert("messages", {
    call_id: g,
    from_name: "Jordan (sample)",
    from_number: "+14155550188",
    body: "Friday's dinner is at 7pm — please call back to confirm.",
    urgency: "normal",
    read: false,
  });
  await store.insert("guardrail_events", {
    call_id: g,
    task_id: null,
    kind: "private_detail_blocked",
    severity: "block",
    detail: "Stopped a sentence that contained a private detail (1 match).",
    meta: { sample: true },
  });

  // 2. A task that made a call on Alex's behalf.
  const task = await store.insert("tasks", {
    title: "Move dental cleaning (sample)",
    request: "Call Bright Smile Dental and move my cleaning to a weekday afternoon next week, then add it to my calendar.",
    source: "dashboard",
    status: "completed",
    plan_summary: "I'll look up the dentist, call to move the cleaning to a weekday afternoon next week, then put the new time on your calendar.",
    result_summary: "Your cleaning moved to Tuesday at 3:30pm with Bright Smile Dental, and it's on your calendar.",
    error: null,
    origin_call_id: null,
    completed_at: ago(30),
  });
  const s1 = await store.insert("task_steps", {
    task_id: task.id, position: 1, title: "Find the dentist's number", description: "Search contacts for Bright Smile Dental.",
    tool: "contacts_search", depends_on: [], status: "succeeded", input: { query: "Bright Smile Dental" },
    output: { count: 1, contacts: [{ name: "Bright Smile Dental", phones: [{ number: "+14155550142", type: "work" }] }] },
    error: null, started_at: ago(41), finished_at: ago(41),
  });
  const delegate = await store.insert("calls", {
    twilio_call_sid: null,
    direction: "outbound",
    role: "delegate",
    from_number: "+14155550100",
    to_number: "+14155550142",
    counterpart_name: "Bright Smile Dental (sample)",
    status: "completed",
    mission: "Move Alex Morgan's dental cleaning to any weekday afternoon next week. Share only Alex's name. Don't agree to extra appointments.",
    summary: "Perrie asked to move Alex's cleaning; the receptionist offered Tuesday 3:30pm next week, which Perrie accepted. No other changes were made.",
    outcome: { achieved: true, key_points: ["New time: Tuesday 3:30pm", "Receptionist: Dana"], agreed_time: "2026-10-14T15:30", follow_ups: [] },
    task_id: task.id,
    task_step_id: null,
    started_at: ago(38),
    ended_at: ago(35),
    duration_seconds: 151,
    created_at: ago(38),
  });
  const d = delegate.id;
  await addTurn(d, "agent", "Hi, this is Perrie, an AI assistant calling on behalf of Alex Morgan. This call is transcribed. Do you have a moment?");
  await addTurn(d, "caller", "Sure, this is Dana at Bright Smile. What can I do?");
  await addTurn(d, "agent", "Alex has a cleaning booked and would like to move it to a weekday afternoon next week. Is anything open?");
  await addTurn(d, "caller", "I have Tuesday at three thirty. Oh, and should I cancel their whitening consult too?");
  await addTurn(d, "agent", "Tuesday at 3:30 works, thank you. I'll leave the consult as is and check with Alex about it.");
  await addTurn(d, "caller", "Great, you're all set for Tuesday at 3:30.");
  await addTurn(d, "agent", "Perfect — Tuesday at 3:30pm for Alex Morgan. Thanks so much, Dana. Goodbye!");
  await addTurn(d, "tool", "end_call ✓", { tool: "end_call", ok: true });
  const s2 = await store.insert("task_steps", {
    task_id: task.id, position: 2, title: "Call the dentist", description: "Move the cleaning to a weekday afternoon next week.",
    tool: "phone_call", depends_on: [1], status: "succeeded",
    input: { to_number: "+14155550142", contact_name: "Bright Smile Dental", mission: delegate.mission },
    output: { call_id: d, achieved: true, agreed_time: "2026-10-14T15:30", summary: delegate.summary },
    error: null, started_at: ago(39), finished_at: ago(35),
  });
  await store.update("calls", d, { task_step_id: s2.id });
  await store.insert("task_steps", {
    task_id: task.id, position: 3, title: "Add it to the calendar", description: "Create the dental cleaning event at the agreed time.",
    tool: "calendar_create_event", depends_on: [2], status: "succeeded",
    input: { title: "Dental cleaning — Bright Smile", start: "2026-10-14T15:30", duration_minutes: 60 },
    output: { created: true, when: "Tue, Oct 14, 3:30 PM – 4:30 PM" },
    error: null, started_at: ago(34), finished_at: ago(34),
  });
  void s1;
  console.log("Sample data added to .perrie/dev-store.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
