import Link from "next/link";
import { ArrowDown, ArrowRight, Check, KeyRound, PhoneCall } from "lucide-react";
import { integrationIcon } from "@/components/dashboard/integrationIcons";
import { ACCENTS, ClayCard, IconBubble, PageHeader, Pill } from "@/components/dashboard/ui";
import { env } from "@/server/env";
import { PLATFORM_SERVICES, type PlatformService } from "@/server/platform/services";

export const metadata = { title: "Voice stack — Perrie" };

function Stage({ svc, label }: { svc: PlatformService; label: string }) {
  const st = svc.status();
  const a = ACCENTS[svc.accent];
  return (
    <div
      className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-3xl px-3 py-4 text-center"
      style={{ background: st.connected ? a.soft : "rgba(255,255,255,0.6)", boxShadow: "inset 2px 2px 6px rgba(255,255,255,0.8)" }}
    >
      <IconBubble icon={integrationIcon(svc.icon)} accent={svc.accent} />
      <p className="text-sm font-bold text-[color:var(--color-slate)]">{svc.name}</p>
      <p className="text-xs font-semibold" style={{ color: a.ink }}>
        {label}
      </p>
    </div>
  );
}

const Arrow = () => (
  <>
    <ArrowRight className="hidden h-5 w-5 shrink-0 text-[color:var(--color-slate)]/30 md:block" aria-hidden="true" />
    <ArrowDown className="h-5 w-5 shrink-0 text-[color:var(--color-slate)]/30 md:hidden" aria-hidden="true" />
  </>
);

export default function VoiceStackPage() {
  const svc = Object.fromEntries(PLATFORM_SERVICES.map((s) => [s.id, s])) as Record<PlatformService["id"], PlatformService>;
  const base = env.publicBaseUrl();

  return (
    <>
      <PageHeader
        eyebrow="Voice stack"
        title="How a call flows"
        subtitle="The engine under Perrie. Twilio carries the call, Deepgram turns speech into text and back, Claude decides what to say and do, Supabase remembers it — and Bluejay watches quality from the outside."
      />

      <ClayCard title="Live call pipeline" icon={PhoneCall} accent="lilac" className="mb-8">
        <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
          <div className="flex flex-col items-center gap-2 rounded-3xl px-3 py-4 text-center md:w-28" style={{ background: "rgba(255,255,255,0.6)" }}>
            <IconBubble icon={PhoneCall} accent="slate" />
            <p className="text-sm font-bold text-[color:var(--color-slate)]">Caller</p>
          </div>
          <Arrow />
          <Stage svc={svc.twilio} label="Media Streams · μ-law 8 kHz" />
          <Arrow />
          <Stage svc={svc.deepgram} label="Speech → text (streaming)" />
          <Arrow />
          <Stage svc={svc.claude} label="Guardrailed agent + tools" />
          <Arrow />
          <Stage svc={svc.deepgram} label="Text → speech (Aura)" />
          <Arrow />
          <Stage svc={svc.twilio} label="Back to the caller" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <p className="rounded-2xl px-4 py-3 text-sm text-[color:var(--color-slate)]/75" style={{ background: ACCENTS.mint.soft }}>
            <strong>Supabase</strong> stores every turn of the transcript, the call summary and outcome as the call happens.
          </p>
          <p className="rounded-2xl px-4 py-3 text-sm text-[color:var(--color-slate)]/75" style={{ background: ACCENTS.sky.soft }}>
            <strong>Bluejay</strong> gets each finished call for scoring and sends simulated callers to test Perrie —{" "}
            <Link href="/dashboard/monitoring" className="font-bold underline">
              Monitoring
            </Link>
            .
          </p>
        </div>
      </ClayCard>

      <div className="grid gap-6 md:grid-cols-2">
        {PLATFORM_SERVICES.map((s) => {
          const st = s.status();
          return (
            <ClayCard key={s.id}>
              <div className="flex items-start gap-4">
                <IconBubble icon={integrationIcon(s.icon)} accent={s.accent} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate)]/45">{s.layer}</p>
                  <h2 className="font-heading text-xl font-semibold text-[color:var(--color-slate)]">{s.name}</h2>
                  <div className="mt-1">{st.connected ? <Pill tone="mint">Ready</Pill> : <Pill tone="slate">Not set up</Pill>}</div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--color-slate)]/70">{s.description}</p>
              {st.label && <p className="mt-2 truncate text-sm font-bold text-[color:var(--color-slate)]/80">{st.label}</p>}
              {!st.connected && st.hint && <p className="mt-2 text-xs text-[color:var(--color-slate)]/55">{st.hint}</p>}
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Environment variables">
                {s.vars.map((v) => {
                  const set = !!process.env[v]?.trim();
                  return (
                    <li key={v}>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold"
                        style={{ background: set ? ACCENTS.mint.soft : "#F1EDE6", color: set ? ACCENTS.mint.ink : "#7A8796" }}
                      >
                        {set ? <Check className="h-3 w-3" aria-hidden="true" /> : <KeyRound className="h-3 w-3" aria-hidden="true" />}
                        {v}
                        <span className="sr-only">{set ? " is set" : " is missing"}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {s.id === "twilio" && (
                <p className="mt-4 text-xs leading-relaxed text-[color:var(--color-slate)]/55">
                  Number&apos;s &ldquo;A call comes in&rdquo; webhook:{" "}
                  <code className="font-bold">POST {base ?? "<PUBLIC_BASE_URL>"}/api/twilio/voice</code>
                </p>
              )}
            </ClayCard>
          );
        })}
      </div>
    </>
  );
}
