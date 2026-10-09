import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, CircleAlert, ListChecks, Play, PhoneCall, RotateCcw, Sparkles, X } from "lucide-react";
import { approveTaskAction, cancelTaskAction, replanTaskAction } from "@/actions/tasks";
import AutoRefresh from "@/components/dashboard/AutoRefresh";
import { StepStatusBadge, TaskStatusBadge } from "@/components/dashboard/badges";
import { ACCENTS, ClayCard, PageHeader, Pill, RainbowButton, SoftButton } from "@/components/dashboard/ui";
import { fmtDateTime } from "@/lib/format";
import { db, getProfile, listSteps } from "@/server/db";
import { getAppIntegration } from "@/server/integrations";
import { getProvider, getTool } from "@/server/tools/registry";

export const metadata = { title: "Task — Perrie" };

function Data({ label, value }: { label: string; value: unknown }) {
  if (value == null) return null;
  return (
    <details className="mt-2 rounded-2xl px-3 py-2 text-xs" style={{ background: "rgba(245,239,231,0.8)" }}>
      <summary className="cursor-pointer font-bold text-[color:var(--color-slate)]/60">{label}</summary>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words text-[color:var(--color-slate)]/80">
        {JSON.stringify(value, null, 2)}
      </pre>
    </details>
  );
}

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await db().get("tasks", id);
  if (!task) notFound();
  const [profile, steps] = await Promise.all([getProfile(), listSteps(id)]);
  const tz = profile?.timezone ?? "UTC";
  const terminal = ["completed", "failed", "canceled"].includes(task.status);
  const live = ["planning", "running", "waiting"].includes(task.status);

  return (
    <>
      <AutoRefresh active={live} everyMs={2500} />
      <Link
        href="/dashboard/tasks"
        className="focus-ring mb-4 inline-flex items-center gap-1.5 rounded-full text-sm font-bold text-[color:var(--color-slate)]/55 hover:text-[color:var(--color-slate)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All tasks
      </Link>
      <PageHeader
        eyebrow={`Task · ${fmtDateTime(task.created_at, tz)}`}
        title={task.title}
        subtitle={<TaskStatusBadge status={task.status} />}
        actions={
          <>
            {task.status === "awaiting_approval" && (
              <form action={approveTaskAction}>
                <input type="hidden" name="id" value={task.id} />
                <RainbowButton type="submit" className="px-6 py-3">
                  <Play className="h-4 w-4" aria-hidden="true" /> Approve &amp; run
                </RainbowButton>
              </form>
            )}
            {!terminal && (
              <form action={cancelTaskAction}>
                <input type="hidden" name="id" value={task.id} />
                <SoftButton type="submit">
                  <X className="h-4 w-4" aria-hidden="true" /> Cancel
                </SoftButton>
              </form>
            )}
            {(task.status === "failed" || task.status === "canceled") && (
              <form action={replanTaskAction}>
                <input type="hidden" name="id" value={task.id} />
                <SoftButton type="submit">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" /> Plan again
                </SoftButton>
              </form>
            )}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-6">
          <ClayCard title="You asked" icon={Sparkles} accent="pink">
            <blockquote className="whitespace-pre-wrap border-l-4 border-[#EC6FA6]/40 pl-4 text-[color:var(--color-slate)]/85">
              {task.request}
            </blockquote>
            {task.plan_summary && (
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--color-slate)]/70">
                <span className="font-bold text-[color:var(--color-slate)]">Plan: </span>
                {task.plan_summary}
              </p>
            )}
          </ClayCard>

          {task.status === "planning" && (
            <ClayCard>
              <p className="text-sm font-bold text-[color:var(--color-slate)]/70">Perrie is planning this…</p>
            </ClayCard>
          )}

          {task.result_summary && (
            <ClayCard title="Result" icon={CheckCircle2} accent="mint">
              <p className="leading-relaxed text-[color:var(--color-slate)]/85">{task.result_summary}</p>
            </ClayCard>
          )}

          {task.error && (
            <ClayCard title={task.error.startsWith("Needs clarification") ? "Perrie has a question" : "Why it stopped"} icon={CircleAlert} accent="coral">
              <p className="leading-relaxed text-[color:var(--color-slate)]/85">{task.error}</p>
            </ClayCard>
          )}
        </div>

        <ClayCard title="Steps" icon={ListChecks} accent="amber">
          {steps.length ? (
            <ol className="relative space-y-4">
              {steps.map((s, i) => {
                const tool = getTool(s.tool);
                const provider = tool ? getProvider(tool.provider) : undefined;
                const app = tool ? getAppIntegration(tool.provider) : undefined;
                const accent = app?.accent ?? (tool?.provider === "telephony" ? "coral" : "lilac");
                const callId = (s.output as { call_id?: string } | null)?.call_id;
                const a = ACCENTS[accent];
                return (
                  <li key={s.id} className="relative flex gap-4">
                    {i < steps.length - 1 && (
                      <span aria-hidden="true" className="absolute left-[19px] top-11 h-[calc(100%-1.5rem)] w-0.5 rounded bg-[color:var(--color-slate)]/10" />
                    )}
                    <span
                      className="relative z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl font-display text-lg text-white"
                      style={{
                        background:
                          s.status === "succeeded"
                            ? "linear-gradient(145deg, #9DE6CD, #3FBF9B)"
                            : s.status === "failed"
                              ? "linear-gradient(145deg, #FFB3A6, #EE6F6A)"
                              : `linear-gradient(145deg, ${a.light}, ${a.base})`,
                        boxShadow: "inset -2px -3px 6px rgba(0,0,0,0.12), inset 2px 2px 5px rgba(255,255,255,0.55)",
                      }}
                      aria-hidden="true"
                    >
                      {s.position}
                    </span>
                    <div className="min-w-0 flex-1 rounded-3xl px-4 py-3" style={{ background: "rgba(255,255,255,0.65)" }}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-[color:var(--color-slate)]">{s.title}</p>
                        <StepStatusBadge status={s.status} />
                        <Pill tone={accent}>
                          {provider?.name ?? "Unknown"} · {s.tool}
                        </Pill>
                        {tool?.sideEffect && <Pill tone="coral">changes things</Pill>}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--color-slate)]/70">{s.description}</p>
                      {s.depends_on.length > 0 && (
                        <p className="mt-1 text-xs font-semibold text-[color:var(--color-slate)]/45">
                          Uses results of step {s.depends_on.join(", ")}
                        </p>
                      )}
                      {s.error && <p className="mt-2 text-sm font-semibold text-[#B5403A]">{s.error}</p>}
                      {callId && (
                        <Link
                          href={`/dashboard/calls/${callId}`}
                          className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded-full text-sm font-bold hover:underline"
                          style={{ color: a.ink }}
                        >
                          <PhoneCall className="h-4 w-4" aria-hidden="true" /> Open the call
                        </Link>
                      )}
                      <Data label="Input" value={s.input} />
                      <Data label="Result" value={s.output} />
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-[color:var(--color-slate)]/55">
              {task.status === "planning" ? "Steps appear once the plan is ready." : "No steps."}
            </p>
          )}
        </ClayCard>
      </div>
    </>
  );
}
