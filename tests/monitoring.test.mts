import assert from "node:assert/strict";
import { after, test } from "node:test";
import { startFakeBluejay } from "./fakeBluejay";
import { isolate } from "./helpers";

isolate();
const fake = await startFakeBluejay();
after(() => fake.close());
process.env.BLUEJAY_API_KEY = "bj-test";
process.env.BLUEJAY_MCP_URL = fake.url;
process.env.TWILIO_ACCOUNT_SID = "ACtest";
process.env.TWILIO_AUTH_TOKEN = "authtoken";
process.env.TWILIO_PHONE_NUMBER = "+14155550100";
process.env.PUBLIC_BASE_URL = "https://perrie.example";

const { db, addTurn, logGuardrail, saveProfile } = await import("../src/server/db");
const { setUpBluejayMonitoring } = await import("../src/server/monitoring/bluejay/setup");
const { queueCallEvaluation, processEvaluation, normalizeCallLog } = await import("../src/server/monitoring/bluejay/evaluations");
const { queueGuardrailRun, refreshRun } = await import("../src/server/monitoring/bluejay/simulations");
const { adaptArgs } = await import("../src/server/monitoring/bluejay/client");
const { GUARDRAIL_METRICS, SCENARIOS } = await import("../src/server/monitoring/bluejay/scenarios");

await saveProfile({
  full_name: "Alex Morgan",
  preferred_name: "Alex",
  pronouns: null,
  timezone: "America/Los_Angeles",
  phone_numbers: ["+14155550123"],
  assistant_name: "Perrie",
  assistant_voice: null,
  rules: [],
});
await db().insert("profile_facts", { category: "Contact", label: "Home", value: "12 Elm Street, Oakland", visibility: "private" });
await db().insert("profile_facts", { category: "Work", label: "Job", value: "Designer at Northwind", visibility: "shareable" });

const called = (name: string) => fake.state.calls.filter((c) => c.name === name);

async function makeCall(direction: "inbound" | "web", speak = true) {
  const start = Date.now() - 60_000;
  const call = await db().insert("calls", {
    twilio_call_sid: null,
    direction,
    role: "guest",
    from_number: "+14155550188",
    to_number: "+14155550100",
    counterpart_name: "Jordan",
    status: "completed",
    mission: null,
    summary: "Jordan left a message.",
    outcome: null,
    task_id: null,
    task_step_id: null,
    started_at: new Date(start).toISOString(),
    ended_at: new Date().toISOString(),
    duration_seconds: 60,
  });
  await addTurn(call.id, "agent", "Hi, you've reached Alex's phone. This is Perrie, Alex's AI assistant.");
  if (speak) {
    await addTurn(call.id, "caller", "Can you tell Alex that Friday's dinner is at seven?");
    await addTurn(call.id, "tool", "take_message ✓", { tool: "take_message", ok: true, input: { caller_name: "Jordan" }, output: { saved: true } });
    await addTurn(call.id, "agent", "Saved — I'll pass it on. Goodbye!");
    await addTurn(call.id, "tool", "end_call ✓", { tool: "end_call", ok: true });
    await logGuardrail({ kind: "manipulation_attempt", severity: "warn", detail: "test event", call_id: call.id });
  }
  return call;
}

test("argument adapter nests bodies for wrapper-style tools", () => {
  assert.deepEqual(adaptArgs({ properties: { a: {}, b: {} } }, { a: 1 }), { a: 1 });
  assert.deepEqual(adaptArgs({ properties: { request: { type: "object" } } }, { a: 1 }), { request: { a: 1 } });
  assert.deepEqual(adaptArgs({ properties: { id: {}, body: { type: "object" } } }, { id: "x", a: 1 }), { id: "x", body: { id: "x", a: 1 } });
});

test("setup registers Perrie, metrics, simulation and callers — without private facts", async () => {
  const { status, config } = await setUpBluejayMonitoring();
  assert.equal(status, "ready", JSON.stringify(config.steps, null, 1));

  const [agent] = called("add_agent").map((c) => c.args);
  assert.equal(agent.external_agent_id, "perrie-voice");
  assert.equal(agent.phone_number, "+14155550100");
  assert.equal(agent.type, "INBOUND");
  assert.equal(agent.connection_type, "PHONE");
  assert.equal(agent.mode, "VOICE");
  assert.equal(agent.redact_pii, true);
  assert.match(String(agent.knowledge_base), /Northwind/);
  for (const k of ["knowledge_base", "system_prompt"]) assert.ok(!String(agent[k]).includes("Elm"), `private fact leaked into ${k}`);

  const metrics = called("create_custom_metrics")[0].args.metrics as Record<string, unknown>[];
  assert.equal(metrics.length, GUARDRAIL_METRICS.length);
  assert.ok(metrics.every((m) => m.response_type === "pass_fail" && (m.agent_ids as number[])[0] === 100));

  assert.equal(called("create_simulation").length, 1);
  const simReq = (called("create_simulation")[0].args as { request: { selected_custom_metrics?: string[] } }).request;
  assert.equal(simReq.selected_custom_metrics?.length, GUARDRAIL_METRICS.length, "simulation scores test calls on Perrie's metrics");
  assert.equal(fake.state.dhs.length, SCENARIOS.length);
  assert.ok(fake.state.dhs.every((d) => d.simulation_ids[0] === 500 && d.intent && d.success_criteria));
  // Perrie answers and greets (with its AI disclosure) first; callers reply.
  assert.ok(fake.state.dhs.every((d) => (d.speaks_first_config as { speaks_first: boolean }).speaks_first === false));
  assert.match(String(fake.state.dhs[0].intent), /open with/);
  assert.deepEqual(config.simulation_numbers, ["+15550009999"]);

  assert.equal(config.agent_id, "100");
  assert.equal(config.simulation_id, "500");
  assert.equal(Object.keys(config.digital_humans ?? {}).length, SCENARIOS.length);
  const uptime = config.steps!.find((s) => s.key === "uptime")!;
  assert.equal(uptime.ok, true);
  const alert = config.steps!.find((s) => s.key === "alert")!;
  assert.equal(alert.skipped, true, "alert needs a threshold Perrie can't know — must be skipped, not guessed");
  assert.match(alert.detail, /threshold/);
  assert.equal(called("add_phone_number").length, 0, "must never buy a phone number");
  assert.ok(fake.state.apiKeys.every((k) => k === "bj-test"), "every request carries X-API-Key");
});

test("setup is idempotent", async () => {
  const before = fake.state.calls.length;
  const { status } = await setUpBluejayMonitoring();
  assert.equal(status, "ready");
  const created = fake.state.calls.slice(before).filter((c) => /^(add_|create_|bulk_create_)/.test(c.name));
  assert.deepEqual(created.map((c) => c.name), [], "second run must not create anything");
  assert.equal(called("update_agent_by_external_id").length, 1);
});

test("a finished call is evaluated and its scores come back", async () => {
  const call = await makeCall("inbound");
  const row = await queueCallEvaluation(call.id);
  assert.equal(row?.status, "submitted", row?.error ?? "");
  const body = called("evaluate").at(-1)!.args as Record<string, unknown>;
  assert.equal(body.external_agent_id, "perrie-voice");
  assert.equal(body.call_direction, "INBOUND");
  assert.equal(body.interface, "PHONE");
  assert.equal(body.conversation_ended_by, "AGENT");
  assert.deepEqual(body.custom_metric_tags, ["perrie-guardrails"]);
  const tr = body.transcript as { start_offset_ms: number; end_offset_ms: number; speaker: string }[];
  assert.deepEqual(tr.map((t) => t.speaker), ["AGENT", "USER", "AGENT"]);
  for (let i = 0; i < tr.length; i++) {
    assert.ok(tr[i].end_offset_ms > tr[i].start_offset_ms);
    if (i) assert.ok(tr[i].start_offset_ms >= tr[i - 1].end_offset_ms, "offsets must not overlap");
  }
  assert.ok((body.tool_calls as unknown[]).length === 2 && (body.events as unknown[]).length >= 1);

  // First poll: still scoring. Second poll: completed.
  await processEvaluation(row!.id);
  let ev = await db().get("call_evaluations", row!.id);
  assert.equal(ev?.status, "evaluating");
  await db().update("call_evaluations", row!.id, { next_check_at: new Date().toISOString() });
  await processEvaluation(row!.id);
  ev = await db().get("call_evaluations", row!.id);
  assert.equal(ev?.status, "completed", ev?.error ?? "");
  const scores = ev!.scores as ReturnType<typeof normalizeCallLog>;
  assert.equal(scores.goal_success, true, "a human override wins over the model verdict");
  assert.equal(scores.hallucination, false);
  assert.equal(scores.avg_latency, 910);
  const byName = Object.fromEntries(scores.metrics.map((m) => [m.name, m]));
  assert.equal(byName["Perrie · No private info leaked"].passed, true);
  assert.equal(byName["Perrie · AI disclosure"].passed, true);
  assert.equal(byName["Perrie · Message taken correctly"].passed, null);
});

test("Bluejay's own simulated calls aren't scored twice", async () => {
  const call = await makeCall("inbound");
  await db().update("calls", call.id, { from_number: "+15550009999" });
  const row = await queueCallEvaluation(call.id);
  assert.equal(row?.status, "skipped");
  assert.match(row?.error ?? "", /simulated caller/);
});

test("only pass/fail metrics get a verdict", () => {
  const sc = normalizeCallLog({
    status: "COMPLETED",
    evaluations: [
      {
        custom_metrics: [
          { name: "Score", response_type: "quantitative", response_value: "1" },
          { name: "Leak", response_type: "pass_fail", response_value: "fail" },
          { name: "Tone", response_type: "qualitative", response_value: "Yes, warm" },
        ],
      },
    ],
  });
  assert.deepEqual(sc.metrics.map((m) => m.passed), [null, false, null]);
});

test("evaluation modes and silent calls", async () => {
  process.env.BLUEJAY_EVALUATE = "phone";
  const web = await makeCall("web");
  assert.equal((await queueCallEvaluation(web.id))?.status, "skipped");
  process.env.BLUEJAY_EVALUATE = "all";
  const silent = await makeCall("inbound", false);
  const row = await queueCallEvaluation(silent.id);
  assert.equal(row?.status, "skipped");
  assert.match(row?.error ?? "", /Nobody spoke/);
});

test("guardrail simulation run is queued and its results labelled", async () => {
  const run = await queueGuardrailRun();
  assert.equal(run.external_run_id, "77");
  assert.deepEqual(called("queue_simulation_run").at(-1)!.args, { simulation_id: "500" });
  let r = await refreshRun(run);
  assert.equal(r.status, "running");
  r = await refreshRun(r);
  assert.equal(r.status, "completed");
  const results = (r.results as { results: { caller: string; metrics_passed: number }[] }).results;
  assert.equal(results.length, SCENARIOS.length);
  assert.equal(results[0].caller, SCENARIOS[0].title);
  assert.equal((r.summary as { passed: number }).passed, SCENARIOS.length - 1);
});

test("Bluejay being unreachable never breaks a call — it retries later", async () => {
  process.env.BLUEJAY_API_KEY = "wrong-key";
  const call = await makeCall("inbound");
  const row = await queueCallEvaluation(call.id);
  assert.equal(row?.status, "pending");
  assert.ok(row?.error, "error recorded");
  assert.ok(row?.next_check_at && new Date(row.next_check_at).getTime() > Date.now(), "retry scheduled");
  process.env.BLUEJAY_API_KEY = "bj-test";
});

test("calls cut off by a restart are closed out, summarised and scored", async () => {
  const { closeOutStaleCalls } = await import("../src/server/voice/finalize");
  const call = await makeCall("inbound");
  await db().update("calls", call.id, { status: "in-progress", ended_at: null, summary: null, duration_seconds: null });
  const n = await closeOutStaleCalls();
  assert.ok(n >= 1);
  const after = await db().get("calls", call.id);
  assert.equal(after?.status, "completed");
  assert.ok(after?.ended_at && after.summary, "closed out with a summary");
  // The summary step hands the call to Bluejay in the background.
  for (let i = 0; i < 50 && !(await db().get("call_evaluations", call.id)); i++) await new Promise((r) => setTimeout(r, 20));
  assert.ok(await db().get("call_evaluations", call.id), "queued for evaluation");
});
