import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Gauge,
  RotateCw,
  Send,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FileText,
  ListChecks,
  ShieldCheck,
  Target,
  Wrench,
  XCircle,
} from "lucide-react";
import AutoRefresh from "@/components/dashboard/AutoRefresh";
import { CallStatusBadge, RoleBadge, SeverityBadge } from "@/components/dashboard/badges";
import { ACCENTS, ClayCard, PageHeader, Pill } from "@/components/dashboard/ui";
import { fmtDateTime, fmtDuration, fmtTime, fmtWallTime } from "@/lib/format";
import { evaluateCallAction, refreshEvaluationAction } from "@/actions/monitoring";
import { EvaluationStatus, ScoreSummary } from "@/components/dashboard/EvaluationView";
import { db, getProfile, listTurns } from "@/server/db";
import { bluejayConfigured } from "@/server/monitoring/bluejay/client";
import { orEmpty } from "@/server/monitoring/safe";
import type { EvalScores } from "@/server/monitoring/bluejay/evaluations";
import { prettyPhone } from "@/server/phone";

export const metadata = { title: "Call — Perrie" };

type Outcome = { achieved?: boolean | null; key_points?: string[]; agreed_time?: string | null; follow_ups?: string[] };

export default async function CallDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const call = await db().get("calls", id);
  if (!call) notFound();
  const [profile, turns, guardrails, task, evals] = await Promise.all([
    getProfile(),
    listTurns(id),
    db().list("guardrail_events", { where: { call_id: id }, orderBy: "created_at" }),
    call.task_id ? db().get("tasks", call.task_id) : Promise.resolve(null),
    orEmpty(db().list("call_evaluations", { where: { call_id: id }, limit: 1 }), []).then((r) => r.value),
  ]);
  const evaluation = evals[0] ?? null;
  const monitoring = bluejayConfigured();
  const tz = profile?.timezone ?? "UTC";
  const assistant = profile?.assistant_name ?? "Perrie";
  const who =
    call.counterpart_name ??
    (call.direction === "outbound"
      ? prettyPhone(call.to_number)
      : call.direction === "web"
        ? "Playground"
        : prettyPhone(call.from_number));
  const otherLabel = call.role === "owner" ? (profile?.preferred_name ?? "You") : who;
  const outcome = (call.outcome ?? {}) as Outcome;

  return (
    <>
      <AutoRefresh
        active={
          call.status === "in-progress" ||
          (!!call.ended_at && !call.summary) ||
          (!!evaluation && ["pending", "submitted", "evaluating"].includes(evaluation.status))
        }
        everyMs={4000}
      />
      <Link
        href="/dashboard/calls"
        className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded-full text-sm font-bold text-[color:var(--color-slate)]/55 hover:text-[color:var(--color-slate)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All calls
      </Link>
      <PageHeader
        eyebrow={call.direction === "outbound" ? "Call made for you" : call.direction === "web" ? "Playground" : "Incoming call"}
        title={who}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <RoleBadge role={call.role} />
            <CallStatusBadge status={call.status} />
            <span className="text-sm font-semibold">
              {fmtDateTime(call.started_at ?? call.created_at, tz)} · {fmtDuration(call.duration_seconds)}
            </span>
            {call.direction !== "web" && (
              <span className="text-sm">
                {prettyPhone(call.from_number)} → {prettyPhone(call.to_number)}
              </span>
            )}
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div className="space-y-6">
          <ClayCard title="What happened" icon={FileText} accent="mint">
            {call.summary ? (
              <p className="leading-relaxed text-[color:var(--color-slate)]/85">{call.summary}</p>
            ) : (
              <p className="text-sm text-[color:var(--color-slate)]/55">
                {call.status === "in-progress" ? "The call is live — a summary appears when it ends." : "No summary yet."}
              </p>
            )}
            {outcome.achieved != null && (
              <p
                className="mt-4 flex items-center gap-2 text-sm font-bold"
                style={{ color: outcome.achieved ? ACCENTS.mint.ink : ACCENTS.coral.ink }}
              >
                {outcome.achieved ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
                {outcome.achieved ? "Mission accomplished" : "Mission not accomplished"}
              </p>
            )}
            {!!outcome.key_points?.length && (
              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate)]/45">Key details</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-[color:var(--color-slate)]/85">
                  {outcome.key_points.map((k, i) => (
                    <li key={i} className="flex gap-2">
                      <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#3FBF9B]" />
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {outcome.agreed_time && (
              <p className="mt-4 text-sm">
                <Pill tone="sky">Agreed time</Pill> <span className="font-bold">{fmtWallTime(outcome.agreed_time)}</span>
              </p>
            )}
            {!!outcome.follow_ups?.length && (
              <div className="mt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate)]/45">For you to follow up</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-[color:var(--color-slate)]/85">
                  {outcome.follow_ups.map((k, i) => (
                    <li key={i} className="flex gap-2">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#F0A23A]" aria-hidden="true" />
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </ClayCard>

          <ClayCard title="Bluejay check" icon={Gauge} accent="sky" action={evaluation ? <EvaluationStatus status={evaluation.status} /> : undefined}>
            {evaluation?.status === "completed" && evaluation.scores ? (
              <ScoreSummary scores={evaluation.scores as unknown as EvalScores} />
            ) : evaluation ? (
              <p className="text-sm text-[color:var(--color-slate)]/70">
                {evaluation.error ??
                  (evaluation.status === "skipped"
                    ? "This call wasn't sent."
                    : "Bluejay is scoring this call — results appear here automatically.")}
              </p>
            ) : (
              <p className="text-sm text-[color:var(--color-slate)]/70">
                {monitoring
                  ? "Not sent to Bluejay yet."
                  : "Connect Bluejay (Monitoring) to have every call scored for goal, made-up facts, latency and guardrails."}
              </p>
            )}
            {monitoring && (
              <div className="mt-4 flex flex-wrap gap-3">
                {!!call.ended_at &&
                  (!evaluation || evaluation.status === "failed" || evaluation.status === "skipped" || evaluation.status === "completed") && (
                  <form action={evaluateCallAction}>
                    <input type="hidden" name="call_id" value={call.id} />
                    <button
                      type="submit"
                      className="focus-ring inline-flex items-center gap-1.5 rounded-full text-sm font-bold text-[#2A6FA8] hover:underline"
                    >
                      <Send className="h-4 w-4" aria-hidden="true" /> {evaluation ? "Send again" : "Send to Bluejay"}
                    </button>
                  </form>
                )}
                {evaluation && ["pending", "submitted", "evaluating"].includes(evaluation.status) && (
                  <form action={refreshEvaluationAction}>
                    <input type="hidden" name="id" value={evaluation.id} />
                    <button
                      type="submit"
                      className="focus-ring inline-flex items-center gap-1.5 rounded-full text-sm font-bold text-[#2A6FA8] hover:underline"
                    >
                      <RotateCw className="h-4 w-4" aria-hidden="true" /> Check now
                    </button>
                  </form>
                )}
              </div>
            )}
          </ClayCard>

          {call.mission && (
            <ClayCard title="Mission" icon={Target} accent="amber">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--color-slate)]/85">{call.mission}</p>
              {task && (
                <Link
                  href={`/dashboard/tasks/${task.id}`}
                  className="focus-ring mt-4 inline-flex items-center gap-1.5 rounded-full text-sm font-bold text-[#A2620F] hover:underline"
                >
                  <ListChecks className="h-4 w-4" aria-hidden="true" /> Part of task: {task.title}
                </Link>
              )}
            </ClayCard>
          )}

          <ClayCard title="Guardrails on this call" icon={ShieldCheck} accent="coral">
            {guardrails.length ? (
              <ul className="space-y-2">
                {guardrails.map((g) => (
                  <li key={g.id} className="flex items-start gap-2 text-sm">
                    <SeverityBadge severity={g.severity} />
                    <span className="text-[color:var(--color-slate)]/80">{g.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[color:var(--color-slate)]/55">Nothing needed stopping on this call.</p>
            )}
          </ClayCard>
        </div>

        <ClayCard title="Transcript" icon={ClipboardList} accent="lilac">
          {turns.length ? (
            <ol className="space-y-3" aria-label="Call transcript">
              {turns.map((t) => {
                if (t.speaker === "tool" || t.speaker === "system") {
                  const meta = t.meta as { ok?: boolean; blocked?: boolean; guard?: string };
                  const tone = t.speaker === "system" ? "amber" : meta.blocked ? "coral" : meta.ok === false ? "coral" : "slate";
                  return (
                    <li key={t.id} className="flex justify-center">
                      <span
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                        style={{ background: ACCENTS[tone].soft, color: ACCENTS[tone].ink }}
                      >
                        {t.speaker === "system" ? <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden="true" /> : <Wrench className="h-3 w-3 shrink-0" aria-hidden="true" />}
                        <span className="truncate">{t.text}</span>
                      </span>
                    </li>
                  );
                }
                const agent = t.speaker === "agent";
                return (
                  <li key={t.id} className={`flex ${agent ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] ${agent ? "text-right" : "text-left"}`}>
                      <p className="mb-1 px-1 text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-slate)]/40">
                        {agent ? assistant : otherLabel} · {fmtTime(t.created_at, tz)}
                      </p>
                      <p
                        className={`inline-block whitespace-pre-wrap rounded-3xl px-4 py-2.5 text-left text-[15px] leading-relaxed ${
                          agent ? "rounded-br-lg text-white" : "rounded-bl-lg text-[color:var(--color-slate)]"
                        }`}
                        style={
                          agent
                            ? {
                                background: "linear-gradient(135deg, #A98FF5, #8D6FE6)",
                                boxShadow: "0 10px 20px -14px #9277EA, inset 2px 2px 6px rgba(255,255,255,0.35)",
                              }
                            : {
                                background: "#F5EFE7",
                                boxShadow: "inset 2px 2px 6px rgba(255,255,255,0.9), inset -2px -3px 6px rgba(38,52,69,0.06)",
                              }
                        }
                      >
                        {t.text}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-[color:var(--color-slate)]/55">No transcript recorded.</p>
          )}
        </ClayCard>
      </div>
    </>
  );
}
