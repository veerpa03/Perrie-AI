import assert from "node:assert/strict";
import { test } from "node:test";
import { enableTwilio, fakeLlm, isolate } from "./helpers";

isolate();
const sent: { url: string; body: string }[] = [];
enableTwilio(sent);

const { createTask } = await import("../src/server/orchestrator/planner");
const { approveTask } = await import("../src/server/orchestrator/executor");
const { db, listGuardrails, listSteps, saveProfile } = await import("../src/server/db");

await saveProfile({
  full_name: "Alex Morgan", preferred_name: "Alex", pronouns: null, timezone: "UTC", phone_numbers: [],
  assistant_name: "Perrie", assistant_voice: null, rules: [],
});

async function settle(taskId: string) {
  for (let i = 0; i < 100; i++) {
    const t = await db().get("tasks", taskId);
    if (t && ["completed", "failed", "canceled"].includes(t.status)) return t;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("task did not settle");
}

const plan = (tool: string) => ({
  tools: [{ name: "submit_plan", input: {
    title: "Text Sam", summary: "I'll text Sam that you're late.",
    steps: [{ title: "Text Sam", tool, description: "Text Sam at +14155550199 that Alex is 10 minutes late.", depends_on: [] }],
  } }],
});

test("request -> plan -> approval -> resolved input -> guarded run -> report", async () => {
  fakeLlm([
    plan("send_sms"),
    { tools: [{ name: "send_sms", input: { to_number: "+14155550199", body: "Alex is running 10 minutes late." } }] },
    { text: "I texted Sam that you're running 10 minutes late." },
  ]);
  const { task, steps } = await createTask({ request: "Text Sam that I'm 10 minutes late", source: "dashboard" });
  assert.equal(task.status, "awaiting_approval");
  assert.equal(steps.length, 1);
  assert.equal(sent.length, 0, "nothing runs before approval");

  await approveTask(task.id);
  const done = await settle(task.id);
  assert.equal(done.status, "completed", done.error ?? "");
  assert.equal(sent.length, 1);
  assert.match(done.result_summary ?? "", /texted Sam/);
  const [s] = await listSteps(task.id);
  assert.equal(s.status, "succeeded");
});

test("plans using tools that don't exist are rejected", async () => {
  fakeLlm([plan("launch_rocket"), plan("launch_rocket")]);
  const { task } = await createTask({ request: "Do something odd", source: "dashboard" });
  assert.equal(task.status, "failed");
  assert.ok((await listGuardrails()).some((g) => g.kind === "plan_rejected"));
});

test("a step stops instead of guessing when information is missing", async () => {
  fakeLlm([plan("send_sms"), { tools: [{ name: "cannot_proceed", input: { reason: "Sam's number isn't known." } }] }]);
  const before = sent.length;
  const { task } = await createTask({ request: "Text Sam", source: "dashboard" });
  await approveTask(task.id);
  const done = await settle(task.id);
  assert.equal(done.status, "failed");
  assert.match(done.error ?? "", /number isn't known/);
  assert.equal(sent.length, before);
});
