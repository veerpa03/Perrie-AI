import { CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import type { EvalScores } from "@/server/monitoring/bluejay/evaluations";
import { ACCENTS, Pill, type Accent } from "./ui";

/** Rendering for Bluejay's per-call scores (server-component safe). */

const STATUS: Record<string, { tone: Accent; label: string }> = {
  pending: { tone: "sky", label: "Sending to Bluejay" },
  submitted: { tone: "lilac", label: "Sent — scoring" },
  evaluating: { tone: "lilac", label: "Bluejay is scoring" },
  completed: { tone: "mint", label: "Scored" },
  failed: { tone: "coral", label: "Not scored" },
  skipped: { tone: "slate", label: "Not sent" },
};

export function EvaluationStatus({ status }: { status: string }) {
  const s = STATUS[status] ?? { tone: "slate" as Accent, label: status };
  return <Pill tone={s.tone}>{s.label}</Pill>;
}

export function guardrailTally(scores: EvalScores | null | undefined) {
  const metrics = (scores?.metrics ?? []).filter((m) => m.name.startsWith("Perrie ·"));
  const judged = metrics.filter((m) => m.passed !== null);
  return { passed: judged.filter((m) => m.passed).length, total: judged.length, failed: judged.filter((m) => m.passed === false) };
}

function Verdict({ ok, good, bad, unknown = "—" }: { ok: boolean | null; good: string; bad: string; unknown?: string }) {
  if (ok === null) return <span className="text-[color:var(--color-slate)]/45">{unknown}</span>;
  return (
    <span className="inline-flex items-center gap-1 font-bold" style={{ color: ok ? ACCENTS.mint.ink : ACCENTS.coral.ink }}>
      {ok ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
      {ok ? good : bad}
    </span>
  );
}

export function ScoreSummary({ scores }: { scores: EvalScores }) {
  const t = guardrailTally(scores);
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.7)" }}>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-slate)]/45">Goal</dt>
          <dd className="mt-1">
            <Verdict ok={scores.goal_success} good="Achieved" bad="Missed" />
          </dd>
        </div>
        <div className="rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.7)" }}>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-slate)]/45">Made-up facts</dt>
          <dd className="mt-1">
            <Verdict ok={scores.hallucination === null ? null : !scores.hallucination} good="None found" bad="Hallucinated" />
          </dd>
        </div>
        <div className="rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.7)" }}>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-slate)]/45">Guardrails</dt>
          <dd className="mt-1 font-bold" style={{ color: t.total && t.passed === t.total ? ACCENTS.mint.ink : t.total ? ACCENTS.coral.ink : undefined }}>
            {t.total ? `${t.passed}/${t.total} passed` : "—"}
          </dd>
        </div>
        <div className="rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.7)" }}>
          <dt className="text-[11px] font-bold uppercase tracking-wider text-[color:var(--color-slate)]/45">Avg latency</dt>
          <dd className="mt-1 font-bold text-[color:var(--color-slate)]/85">{scores.avg_latency != null ? `${Math.round(scores.avg_latency)}` : "—"}</dd>
        </div>
      </dl>
      {scores.goal_reasoning && (
        <p className="text-sm text-[color:var(--color-slate)]/75">
          <span className="font-bold">Goal: </span>
          {scores.goal_reasoning}
        </p>
      )}
      {scores.hallucination && scores.hallucination_reasoning && (
        <p className="text-sm text-[#B5403A]">
          <span className="font-bold">Hallucination: </span>
          {scores.hallucination_reasoning}
        </p>
      )}
      {scores.metrics.length > 0 && (
        <ul className="space-y-2">
          {scores.metrics.map((m) => (
            <li key={m.name} className="rounded-2xl px-3 py-2.5 text-sm" style={{ background: "rgba(255,255,255,0.6)" }}>
              <p className="flex flex-wrap items-center gap-2 font-bold text-[color:var(--color-slate)]">
                {m.passed === true ? (
                  <CheckCircle2 className="h-4 w-4 text-[#1C7F62]" aria-label="passed" />
                ) : m.passed === false ? (
                  <XCircle className="h-4 w-4 text-[#B5403A]" aria-label="failed" />
                ) : (
                  <CircleDashed className="h-4 w-4 text-[color:var(--color-slate)]/40" aria-label="not judged" />
                )}
                {m.name.replace(/^Perrie · /, "")}
                <span className="font-semibold text-[color:var(--color-slate)]/50">{m.value}</span>
                {m.human_edited && <Pill tone="amber">reviewed by a person</Pill>}
              </p>
              {m.reasoning && <p className="mt-1 text-[color:var(--color-slate)]/70">{m.reasoning}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
