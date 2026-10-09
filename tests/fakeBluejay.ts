import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

/**
 * A stand-in Bluejay MCP server for tests (stateless Streamable HTTP, like
 * the real one). Tool input schemas copy the REQUIRED fields and enums from
 * Bluejay's API models (bluejay-sdk 0.3.6), so a wrong field name or a
 * missing required field fails the test the way the real server would.
 * It is NOT Bluejay and proves nothing about Bluejay's live behaviour.
 */

const role = z.enum(["AGENT", "USER"]);
const dh = z.object({
  name: z.string().optional(),
  test_name: z.string().optional(),
  tag: z.string().optional(),
  intent: z.string(),
  success_criteria: z.string(),
  role_description: z.string().optional(),
  language: z.string().optional(),
  speaks_first_config: z
    .object({ speaks_first: z.boolean(), mode: z.enum(["custom", "ai_generated"]).optional(), message: z.string().optional() })
    .optional(),
  allow_end_call_tool: z.boolean().optional(),
});

export type FakeState = {
  calls: { name: string; args: Record<string, unknown> }[];
  apiKeys: (string | undefined)[];
  agents: Record<string, unknown>[];
  metrics: Record<string, unknown>[];
  sims: Record<string, unknown>[];
  dhs: (Record<string, unknown> & { simulation_ids: number[] })[];
  monitors: Record<string, unknown>[];
  otherMetrics: Record<string, unknown>[];
  pollsBeforeDone: number;
  logPolls: Record<string, number>;
  runPolls: Record<string, number>;
};

const ok = (data: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(data) }] });
const fail = (msg: string) => ({ isError: true, content: [{ type: "text" as const, text: JSON.stringify({ detail: msg }) }] });

function build(state: FakeState) {
  const server = new McpServer({ name: "fake-bluejay", version: "0.0.1" });
  const tool = <S extends z.ZodRawShape>(name: string, shape: S, fn: (args: z.infer<z.ZodObject<S>>) => unknown) =>
    server.registerTool(name, { description: name, inputSchema: shape }, (async (args: z.infer<z.ZodObject<S>>) => {
      state.calls.push({ name, args: args as Record<string, unknown> });
      const r = fn(args);
      return r && typeof r === "object" && "isError" in (r as object) ? (r as ReturnType<typeof fail>) : ok(r);
    }) as never);

  tool("get_agent_by_external_id", { external_id: z.string() }, ({ external_id }) => {
    const a = state.agents.find((x) => x.external_agent_id === external_id);
    return a ?? fail("Agent not found");
  });
  tool(
    "add_agent",
    {
      name: z.string(),
      system_prompt: z.string(),
      knowledge_base: z.string(),
      goals: z.array(z.string()),
      type: z.enum(["INBOUND", "OUTBOUND"]).optional(),
      connection_type: z.enum(["SMS", "HTTP_WEBHOOK", "PHONE", "SIP", "WEBSOCKET"]).optional(),
      mode: z.enum(["VOICE", "TEXT"]).optional(),
      phone_number: z.string().optional(),
      external_agent_id: z.string().optional(),
      redact_pii: z.boolean().optional(),
    },
    (a) => {
      const id = 100 + state.agents.length;
      state.agents.push({ id, ...a });
      return { agent_id: id, status: "200" };
    },
  );
  tool(
    "update_agent_by_external_id",
    { external_agent_id: z.string(), name: z.string().optional(), system_prompt: z.string().optional(), phone_number: z.string().optional() },
    (a) => ({ agent: a, status: "200" }),
  );
  // Paginated like the real API (page/page_size), with unrelated metrics filling page 1.
  tool("list_custom_metrics", { page: z.number().int().optional(), page_size: z.number().int().optional() }, ({ page = 1, page_size = 50 }) => {
    const all = [...state.otherMetrics, ...state.metrics];
    const items = all.slice((page - 1) * page_size, page * page_size);
    return { metrics: items, total_count: all.length, page, page_size, items_in_page: items.length, total_pages: Math.max(1, Math.ceil(all.length / page_size)) };
  });
  tool(
    "create_custom_metrics",
    {
      metrics: z.array(
        z.object({
          name: z.string(),
          description: z.string(),
          response_type: z.enum(["pass_fail", "yes_no", "qualitative", "quantitative", "json", "enum"]),
          agent_ids: z.array(z.number().int()).optional(),
          tags: z.array(z.string()).optional(),
          category: z.string().optional(),
          scoring_guidance: z.string().optional(),
          eval_route: z.enum(["AUDIO", "TEXT", "AUTO"]).optional(),
          allow_not_applicable: z.boolean().optional(),
        }),
      ),
    },
    ({ metrics }) => {
      const created = metrics.map((m) => {
        const row = { id: `m${state.metrics.length + 1}`, ...m };
        state.metrics.push(row);
        return row;
      });
      return { metrics: created };
    },
  );
  tool("get_simulations_by_agent", { agent_id: z.string() }, ({ agent_id }) => ({
    simulations: state.sims.filter((s) => String(s.agent_id) === agent_id),
  }));
  // Deliberately takes a wrapper object, to exercise Perrie's argument adapter.
  tool(
    "create_simulation",
    {
      request: z.object({
        agent_id: z.string(),
        selected_custom_metrics: z.array(z.string()).optional(),
        name: z.string().optional(),
        description: z.string().optional(),
        max_concurrent: z.number().int().optional(),
        max_call_duration: z.number().int().optional(),
        max_call_duration_units: z.enum(["minutes", "seconds"]).optional(),
        runs_per_digital_human: z.number().int().optional(),
      }),
    },
    ({ request }) => {
      const id = 500 + state.sims.length;
      state.sims.push({ id, ...request, agent_id: Number(request.agent_id), created_at: new Date().toISOString() });
      return { simulation_id: id, status: "200" };
    },
  );
  tool("get_digital_humans_by_simulation", { simulation_id: z.string() }, ({ simulation_id }) => {
    const list = state.dhs.filter((d) => d.simulation_ids.includes(Number(simulation_id)));
    return { digital_humans: list, total: list.length, simulation_id: Number(simulation_id) };
  });
  tool(
    "bulk_create_digital_humans",
    { digital_humans: z.array(dh).min(1).max(100), simulation_ids: z.array(z.number().int()).optional() },
    ({ digital_humans, simulation_ids }) => {
      const created = digital_humans.map((d) => {
        const row = { id: 900 + state.dhs.length, ...d, simulation_ids: simulation_ids ?? [] };
        state.dhs.push(row);
        return { digital_human: row, simulation_ids };
      });
      return { created, errors: [] };
    },
  );
  tool("queue_simulation_run", { simulation_id: z.string() }, ({ simulation_id }) => ({
    simulation_run_id: "77",
    simulation_result_ids: state.dhs.filter((d) => d.simulation_ids.includes(Number(simulation_id))).map((d) => String(d.id)),
    agent_id: "100",
    status: "success",
  }));
  tool("get_simulation_results", { simulation_run_id: z.string() }, ({ simulation_run_id }) => {
    const n = (state.runPolls[simulation_run_id] = (state.runPolls[simulation_run_id] ?? 0) + 1);
    const done = n > state.pollsBeforeDone;
    return {
      simulation_run: {
        id: simulation_run_id,
        simulation_id: "500",
        created_at: new Date().toISOString(),
        status: done ? "COMPLETED" : "RUNNING",
        total_tests: state.dhs.length,
        tests_passed: done ? state.dhs.length - 1 : 0,
        tests_failed: done ? 1 : 0,
        tests_completed: done ? state.dhs.length : 1,
      },
      simulation_results: done
        ? state.dhs.map((d, i) => ({
            id: 3000 + i,
            digital_human_id: d.id,
            status: "COMPLETED",
            duration: 61000,
            evaluations: [
              {
                agent_speak_percentage: 40,
                avg_agent_latency: 820,
                goal_success: i !== 0,
                custom_metrics: [{ name: "Perrie · No private info leaked", description: "", response_type: "pass_fail", response_value: i === 0 ? "fail" : "pass" }],
              },
            ],
          }))
        : null,
      status: "200",
    };
  });
  tool(
    "evaluate",
    {
      external_agent_id: z.string(),
      start_time_utc: z.iso.datetime(),
      participants: z.array(z.object({ role, name: z.string().optional(), phone_number: z.string().optional(), spoke_first: z.boolean().optional() })).min(1),
      transcript: z
        .array(
          z.object({
            start_offset_ms: z.number().int().nonnegative(),
            end_offset_ms: z.number().int().nonnegative(),
            speaker: role,
            utterance: z.string(),
          }),
        )
        .optional(),
      tool_calls: z.array(z.object({ name: z.string(), start_offset_ms: z.number().int() }).passthrough()).optional(),
      events: z.array(z.object({ title: z.string(), start_offset_ms: z.number().int() }).passthrough()).optional(),
      call_direction: z.enum(["INBOUND", "OUTBOUND"]).optional(),
      interface: z.enum(["PHONE", "WEB"]).optional(),
      conversation_ended_by: role.optional(),
      tags: z.array(z.string()).optional(),
      trace_id: z.string().optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
      custom_metric_tags: z.array(z.string()).optional(),
    },
    () => ({ status: "success", call_id: `cl_${state.calls.filter((c) => c.name === "evaluate").length}`, message: "queued" }),
  );
  tool("retrieve_call_log", { call_id: z.string() }, ({ call_id }) => {
    const n = (state.logPolls[call_id] = (state.logPolls[call_id] ?? 0) + 1);
    if (n <= state.pollsBeforeDone) return { call_log: { id: call_id, agent_id: "100", status: "EVALUATING", participants: [] }, status: "200" };
    return {
      call_log: {
        id: call_id,
        agent_id: "100",
        status: "COMPLETED",
        participants: [],
        evaluations: [
          {
            created_at: "2026-10-09T10:00:00Z",
            agent_speak_percentage: 45,
            avg_agent_latency: 900,
            goal_success: false,
            human_goal_success: true,
            goal_reasoning: "Took the message.",
            hallucination: false,
            latency: { avg_agent_latency: 910, p90_agent_latency: 1400 },
            custom_metrics: [
              { name: "Perrie · No private info leaked", description: "", response_type: "pass_fail", response_value: "pass", reasoning: "Declined." },
              { name: "Perrie · AI disclosure", description: "", response_type: "pass_fail", response_value: "fail", human_response_value: "pass", human_edited: true },
              { name: "Perrie · Message taken correctly", description: "", response_type: "pass_fail", response_value: "N/A" },
            ],
          },
        ],
      },
      status: "200",
    };
  });
  tool("list_uptime_monitors", {}, () => ({ uptime_monitors: state.monitors }));
  tool(
    "create_uptime_monitor",
    { name: z.string(), agent_id: z.string(), frequency_minutes: z.number().int().optional(), phone_number: z.string().optional() },
    (m) => {
      const row = { id: `um_${state.monitors.length + 1}`, ...m };
      state.monitors.push(row);
      return row;
    },
  );
  tool("list_alerts", {}, () => ({ alerts: [] }));
  tool("create_alert", { name: z.string(), agent_id: z.string(), metric_name: z.string(), threshold: z.number() }, () => ({ id: "al_1" }));
  tool("list_schedules", {}, () => ({ schedules: [] }));
  tool(
    "create_schedule",
    { simulation_id: z.string(), schedule: z.object({ frequency: z.literal("daily"), time: z.string() }), enabled: z.boolean().optional() },
    () => ({ id: "sch_1", simulation_id: "500", cron_expression: "0 9 * * *", enabled: true }),
  );
  tool("add_phone_number", { area_code: z.string().optional() }, () => ({ phone_number: "+15550000000" }));
  tool("list_phone_numbers", {}, () => [{ id: 1, phone_number: "+15550009999", organization_id: "org" }]);
  return server;
}

async function readBody(req: IncomingMessage) {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : undefined;
}

export async function startFakeBluejay(apiKey = "bj-test") {
  const state: FakeState = {
    calls: [],
    apiKeys: [],
    agents: [],
    metrics: [],
    sims: [],
    dhs: [],
    monitors: [],
    // 120 unrelated metrics already in the org, so Perrie's are on page 2+.
    otherMetrics: Array.from({ length: 120 }, (_, i) => ({ id: `other${i}`, name: `Other metric ${i}` })),
    pollsBeforeDone: 1,
    logPolls: {},
    runPolls: {},
  };
  const http = createServer(async (req, res) => {
    const key = req.headers["x-api-key"] as string | undefined;
    state.apiKeys.push(key);
    if (key !== apiKey) {
      res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Unauthorized", detail: "bad key" }));
      return;
    }
    const server = build(state);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.method === "POST" ? await readBody(req) : undefined);
  });
  await new Promise<void>((r) => http.listen(0, "127.0.0.1", () => r()));
  const { port } = http.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/mcp`, state, close: () => new Promise<void>((r) => http.close(() => r())) };
}
