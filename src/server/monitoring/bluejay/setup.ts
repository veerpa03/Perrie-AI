import { getProfile, listFacts, ownerName } from "../../db";
import { env } from "../../env";
import { normalizePhone } from "../../phone";
import { systemPrompt } from "../../agent/prompts";
import { BluejayError, forgetBluejayTools, type BluejaySession, type JsonSchema, withBluejay } from "./client";
import { GUARDRAIL_METRIC_TAG } from "./payload";
import { GUARDRAIL_METRICS, SCENARIOS, SIMULATION_NAME, type Scenario } from "./scenarios";
import {
  agentExternalId,
  getMonitoringConfig,
  getMonitoringState,
  saveMonitoringState,
  type MonitoringConfig,
  type SetupStep,
} from "./state";

/**
 * One-click (and re-runnable) Bluejay setup over MCP. Each step looks up
 * what already exists before creating anything, so running it twice changes
 * nothing. Every step's outcome is recorded and shown on the Monitoring page.
 *
 *   1. Register Perrie as an INBOUND PHONE VOICE agent (external id
 *      "perrie-voice") pointing at the Twilio number.
 *   2. Create Perrie's guardrail metrics (tagged "perrie-guardrails").
 *   3. Create the "Perrie guardrails" simulation.
 *   4. Add the adversarial / everyday simulated callers to it.
 *   5. Create an alert on guardrail failures          (best effort).
 *
 * The uptime monitor (Bluejay phoning Perrie on a schedule) is NOT part of
 * this: it places real calls around the clock, so it has its own opt-in
 * button (setUpUptimeMonitor).
 *
 * Never sends private profile facts: the agent's knowledge base is only the
 * facts the owner marked shareable, and PII redaction is switched on.
 */

const UPTIME_NAME = "Perrie phone line";

/** The number Bluejay's simulated callers dial (only the number matters here, not the rest of Twilio's setup). */
const agentPhoneNumber = () => normalizePhone(process.env.TWILIO_PHONE_NUMBER ?? "") ?? env.twilio()?.phoneNumber ?? null;
const ALERT_NAME = "Perrie guardrail failure";

const idOf = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number") return String(v);
  const o = v as Record<string, unknown>;
  return idOf(o.id ?? o.agent_id ?? o.simulation_id ?? o.uptime_monitor_id ?? o.monitor_id ?? o.alert_id ?? null);
};

/** Arrays in a tool response, wherever Bluejay nests them. */
export function listIn(data: unknown, ...keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  const o = (data ?? {}) as Record<string, unknown>;
  for (const k of [...keys, "items", "data", "results"]) if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[];
  return [];
}

async function agentDefinition() {
  const [profile, facts] = await Promise.all([getProfile(), listFacts()]);
  const shareable = facts.filter((f) => f.visibility === "shareable");
  const name = ownerName(profile);
  return {
    name: `${profile?.assistant_name ?? "Perrie"} — ${name}'s assistant`,
    // The public-facing (guest) prompt: what simulated callers will reach.
    // It contains only shareable facts — never private ones.
    system_prompt: systemPrompt({ role: "guest", channel: "voice", profile, facts: shareable }),
    knowledge_base: shareable.length
      ? shareable.map((f) => `${f.label}: ${f.value}`).join("\n")
      : `No public facts about ${name}. The assistant can take messages but shares no personal details.`,
    goals: [
      `Take accurate messages for ${name}`,
      `Never disclose ${name}'s private information`,
      "Say it is an AI assistant and that the call is transcribed",
      `Only act on instructions from the verified owner`,
      "Never make up facts",
    ],
    type: "INBOUND",
    connection_type: "PHONE",
    mode: "VOICE",
    redact_pii: true,
    external_agent_id: agentExternalId(),
    ...(agentPhoneNumber() ? { phone_number: agentPhoneNumber()! } : {}),
  };
}

function digitalHuman(s: Scenario) {
  return {
    name: s.title,
    test_name: s.key,
    tag: s.tag,
    // Perrie answers and greets first (that greeting carries the AI
    // disclosure), so the simulated caller replies instead of speaking first.
    intent: `After the assistant greets you, open with: "${s.opener}" Then: ${s.intent}`,
    success_criteria: s.passIf,
    role_description: s.persona,
    language: "en",
    speaks_first_config: { speaks_first: false },
    allow_end_call_tool: true,
  };
}

function metricBody(m: (typeof GUARDRAIL_METRICS)[number], agentId: string | null) {
  // CreateCustomMetricRequest: name, description, response_type (required);
  // agent_ids is a list of integer agent ids (agent_id is deprecated).
  const n = agentId !== null ? Number(agentId) : NaN;
  return {
    name: m.name,
    description: m.description,
    response_type: "pass_fail",
    scoring_guidance: m.scoring,
    eval_route: "TEXT",
    category: "Guardrails",
    tags: [GUARDRAIL_METRIC_TAG],
    allow_not_applicable: !!m.allowNotApplicable,
    ...(Number.isFinite(n) ? { agent_ids: [n] } : {}),
  };
}

/**
 * Fill a tool's required inputs from a set of known values, matching by
 * field name (with a few synonyms). Returns which required fields are still
 * missing so the step can be skipped honestly instead of guessed.
 */
export function fillFromSchema(
  schema: JsonSchema | undefined,
  known: Record<string, unknown>,
): { args: Record<string, unknown>; missing: string[] } {
  const props = schema?.properties ?? {};
  const synonyms: Record<string, string[]> = {
    name: ["title", "monitor_name", "alert_name"],
    agent_id: ["agentId"],
    phone_number: ["phone", "target_phone_number", "number"],
    frequency_minutes: ["interval_minutes", "check_interval_minutes", "every_minutes", "frequency"],
  };
  const args: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (key in known) args[key] = known[key];
    else {
      const from = Object.entries(synonyms).find(([, alts]) => alts.includes(key))?.[0];
      if (from && from in known) args[key] = known[from];
    }
    const en = props[key]?.enum;
    if (args[key] !== undefined && en && !en.includes(args[key])) delete args[key];
  }
  const missing = (schema?.required ?? []).filter((k) => args[k] === undefined);
  return { args, missing };
}

async function stepAgent(s: BluejaySession, config: MonitoringConfig, steps: SetupStep[]) {
  const def = await agentDefinition();
  let agentId: string | null = null;
  let found = false;
  if (s.has("get_agent_by_external_id")) {
    try {
      const res = await s.call("get_agent_by_external_id", { external_id: def.external_agent_id });
      agentId = idOf(res);
      found = !!agentId;
    } catch (err) {
      // Only a genuine "not found" means create; anything else (timeouts,
      // auth, 5xx) must not lead to a duplicate agent.
      if (!/not\s*found|404|does not exist|no agent/i.test((err as Error).message)) throw err;
      found = false;
    }
  } else if (s.has("list_agents")) {
    const all = listIn(await s.call("list_agents"), "agents");
    const hit = all.find((a) => a.external_agent_id === def.external_agent_id);
    agentId = hit ? idOf(hit) : null;
    found = !!agentId;
  } else if (config.agent_id) {
    // No lookup tool: trust the id an earlier setup run saved.
    agentId = config.agent_id;
    found = true;
  }
  if (found && s.has("update_agent_by_external_id")) {
    await s.call("update_agent_by_external_id", def);
  } else if (!found) {
    const res = await s.call<{ agent_id?: unknown }>("add_agent", def);
    agentId = idOf(res?.agent_id ?? res);
  }
  config.agent_id = agentId;
  steps.push({
    key: "agent",
    label: "Perrie registered as a Bluejay agent",
    ok: !!agentId,
    detail: `${found ? "Updated" : "Created"} agent "${def.external_agent_id}"${agentId ? ` (id ${agentId})` : ""}${
      def.phone_number ? ` on ${def.phone_number}` : " — TWILIO_PHONE_NUMBER isn't set, so simulated callers can't dial in yet"
    }.`,
  });
}

/** All custom metrics in the org (list_custom_metrics is paginated). */
async function listAllMetrics(s: BluejaySession): Promise<Record<string, unknown>[]> {
  const paged = !!s.tool("list_custom_metrics")?.inputSchema?.properties?.page;
  const out: Record<string, unknown>[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await s.call<{ total_pages?: number }>("list_custom_metrics", paged ? { page, page_size: 100 } : {});
    const items = listIn(res, "metrics", "custom_metrics");
    out.push(...items);
    if (!paged || !items.length || (res?.total_pages ? page >= res.total_pages : items.length < 100)) break;
  }
  return out;
}

async function stepMetrics(s: BluejaySession, config: MonitoringConfig, steps: SetupStep[]) {
  // Metrics are org-wide and matched by name, so look across all of them.
  let existing: Record<string, unknown>[] = [];
  if (s.has("list_custom_metrics")) {
    existing = await listAllMetrics(s);
  } else if (config.agent_id && s.has("get_custom_metrics_by_agent")) {
    existing = listIn(await s.call("get_custom_metrics_by_agent", { agent_id: config.agent_id }), "metrics", "custom_metrics");
  } else if (config.metric_names?.length) {
    // No lookup tool: an earlier setup run already created them.
    existing = config.metric_names.map((name, i) => ({ name, id: config.metric_ids?.[i] ?? null }));
  }
  const ours = new Set(GUARDRAIL_METRICS.map((m) => m.name));
  const have = new Set(existing.map((m) => String(m.name ?? "")));
  const missing = GUARDRAIL_METRICS.filter((m) => !have.has(m.name));
  let created: Record<string, unknown>[] = [];
  if (missing.length) {
    if (s.has("create_custom_metrics")) {
      created = listIn(
        await s.call("create_custom_metrics", { metrics: missing.map((m) => metricBody(m, config.agent_id ?? null)) }),
        "metrics",
      );
    } else {
      for (const m of missing) created.push((await s.call<Record<string, unknown>>("create_custom_metric", metricBody(m, config.agent_id ?? null))) ?? {});
    }
  }
  config.metric_names = GUARDRAIL_METRICS.map((m) => m.name);
  config.metric_ids = [...existing, ...created]
    .filter((m) => ours.has(String(m.name ?? "")))
    .map((m) => idOf(m.id ?? null))
    .filter((id): id is string => !!id);
  steps.push({
    key: "metrics",
    label: "Guardrail metrics",
    ok: true,
    detail: missing.length
      ? `Created ${missing.length} metric(s); ${GUARDRAIL_METRICS.length - missing.length} already existed. Tag: ${GUARDRAIL_METRIC_TAG}.`
      : `All ${GUARDRAIL_METRICS.length} metrics already exist. Tag: ${GUARDRAIL_METRIC_TAG}.`,
  });
}

async function stepSimulation(s: BluejaySession, config: MonitoringConfig, steps: SetupStep[]) {
  if (!config.agent_id) {
    steps.push({ key: "simulation", label: "Guardrail simulation", ok: false, skipped: true, detail: "Needs the Bluejay agent id first." });
    return;
  }
  let simId: string | null = null;
  if (s.has("get_simulations_by_agent")) {
    const sims = listIn(await s.call("get_simulations_by_agent", { agent_id: config.agent_id }), "simulations");
    const hit = sims.find((x) => x.name === SIMULATION_NAME);
    simId = hit ? idOf(hit) : null;
  } else if (config.simulation_id) {
    simId = config.simulation_id; // no lookup tool: trust the saved id
  }
  const created = !simId;
  if (!simId) {
    const res = await s.call<{ simulation_id?: unknown }>("create_simulation", {
      agent_id: config.agent_id,
      name: SIMULATION_NAME,
      description: "Adversarial and everyday callers that check Perrie stays the owner's agent and never makes things up.",
      max_concurrent: 2,
      max_call_duration: 4,
      max_call_duration_units: "minutes",
      runs_per_digital_human: 1,
      // Score every test call on Perrie's guardrail metrics.
      ...(config.metric_ids?.length ? { selected_custom_metrics: config.metric_ids } : {}),
    });
    simId = idOf(res?.simulation_id ?? res);
  }
  config.simulation_id = simId;
  steps.push({
    key: "simulation",
    label: "Guardrail simulation",
    ok: !!simId,
    detail: `${created ? "Created" : "Found"} "${SIMULATION_NAME}"${simId ? ` (id ${simId})` : ""}.`,
  });
}

async function stepDigitalHumans(s: BluejaySession, config: MonitoringConfig, steps: SetupStep[]) {
  if (!config.simulation_id) {
    steps.push({ key: "callers", label: "Simulated callers", ok: false, skipped: true, detail: "Needs the simulation first." });
    return;
  }
  const simNum = Number(config.simulation_id);
  const simRef = Number.isFinite(simNum) ? simNum : config.simulation_id;
  const existing = s.has("get_digital_humans_by_simulation")
    ? listIn(await s.call("get_digital_humans_by_simulation", { simulation_id: config.simulation_id }), "digital_humans")
    : [];
  const have = new Set(existing.map((d) => String(d.test_name ?? d.name ?? "")));
  const missing = SCENARIOS.filter((sc) => !have.has(sc.key) && !have.has(sc.title));
  let failures: string[] = [];
  if (missing.length) {
    if (s.has("bulk_create_digital_humans")) {
      const res = await s.call<{ errors?: unknown[] }>("bulk_create_digital_humans", {
        digital_humans: missing.map(digitalHuman),
        simulation_ids: [simRef],
      });
      failures = (res?.errors ?? []).map((e) => JSON.stringify(e).slice(0, 160));
    } else {
      for (const sc of missing) await s.call("create_digital_human", { digital_human: digitalHuman(sc), simulation_ids: [simRef] });
    }
  }
  if (s.has("get_digital_humans_by_simulation")) {
    const now = listIn(await s.call("get_digital_humans_by_simulation", { simulation_id: config.simulation_id }), "digital_humans");
    const ids: Record<string, string> = {};
    for (const sc of SCENARIOS) {
      const d = now.find((x) => x.test_name === sc.key || x.name === sc.title);
      const id = d ? idOf(d) : null;
      if (id) ids[sc.title] = id;
    }
    config.digital_humans = ids;
  }
  config.digital_human_count = SCENARIOS.length - failures.length;
  steps.push({
    key: "callers",
    label: "Simulated callers",
    ok: failures.length === 0,
    detail: failures.length
      ? `Bluejay rejected ${failures.length} of ${missing.length} new caller(s): ${failures[0]}`
      : missing.length
        ? `Added ${missing.length} caller(s) to the simulation; ${SCENARIOS.length - missing.length} were already there.`
        : `All ${SCENARIOS.length} callers are already in the simulation.`,
  });
}

/** Numbers Bluejay's simulated callers dial from, so their calls aren't scored twice. */
async function stepCallerNumbers(s: BluejaySession, config: MonitoringConfig) {
  if (!s.has("list_phone_numbers")) return;
  const nums = listIn(await s.call("list_phone_numbers"), "phone_numbers", "numbers")
    .map((n) => normalizePhone(String(n.phone_number ?? n.number ?? "")))
    .filter((n): n is string => !!n);
  config.simulation_numbers = nums;
}

async function stepBestEffort(
  s: BluejaySession,
  steps: SetupStep[],
  opts: {
    key: string;
    label: string;
    list: string;
    create: string;
    name: string;
    listKeys: string[];
    known: Record<string, unknown>;
    /** Id saved by an earlier setup run, if any. */
    existingId: string | null;
    save: (id: string | null) => void;
  },
) {
  if (opts.existingId) {
    steps.push({ key: opts.key, label: opts.label, ok: true, detail: `"${opts.name}" already set up (id ${opts.existingId}).` });
    return;
  }
  if (!s.has(opts.create)) {
    steps.push({ key: opts.key, label: opts.label, ok: false, skipped: true, detail: `Bluejay's MCP server has no ${opts.create} tool.` });
    return;
  }
  if (s.has(opts.list)) {
    const all = listIn(await s.call(opts.list), ...opts.listKeys);
    const hit = all.find((x) => x.name === opts.name || x.title === opts.name);
    if (hit) {
      opts.save(idOf(hit));
      steps.push({ key: opts.key, label: opts.label, ok: true, detail: `"${opts.name}" already exists.` });
      return;
    }
  }
  const { args, missing } = fillFromSchema(s.tool(opts.create)?.inputSchema, opts.known);
  if (missing.length) {
    steps.push({
      key: opts.key,
      label: opts.label,
      ok: false,
      skipped: true,
      detail: `Needs ${missing.join(", ")} — set it up once in the Bluejay app (or with Claude Code via the bluejay MCP).`,
    });
    return;
  }
  const res = await s.call(opts.create, args);
  opts.save(idOf(res));
  steps.push({ key: opts.key, label: opts.label, ok: true, detail: `Created "${opts.name}".` });
}

export async function setUpBluejayMonitoring(): Promise<{ status: "ready" | "partial" | "error"; config: MonitoringConfig }> {
  const config: MonitoringConfig = { ...(await getMonitoringConfig()) };
  const steps: SetupStep[] = [];
  forgetBluejayTools();
  try {
    await withBluejay(async (s) => {
      config.mcp_server = s.server;
      steps.push({ key: "connect", label: "Connected to Bluejay MCP", ok: true, detail: `${s.server ?? "Bluejay"} · ${s.tools.length} tools.` });
      const guarded = async (key: string, label: string, fn: () => Promise<void>) => {
        try {
          await fn();
        } catch (err) {
          steps.push({ key, label, ok: false, detail: (err as Error).message.slice(0, 300) });
        }
      };
      await guarded("agent", "Perrie registered as a Bluejay agent", () => stepAgent(s, config, steps));
      await guarded("metrics", "Guardrail metrics", () => stepMetrics(s, config, steps));
      await guarded("simulation", "Guardrail simulation", () => stepSimulation(s, config, steps));
      await guarded("callers", "Simulated callers", () => stepDigitalHumans(s, config, steps));
      // Read-only: Bluejay's own numbers (never buys one).
      await stepCallerNumbers(s, config).catch(() => {});
      await guarded("alert", "Guardrail alert", () =>
        stepBestEffort(s, steps, {
          key: "alert",
          label: "Guardrail alert",
          list: "list_alerts",
          create: "create_alert",
          name: ALERT_NAME,
          listKeys: ["alerts"],
          known: {
            name: ALERT_NAME,
            description: "Fires when a Perrie guardrail metric fails on a call.",
            ...(config.agent_id ? { agent_id: config.agent_id } : {}),
            metric_name: GUARDRAIL_METRICS[0].name,
            enabled: true,
          },
          existingId: config.alert_ids?.[0] ?? null,
          save: (id) => (config.alert_ids = id ? [id] : []),
        }),
      );
    }, 120_000);
  } catch (err) {
    const message = err instanceof BluejayError ? err.message : `Couldn't reach Bluejay: ${(err as Error).message}`;
    steps.push({ key: "connect", label: "Connected to Bluejay MCP", ok: false, detail: message.slice(0, 300) });
  }
  config.steps = steps;
  config.last_sync_at = new Date().toISOString();
  const core = steps.filter((st) => ["connect", "agent", "metrics", "simulation", "callers"].includes(st.key));
  const status = !steps.some((st) => st.key === "connect" && st.ok) ? "error" : core.every((st) => st.ok) ? "ready" : "partial";
  const firstError = steps.find((st) => !st.ok && !st.skipped)?.detail ?? null;
  await saveMonitoringState(status, config, firstError);
  return { status, config };
}

/**
 * Opt-in: a Bluejay uptime monitor that phones Perrie every `everyMinutes`
 * and checks it answers. Each check is a real call.
 */
export async function setUpUptimeMonitor(everyMinutes = 60): Promise<SetupStep> {
  const config: MonitoringConfig = { ...(await getMonitoringConfig()) };
  const steps: SetupStep[] = [];
  await withBluejay(async (s) => {
    const phone = agentPhoneNumber();
    await stepBestEffort(s, steps, {
      key: "uptime",
      label: "Uptime monitor",
      list: "list_uptime_monitors",
      create: "create_uptime_monitor",
      name: UPTIME_NAME,
      listKeys: ["uptime_monitors", "monitors"],
      known: {
        name: UPTIME_NAME,
        description: `Calls Perrie's number every ${everyMinutes} minutes and checks it answers and greets correctly.`,
        ...(config.agent_id ? { agent_id: config.agent_id } : {}),
        external_agent_id: config.agent_external_id,
        ...(phone ? { phone_number: phone } : {}),
        frequency_minutes: everyMinutes,
        enabled: true,
      },
      existingId: config.uptime_monitor_id ?? null,
      save: (id) => (config.uptime_monitor_id = id),
    });
  });
  const step = steps[0];
  config.steps = [...(config.steps ?? []).filter((x) => x.key !== "uptime"), step];
  const row = await getMonitoringState();
  await saveMonitoringState(row?.status ?? "partial", config, row?.last_error ?? null);
  return step;
}
