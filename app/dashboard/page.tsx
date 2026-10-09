import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  Gauge,
  Bot,
  Check,
  CircleDashed,
  ListChecks,
  MailOpen,
  MessageSquareText,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Plug,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { markMessageReadAction } from "@/actions/messages";
import AutoRefresh from "@/components/dashboard/AutoRefresh";
import { RoleBadge, SeverityBadge, TaskStatusBadge } from "@/components/dashboard/badges";
import { integrationIcon } from "@/components/dashboard/integrationIcons";
import {
  ACCENTS,
  ClayCard,
  EmptyState,
  IconBubble,
  PageHeader,
  Pill,
  RainbowLink,
  SoftLink,
  type Accent,
} from "@/components/dashboard/ui";
import { fmtDuration, greeting, timeAgo } from "@/lib/format";
import {
  getProfile,
  listCalls,
  listFacts,
  listGuardrails,
  listMessages,
  listSteps,
  listTasks,
  ownerName,
} from "@/server/db";
import { serviceStatus } from "@/server/env";
import { APP_INTEGRATIONS } from "@/server/integrations";
import { PLATFORM_SERVICES } from "@/server/platform/services";
import { providerStatuses } from "@/server/tools/registry";
import { db } from "@/server/db";
import { orEmpty } from "@/server/monitoring/safe";
import { bluejayConfigured } from "@/server/monitoring/bluejay/client";
import type { EvalScores } from "@/server/monitoring/bluejay/evaluations";
import { guardrailTally } from "@/components/dashboard/EvaluationView";
import { prettyPhone } from "@/server/phone";

export const metadata = { title: "Overview — Perrie" };

function Stat({ icon, accent, label, value, href }: { icon: typeof PhoneCall; accent: Accent; label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="focus-ring group flex items-center gap-4 rounded-[24px] p-4 transition-transform duration-200 hover:-translate-y-0.5"
      style={{
        background: "#FFFCF7",
        boxShadow:
          "0 20px 40px -30px rgba(38,52,69,0.5), inset -5px -6px 14px rgba(38,52,69,0.06), inset 5px 5px 12px rgba(255,255,255,0.92)",
      }}
    >
      <IconBubble icon={icon} accent={accent} />
      <div>
        <p className="font-display text-3xl leading-none" style={{ color: ACCENTS[accent].ink }}>
          {value}
        </p>
        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate)]/50">{label}</p>
      </div>
    </Link>
  );
}

export default async function OverviewPage() {
  const [profile, facts, calls, tasks, messages, guardrails, statuses, evaluations, monitorState] = await Promise.all([
    getProfile(),
    listFacts(),
    listCalls(50),
    listTasks(20),
    listMessages(20),
    listGuardrails(30),
    providerStatuses(true),
    orEmpty(db().list("call_evaluations", { orderBy: "created_at", ascending: false, limit: 50 }), []).then((r) => r.value),
    orEmpty(db().get("monitoring_state", "bluejay"), null).then((r) => r.value),
  ]);
  const scored = evaluations.filter((e) => e.status === "completed" && e.scores);
  const tally = scored.map((e) => guardrailTally(e.scores as unknown as EvalScores));
  const grPassed = tally.reduce((a, t) => a + t.passed, 0);
  const grTotal = tally.reduce((a, t) => a + t.total, 0);
  const tz = profile?.timezone ?? "UTC";
  const name = ownerName(profile);
  const weekAgo = Date.now() - 7 * 86400_000;
  const callsThisWeek = calls.filter((c) => new Date(c.created_at).getTime() > weekAgo).length;
  const activeTasks = tasks.filter((t) => ["planning", "awaiting_approval", "running", "waiting"].includes(t.status));
  const unread = messages.filter((m) => !m.read);
  const blocks = guardrails.filter((g) => g.severity === "block" && new Date(g.created_at).getTime() > weekAgo);
  const live = calls.some((c) => c.status === "in-progress") || tasks.some((t) => ["planning", "running"].includes(t.status));
  const taskProgress = await Promise.all(
    activeTasks.slice(0, 4).map(async (t) => {
      const steps = await listSteps(t.id);
      return { task: t, done: steps.filter((s) => s.status === "succeeded").length, total: steps.length };
    }),
  );

  const svc = serviceStatus();
  const checklist: { label: string; done: boolean; hint: string; href?: string }[] = [
    { label: "Create your profile", done: !!profile, hint: "Who Perrie works for", href: "/dashboard/profile" },
    { label: "Set your owner PIN", done: !!profile?.pin_hash, hint: "Unlocks owner mode on calls", href: "/dashboard/profile" },
    { label: "Add facts about you", done: facts.length > 0, hint: "What Perrie may answer", href: "/dashboard/profile" },
    { label: "Claude (ANTHROPIC_API_KEY)", done: svc.anthropic, hint: "Conversations + planning" },
    { label: "Twilio number", done: svc.twilio && svc.publicUrl, hint: "TWILIO_* + PUBLIC_BASE_URL" },
    { label: "Deepgram voice", done: svc.deepgram, hint: "DEEPGRAM_API_KEY" },
    { label: "Supabase database", done: svc.supabase, hint: "Otherwise local dev storage" },
    {
      label: "Google Calendar & Contacts",
      done: !!statuses.get("google_calendar")?.connected && !!statuses.get("google_contacts")?.connected,
      hint: "Connect on Integrations",
      href: "/dashboard/integrations",
    },
    { label: "Bluejay monitoring", done: svc.bluejay, hint: "BLUEJAY_API_KEY", href: "/dashboard/monitoring" },
  ];
  const doneCount = checklist.filter((c) => c.done).length;

  return (
    <>
      <AutoRefresh active={live} everyMs={4000} />
      <PageHeader
        eyebrow={greeting(tz)}
        title={
          profile ? (
            <>
              Hi, <span className="rainbow-text">{name}</span>
            </>
          ) : (
            <>
              Meet <span className="rainbow-text">Perrie</span>
            </>
          )
        }
        subtitle={
          profile
            ? `Here's what ${profile.assistant_name} has been up to.`
            : "Your personal AI assistant: it answers your phone, calls people for you, books your calendar — and works only for you."
        }
        actions={
          <>
            <SoftLink href="/dashboard/playground">
              <Bot className="h-4 w-4" aria-hidden="true" /> Try it
            </SoftLink>
            <RainbowLink href="/dashboard/tasks#new">
              <Plus className="h-4 w-4" aria-hidden="true" /> New task
            </RainbowLink>
          </>
        }
      />

      {!profile && (
        <div
          className="relative mb-8 overflow-hidden rounded-[32px] p-7 sm:p-9"
          style={{
            background: "linear-gradient(120deg, #F1ECFF 0%, #FFEFF6 50%, #FFF6E0 100%)",
            boxShadow:
              "0 30px 60px -40px rgba(146,119,234,0.7), inset -8px -10px 22px rgba(38,52,69,0.06), inset 8px 8px 20px rgba(255,255,255,0.9)",
          }}
        >
          <div className="flex flex-wrap items-center gap-6">
            <IconBubble icon={UserRound} accent="pink" size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-3xl text-[color:var(--color-slate)]">First, tell Perrie who you are</h2>
              <p className="mt-2 max-w-xl text-[color:var(--color-slate)]/70">
                Your profile is what makes Perrie <em>your</em> agent: your numbers and PIN prove it&apos;s you on the
                phone, and your facts are the only things it will say about you.
              </p>
            </div>
            <RainbowLink href="/dashboard/profile" className="px-7 py-3 text-base">
              Create my profile <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </RainbowLink>
          </div>
        </div>
      )}

      <div className="mb-8 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat icon={PhoneCall} accent="mint" label="Calls this week" value={callsThisWeek} href="/dashboard/calls" />
        <Stat icon={ListChecks} accent="amber" label="Active tasks" value={activeTasks.length} href="/dashboard/tasks" />
        <Stat icon={MessageSquareText} accent="pink" label="New messages" value={unread.length} href="#messages" />
        <Stat icon={ShieldAlert} accent="coral" label="Blocked (7 days)" value={blocks.length} href="#guardrails" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <ClayCard
            title="Recent calls"
            icon={PhoneCall}
            accent="mint"
            action={
              <Link href="/dashboard/calls" className="focus-ring rounded-full text-sm font-bold text-[#1C7F62] hover:underline">
                All calls
              </Link>
            }
          >
            {calls.length ? (
              <ul className="space-y-2.5">
                {calls.slice(0, 6).map((c) => {
                  const Dir = c.direction === "outbound" ? PhoneOutgoing : c.direction === "web" ? Bot : PhoneIncoming;
                  const who =
                    c.counterpart_name ??
                    (c.direction === "outbound" ? prettyPhone(c.to_number) : c.direction === "web" ? "Playground" : prettyPhone(c.from_number));
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/dashboard/calls/${c.id}`}
                        className="focus-ring flex items-start gap-3 rounded-2xl px-3 py-3 transition hover:bg-white/80"
                      >
                        <span
                          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                          style={{ background: ACCENTS.mint.soft, color: ACCENTS.mint.ink }}
                          aria-hidden="true"
                        >
                          <Dir className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[color:var(--color-slate)]">
                            {who} <RoleBadge role={c.role} />
                            {c.status === "in-progress" && <Pill tone="lilac">Live now</Pill>}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-sm text-[color:var(--color-slate)]/65">
                            {c.summary ?? c.mission ?? "Transcript available"}
                          </p>
                        </div>
                        <span className="shrink-0 text-right text-xs font-semibold text-[color:var(--color-slate)]/45">
                          {timeAgo(c.created_at)}
                          <br />
                          {c.duration_seconds != null ? fmtDuration(c.duration_seconds) : ""}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={PhoneCall} accent="mint" title="No calls yet">
                Once your Twilio number points at Perrie, every call and its transcript shows up here. Meanwhile, try a
                conversation in the <Link className="font-bold underline" href="/dashboard/playground">playground</Link>.
              </EmptyState>
            )}
          </ClayCard>

          <ClayCard
            title="Tasks in motion"
            icon={ListChecks}
            accent="amber"
            action={
              <Link href="/dashboard/tasks" className="focus-ring rounded-full text-sm font-bold text-[#A2620F] hover:underline">
                All tasks
              </Link>
            }
          >
            {taskProgress.length ? (
              <ul className="space-y-3">
                {taskProgress.map(({ task, done, total }) => (
                  <li key={task.id}>
                    <Link href={`/dashboard/tasks/${task.id}`} className="focus-ring block rounded-2xl px-3 py-3 transition hover:bg-white/80">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[color:var(--color-slate)]">{task.title}</p>
                        <TaskStatusBadge status={task.status} />
                      </div>
                      <div className="mt-2.5 h-2.5 overflow-hidden rounded-full" style={{ background: "#F1E9DD" }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${total ? Math.max(6, (done / total) * 100) : 6}%`,
                            background: "linear-gradient(90deg, #9277EA, #EC6FA6, #F0A23A)",
                          }}
                        />
                      </div>
                      <p className="mt-1.5 text-xs font-semibold text-[color:var(--color-slate)]/50">
                        {total ? `${done} of ${total} steps` : "Planning…"}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={ListChecks} accent="amber" title="Nothing in motion">
                Give Perrie a task — like &ldquo;Call the dentist and move my cleaning to next week&rdquo; — and watch it
                plan and work through the steps.
              </EmptyState>
            )}
          </ClayCard>

          <ClayCard id="messages" title="Messages for you" icon={MessageSquareText} accent="pink">
            {messages.length ? (
              <ul className="space-y-2.5">
                {messages.slice(0, 6).map((m) => (
                  <li
                    key={m.id}
                    className="flex items-start gap-3 rounded-2xl px-4 py-3"
                    style={{ background: m.read ? "rgba(255,255,255,0.5)" : "#FFF3F8" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[color:var(--color-slate)]">
                        {m.from_name ?? "Unknown caller"}
                        {m.from_number && (
                          <span className="font-semibold text-[color:var(--color-slate)]/50">{prettyPhone(m.from_number)}</span>
                        )}
                        {m.urgency === "high" && <Pill tone="coral">Urgent</Pill>}
                      </p>
                      <p className="mt-1 text-sm text-[color:var(--color-slate)]/80">{m.body}</p>
                      <p className="mt-1 text-xs text-[color:var(--color-slate)]/45">
                        {timeAgo(m.created_at)}
                        {m.call_id && (
                          <>
                            {" · "}
                            <Link className="font-bold hover:underline" href={`/dashboard/calls/${m.call_id}`}>
                              View call
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    <form action={markMessageReadAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <button
                        type="submit"
                        className="focus-ring rounded-full p-1.5 text-[color:var(--color-slate)]/45 hover:text-[color:var(--color-slate)]"
                        aria-label={m.read ? "Mark as unread" : "Mark as read"}
                        title={m.read ? "Mark as unread" : "Mark as read"}
                      >
                        {m.read ? <MailOpen className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[color:var(--color-slate)]/60">
                When someone calls and you&apos;re not the one on the line, Perrie takes a message and it lands here.
              </p>
            )}
          </ClayCard>
        </div>

        <div className="space-y-6">
          <ClayCard title="Getting set up" icon={Sparkles} accent="lilac" action={<Pill tone="lilac">{doneCount}/{checklist.length}</Pill>}>
            <ul className="space-y-1.5">
              {checklist.map((c) => {
                const row = (
                  <span className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                    {c.done ? (
                      <span
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-white"
                        style={{ background: "linear-gradient(145deg, #9DE6CD, #3FBF9B)" }}
                        aria-hidden="true"
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                      </span>
                    ) : (
                      <CircleDashed className="h-6 w-6 text-[color:var(--color-slate)]/30" aria-hidden="true" />
                    )}
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-bold ${c.done ? "text-[color:var(--color-slate)]/55 line-through decoration-2" : "text-[color:var(--color-slate)]"}`}
                      >
                        {c.label}
                        <span className="sr-only">{c.done ? " (done)" : " (to do)"}</span>
                      </span>
                      <span className="block text-xs text-[color:var(--color-slate)]/50">{c.hint}</span>
                    </span>
                  </span>
                );
                return (
                  <li key={c.label}>
                    {c.href && !c.done ? (
                      <Link href={c.href} className="focus-ring block rounded-xl hover:bg-white/70">
                        {row}
                      </Link>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-[color:var(--color-slate)]/50">
              Keys go in <code className="font-bold">.env.local</code> — see <code className="font-bold">.env.example</code>.
            </p>
          </ClayCard>

          <ClayCard
            title="Voice stack"
            icon={AudioLines}
            accent="pink"
            action={
              <Link href="/dashboard/voice-stack" className="focus-ring rounded-full text-sm font-bold text-[#B83C76] hover:underline">
                Details
              </Link>
            }
          >
            <ul className="grid grid-cols-2 gap-2.5">
              {PLATFORM_SERVICES.map((svcDef) => {
                const st = svcDef.status();
                const Icon = integrationIcon(svcDef.icon);
                const a = ACCENTS[svcDef.accent];
                return (
                  <li
                    key={svcDef.id}
                    className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5"
                    style={{ background: st.connected ? a.soft : "rgba(255,255,255,0.6)" }}
                  >
                    <Icon className="h-4 w-4 shrink-0" style={{ color: st.connected ? a.ink : "#9AA5B1" }} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[color:var(--color-slate)]">{svcDef.name}</span>
                      <span className="block text-[11px] font-semibold" style={{ color: st.connected ? a.ink : "#8794A1" }}>
                        {svcDef.layer} · {st.connected ? "ready" : "not set up"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </ClayCard>

          <ClayCard
            title="Monitoring"
            icon={Gauge}
            accent="coral"
            action={
              <Link href="/dashboard/monitoring" className="focus-ring rounded-full text-sm font-bold text-[#B5403A] hover:underline">
                Open
              </Link>
            }
          >
            {!bluejayConfigured() ? (
              <p className="text-sm text-[color:var(--color-slate)]/65">
                Connect Bluejay to have every call scored and to test Perrie with simulated callers.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl px-2 py-2.5" style={{ background: ACCENTS.coral.soft }}>
                  <p className="font-display text-2xl" style={{ color: ACCENTS.coral.ink }}>
                    {scored.length}
                  </p>
                  <p className="text-[11px] font-bold text-[color:var(--color-slate)]/55">calls scored</p>
                </div>
                <div className="rounded-2xl px-2 py-2.5" style={{ background: ACCENTS.mint.soft }}>
                  <p className="font-display text-2xl" style={{ color: ACCENTS.mint.ink }}>
                    {grTotal ? `${Math.round((grPassed / grTotal) * 100)}%` : "—"}
                  </p>
                  <p className="text-[11px] font-bold text-[color:var(--color-slate)]/55">guardrails passed</p>
                </div>
                <div className="rounded-2xl px-2 py-2.5" style={{ background: ACCENTS.sky.soft }}>
                  <p className="text-sm font-bold" style={{ color: ACCENTS.sky.ink }}>
                    {{ ready: "On", partial: "Partly", error: "Not reachable", not_set_up: "Not set up" }[monitorState?.status ?? "not_set_up"]}
                  </p>
                  <p className="text-[11px] font-bold text-[color:var(--color-slate)]/55">Bluejay</p>
                </div>
              </div>
            )}
          </ClayCard>

          <ClayCard
            title="Your apps"
            icon={Plug}
            accent="sky"
            action={
              <Link href="/dashboard/integrations" className="focus-ring rounded-full text-sm font-bold text-[#2A6FA8] hover:underline">
                Manage
              </Link>
            }
          >
            <ul className="grid grid-cols-2 gap-2.5">
              {APP_INTEGRATIONS.map((i) => {
                const st = statuses.get(i.id);
                const Icon = integrationIcon(i.icon);
                const a = ACCENTS[i.accent];
                return (
                  <li
                    key={i.id}
                    className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5"
                    style={{ background: st?.connected ? a.soft : "rgba(255,255,255,0.6)" }}
                  >
                    <Icon className="h-4 w-4 shrink-0" style={{ color: st?.connected ? a.ink : "#9AA5B1" }} aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-[color:var(--color-slate)]">{i.name}</span>
                      <span className="block text-[11px] font-semibold" style={{ color: st?.connected ? a.ink : "#8794A1" }}>
                        {st?.connected ? "Connected" : "Not connected"}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </ClayCard>

          <ClayCard id="guardrails" title="Guardrails at work" icon={ShieldCheck} accent="coral">
            {guardrails.length ? (
              <ul className="space-y-2">
                {guardrails.slice(0, 6).map((g) => (
                  <li key={g.id} className="rounded-2xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.6)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <SeverityBadge severity={g.severity} />
                      <span className="text-xs text-[color:var(--color-slate)]/45">{timeAgo(g.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm text-[color:var(--color-slate)]/80">{g.detail}</p>
                    {g.call_id && (
                      <Link href={`/dashboard/calls/${g.call_id}`} className="text-xs font-bold text-[color:var(--color-slate)]/55 hover:underline">
                        View call
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[color:var(--color-slate)]/60">
                Every time Perrie blocks an action, holds back a private detail, or asks you to confirm, it&apos;s logged
                here.
              </p>
            )}
          </ClayCard>
        </div>
      </div>
    </>
  );
}
