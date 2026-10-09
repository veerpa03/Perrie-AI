import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  FlaskConical,
  Gauge,
  KeyRound,
  ListChecks,
  RotateCw,
  Settings2,
  ShieldCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import { refreshEvaluationAction, refreshRunAction } from "@/actions/monitoring";
import AutoRefresh from "@/components/dashboard/AutoRefresh";
import BluejayRunner from "@/components/dashboard/BluejayRunner";
import { EvaluationStatus, guardrailTally } from "@/components/dashboard/EvaluationView";
import { RunTestButtons, SetupButton } from "@/components/dashboard/MonitoringActions";
import ResultView from "@/components/dashboard/ResultView";
import { RoleBadge } from "@/components/dashboard/badges";
import { ACCENTS, ClayCard, EmptyState, IconBubble, PageHeader, Pill } from "@/components/dashboard/ui";
import { fmtDateTime, timeAgo } from "@/lib/format";
import { db, getProfile } from "@/server/db";
import { env } from "@/server/env";
import { bluejayConfigured, familyOf, withBluejay, type BluejayTool } from "@/server/monitoring/bluejay/client";
import { evaluateMode, type EvalScores } from "@/server/monitoring/bluejay/evaluations";
import { GUARDRAIL_METRICS, SCENARIOS, SIMULATION_NAME } from "@/server/monitoring/bluejay/scenarios";
import { listIn } from "@/server/monitoring/bluejay/setup";
import { getMonitoringConfig, getMonitoringState } from "@/server/monitoring/bluejay/state";
import type { RunResult } from "@/server/monitoring/bluejay/simulations";
import { prettyPhone } from "@/server/phone";

export const metadata = { title: "Monitoring — Perrie" };

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

/** Read-only live view: Bluejay tool list + uptime monitors + alerts. */
async function loadLive() {
  try {
    return await withBluejay(async (s) => {
      const read = async (name: string, keys: string[]) => {
        if (!s.has(name)) return null;
        try {
          return listIn(await s.call(name), ...keys);
        } catch (err) {
          return { error: (err as Error).message };
        }
      };
      const [monitors, alerts] = await Promise.all([
        read("list_uptime_monitors", ["uptime_monitors", "monitors"]),
        read("list_alerts", ["alerts"]),
      ]);
      return { ok: true as const, tools: s.tools, server: s.server, monitors, alerts };
    }, 20_000);
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
}

function groupTools(tools: BluejayTool[]) {
  const map = new Map<string, BluejayTool[]>();
  for (const t of tools) map.set(familyOf(t.name), [...(map.get(familyOf(t.name)) ?? []), t]);
  return [...map.entries()].map(([family, ts]) => ({ family, tools: ts.sort((a, b) => a.name.localeCompare(b.name)) }));
}

function Tile({ label, value, accent }: { label: string; value: string; accent: keyof typeof ACCENTS }) {
  return (
    <div
      className="rounded-[24px] p-4"
      style={{
        background: "#FFFCF7",
        boxShadow: "0 20px 40px -30px rgba(38,52,69,0.5), inset -5px -6px 14px rgba(38,52,69,0.06), inset 5px 5px 12px rgba(255,255,255,0.92)",
      }}
    >
      <p className="font-display text-3xl leading-none" style={{ color: ACCENTS[accent].ink }}>
        {value}
      </p>
      <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate)]/50">{label}</p>
    </div>
  );
}

export default async function MonitoringPage() {
  const configured = bluejayConfigured();
  const [profile, state, config, evaluations, runs, calls] = await Promise.all([
    getProfile(),
    getMonitoringState(),
    getMonitoringConfig(),
    db().list("call_evaluations", { orderBy: "created_at", ascending: false, limit: 50 }),
    db().list("simulation_runs", { orderBy: "created_at", ascending: false, limit: 10 }),
    db().list("calls", { orderBy: "created_at", ascending: false, limit: 200 }),
  ]);
  const live = configured && state ? await loadLive() : null;
  const tz = profile?.timezone ?? "UTC";
  const callById = new Map(calls.map((c) => [c.id, c]));

  const done = evaluations.filter((e) => e.status === "completed" && e.scores);
  const scores = done.map((e) => e.scores as unknown as EvalScores);
  const goalJudged = scores.filter((s) => s.goal_success !== null);
  const hallJudged = scores.filter((s) => s.hallucination !== null);
  const tallies = scores.map(guardrailTally);
  const grPassed = tallies.reduce((a, t) => a + t.passed, 0);
  const grTotal = tallies.reduce((a, t) => a + t.total, 0);
  const inFlight = evaluations.some((e) => ["pending", "submitted", "evaluating"].includes(e.status)) || runs.some((r) => r.status === "queued" || r.status === "running");
  const steps = config.steps ?? [];

  return (
    <>
      <AutoRefresh active={inFlight} everyMs={8000} />
      <PageHeader
        eyebrow="Monitoring · Bluejay"
        title="Every call, checked"
        subtitle="When a call ends, Perrie sends the transcript, tool calls and guardrail events to Bluejay over MCP. Bluejay scores it — goal reached, made-up facts, latency, and Perrie's own guardrail checks — and sends simulated callers to test Perrie on purpose."
      />

      {/* How the pipeline works */}
      <ClayCard className="mb-8">
        <ol className="grid gap-3 text-sm md:grid-cols-4">
          {[
            { icon: Activity, accent: "mint" as const, title: "Call ends", text: "Twilio + Deepgram call finishes; Perrie writes the summary." },
            { icon: ArrowRight, accent: "sky" as const, title: "Sent to Bluejay", text: "MCP evaluate: transcript, tools used, guardrail events." },
            { icon: Gauge, accent: "lilac" as const, title: "Scored", text: "Goal, made-up facts, latency, sentiment + 6 guardrail metrics." },
            { icon: ShieldCheck, accent: "coral" as const, title: "Shown here", text: "On this page and on each call's page. Failures stand out." },
          ].map((s, i) => (
            <li key={s.title} className="flex items-start gap-3 rounded-3xl p-3" style={{ background: ACCENTS[s.accent].soft }}>
              <IconBubble icon={s.icon} accent={s.accent} size="sm" />
              <span>
                <span className="block font-bold text-[color:var(--color-slate)]">
                  {i + 1}. {s.title}
                </span>
                <span className="block text-xs text-[color:var(--color-slate)]/70">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </ClayCard>

      {!configured ? (
        <ClayCard title="Connect Bluejay" icon={KeyRound} accent="sky" className="mb-8">
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--color-slate)]/80">
            <li>
              In <strong>app.getbluejay.ai › Settings › API Keys</strong>, generate a key (it&apos;s shown only once).
            </li>
            <li>
              Add <code className="font-bold">BLUEJAY_API_KEY=…</code> to <code className="font-bold">.env.local</code> and restart{" "}
              <code>pnpm dev</code>.
            </li>
            <li>
              Come back here and press <strong>Set up monitoring</strong>: Perrie registers itself with Bluejay, creates its guardrail
              metrics and the &ldquo;{SIMULATION_NAME}&rdquo; simulation with {SCENARIOS.length} test callers.
            </li>
            <li>
              The same key powers the <code className="font-bold">bluejay</code> server in <code>.mcp.json</code> for Claude Code.
            </li>
          </ol>
        </ClayCard>
      ) : (
        <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <ClayCard
            title="Bluejay setup"
            icon={Settings2}
            accent="sky"
            action={
              state ? (
                <Pill tone={state.status === "ready" ? "mint" : state.status === "partial" ? "amber" : "coral"}>
                  {state.status === "ready" ? "Monitoring on" : state.status === "partial" ? "Partly set up" : "Not reachable"}
                </Pill>
              ) : (
                <Pill tone="slate">Not set up</Pill>
              )
            }
          >
            {steps.length ? (
              <ul className="mb-5 space-y-2">
                {steps.map((s) => (
                  <li key={s.key} className="flex items-start gap-2.5 text-sm">
                    {s.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#1C7F62]" aria-label="done" />
                    ) : s.skipped ? (
                      <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-slate)]/40" aria-label="skipped" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#B5403A]" aria-label="failed" />
                    )}
                    <span>
                      <span className="font-bold text-[color:var(--color-slate)]">{s.label}</span>
                      <span className="block text-[color:var(--color-slate)]/65">{s.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-5 text-sm text-[color:var(--color-slate)]/70">
                One click registers Perrie (as <code className="font-bold">{config.agent_external_id}</code>
                {env.twilio()?.phoneNumber ? ` on ${prettyPhone(env.twilio()!.phoneNumber)}` : ""}) and creates its guardrail
                metrics, test simulation and callers. Only facts you marked shareable are sent; PII redaction is on.
              </p>
            )}
            <SetupButton label={state ? "Re-sync with Bluejay" : "Set up monitoring"} />
            {config.last_sync_at && (
              <p className="mt-3 text-xs text-[color:var(--color-slate)]/50">Last synced {timeAgo(config.last_sync_at)}.</p>
            )}
            <p className="mt-3 text-xs text-[color:var(--color-slate)]/50">
              Calls sent: <code className="font-bold">BLUEJAY_EVALUATE={evaluateMode()}</code>
              {evaluateMode() === "all" ? " (phone calls + playground)" : ""}.
            </p>
          </ClayCard>

          <div className="grid content-start gap-4 sm:grid-cols-2">
            <Tile label="Calls scored" value={String(done.length)} accent="mint" />
            <Tile label="Goal reached" value={pct(goalJudged.filter((s) => s.goal_success).length, goalJudged.length)} accent="lilac" />
            <Tile label="No made-up facts" value={pct(hallJudged.filter((s) => !s.hallucination).length, hallJudged.length)} accent="sky" />
            <Tile label="Guardrail checks passed" value={pct(grPassed, grTotal)} accent="coral" />
          </div>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <ClayCard title="Call scores" icon={ClipboardCheck} accent="mint">
          {evaluations.length ? (
            <ul className="space-y-2">
              {evaluations.map((e) => {
                const call = callById.get(e.call_id);
                const sc = e.scores as unknown as EvalScores | null;
                const t = guardrailTally(sc);
                const who =
                  call?.counterpart_name ??
                  (call?.direction === "web" ? "Playground" : prettyPhone(call?.direction === "outbound" ? call?.to_number : call?.from_number));
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-2xl px-3 py-3" style={{ background: "rgba(255,255,255,0.6)" }}>
                    <Link href={`/dashboard/calls/${e.call_id}`} className="focus-ring min-w-0 flex-1 rounded-xl">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[color:var(--color-slate)]">
                        {who} {call && <RoleBadge role={call.role} />}
                      </p>
                      <p className="text-xs text-[color:var(--color-slate)]/50">{fmtDateTime(call?.started_at ?? e.created_at, tz)}</p>
                    </Link>
                    {sc ? (
                      <span className="flex flex-wrap items-center gap-1.5">
                        {sc.goal_success !== null && <Pill tone={sc.goal_success ? "mint" : "coral"}>goal {sc.goal_success ? "✓" : "✗"}</Pill>}
                        {sc.hallucination !== null && <Pill tone={sc.hallucination ? "coral" : "mint"}>{sc.hallucination ? "made-up facts" : "grounded"}</Pill>}
                        {t.total > 0 && (
                          <Pill tone={t.passed === t.total ? "mint" : "coral"}>
                            guardrails {t.passed}/{t.total}
                          </Pill>
                        )}
                      </span>
                    ) : (
                      <EvaluationStatus status={e.status} />
                    )}
                    {["submitted", "evaluating", "pending"].includes(e.status) && (
                      <form action={refreshEvaluationAction}>
                        <input type="hidden" name="id" value={e.id} />
                        <button type="submit" className="focus-ring rounded-full p-1.5 text-[color:var(--color-slate)]/45 hover:text-[color:var(--color-slate)]" aria-label="Check Bluejay now">
                          <RotateCw className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </form>
                    )}
                    {e.error && e.status !== "completed" && <p className="w-full text-xs text-[color:var(--color-slate)]/55">{e.error}</p>}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={ClipboardCheck} accent="mint" title="No calls scored yet">
              {configured
                ? "Finished calls (and playground conversations) are sent to Bluejay automatically and their scores appear here."
                : "Connect Bluejay to start scoring calls."}
            </EmptyState>
          )}
        </ClayCard>

        <div className="space-y-6">
          <ClayCard title="Guardrail tests" icon={FlaskConical} accent="lilac">
            <p className="-mt-1 mb-4 text-sm text-[color:var(--color-slate)]/70">
              Bluejay&apos;s {SCENARIOS.length} simulated callers try to pry, impersonate you, inject instructions and more — then each
              call is scored.
            </p>
            {configured && <RunTestButtons canRun={!!config.simulation_id} hasSchedule={!!config.schedule_id} />}
            {runs.length > 0 && (
              <ul className="mt-5 space-y-3">
                {runs.map((r) => {
                  const sm = (r.summary ?? {}) as { total?: number | null; passed?: number | null; failed?: number | null };
                  const results = ((r.results as { results?: RunResult[] } | null)?.results ?? []) as RunResult[];
                  return (
                    <li key={r.id} className="rounded-2xl px-3 py-3" style={{ background: "rgba(255,255,255,0.6)" }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-[color:var(--color-slate)]">Run {r.external_run_id}</p>
                        <Pill tone={r.status === "completed" ? "mint" : r.status === "failed" ? "coral" : "lilac"}>{r.status}</Pill>
                        {sm.passed != null && sm.total ? <Pill tone={sm.passed === sm.total ? "mint" : "amber"}>{sm.passed}/{sm.total} passed</Pill> : null}
                        <span className="ml-auto text-xs text-[color:var(--color-slate)]/45">{timeAgo(r.created_at)}</span>
                        {r.status !== "completed" && (
                          <form action={refreshRunAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <button type="submit" className="focus-ring rounded-full p-1 text-[color:var(--color-slate)]/45 hover:text-[color:var(--color-slate)]" aria-label="Check this run now">
                              <RotateCw className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </form>
                        )}
                      </div>
                      {results.length > 0 && (
                        <ul className="mt-2 space-y-1 text-xs text-[color:var(--color-slate)]/75">
                          {results.map((x) => (
                            <li key={x.id} className="flex flex-wrap items-center gap-2">
                              <span className="font-bold">{x.caller ?? `Result ${x.id}`}</span>
                              {x.goal_success !== null && <span>{x.goal_success ? "✓ goal" : "✗ goal"}</span>}
                              {x.metrics_total > 0 && (
                                <span>
                                  guardrails {x.metrics_passed}/{x.metrics_total}
                                </span>
                              )}
                              {x.status && <span className="text-[color:var(--color-slate)]/45">{x.status}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                      {r.error && <p className="mt-1 text-xs text-[#B5403A]">{r.error}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </ClayCard>

          {live && (
            <ClayCard title="Live from Bluejay" icon={Activity} accent="sky">
              {!live.ok ? (
                <p className="text-sm font-semibold text-[#B5403A]">{live.error}</p>
              ) : (
                <div className="space-y-4 text-sm">
                  <p className="text-[color:var(--color-slate)]/65">
                    {live.server ?? "Bluejay MCP"} · {live.tools.length} tools
                  </p>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate)]/45">Uptime monitors</p>
                    {live.monitors === null ? (
                      <p className="text-[color:var(--color-slate)]/55">Not offered by this Bluejay server.</p>
                    ) : (
                      <ResultView data={"error" in (live.monitors as object) ? (live.monitors as { error: string }).error : live.monitors} />
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate)]/45">Alerts</p>
                    {live.alerts === null ? (
                      <p className="text-[color:var(--color-slate)]/55">Not offered by this Bluejay server.</p>
                    ) : (
                      <ResultView data={"error" in (live.alerts as object) ? (live.alerts as { error: string }).error : live.alerts} />
                    )}
                  </div>
                </div>
              )}
            </ClayCard>
          )}
        </div>
      </div>

      <ClayCard title="What Perrie is tested on" icon={ShieldCheck} accent="amber" className="mt-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[color:var(--color-slate)]">
              <ListChecks className="h-4 w-4" aria-hidden="true" /> Guardrail metrics (every call)
            </p>
            <ul className="space-y-2">
              {GUARDRAIL_METRICS.map((m) => (
                <li key={m.name} className="rounded-2xl px-3 py-2.5 text-sm" style={{ background: "rgba(255,255,255,0.6)" }}>
                  <p className="font-bold text-[color:var(--color-slate)]">{m.name.replace(/^Perrie · /, "")}</p>
                  <p className="text-[color:var(--color-slate)]/70">{m.description}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-3 flex items-center gap-2 text-sm font-bold text-[color:var(--color-slate)]">
              <FlaskConical className="h-4 w-4" aria-hidden="true" /> Simulated callers (&ldquo;{SIMULATION_NAME}&rdquo;)
            </p>
            <ul className="space-y-2">
              {SCENARIOS.map((s) => (
                <li key={s.key} className="rounded-2xl px-3 py-2.5 text-sm" style={{ background: "rgba(255,255,255,0.6)" }}>
                  <p className="flex flex-wrap items-center gap-2 font-bold text-[color:var(--color-slate)]">
                    {s.title} <Pill tone={s.tag === "red-team" ? "coral" : "sky"}>{s.tag}</Pill>
                  </p>
                  <p className="text-[color:var(--color-slate)]/70">
                    <span className="font-semibold">Pass if: </span>
                    {s.passIf}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[color:var(--color-slate)]/50">Rehearse any of these in the Playground first.</p>
          </div>
        </div>
      </ClayCard>

      {live?.ok && (
        <details className="mt-6 rounded-[28px] p-5" style={{ background: "rgba(255,252,247,0.8)" }}>
          <summary className="flex cursor-pointer items-center gap-2 font-heading text-lg font-semibold text-[color:var(--color-slate)]">
            <Wrench className="h-4 w-4" aria-hidden="true" /> Advanced: run any Bluejay tool
          </summary>
          <div className="mt-4">
            <BluejayRunner groups={groupTools(live.tools)} />
          </div>
        </details>
      )}
    </>
  );
}
