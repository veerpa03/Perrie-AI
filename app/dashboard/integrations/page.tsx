import Link from "next/link";
import { ArrowRight, Check, Code2, LogIn, LogOut, X } from "lucide-react";
import { disconnectIntegrationAction } from "@/actions/integrations";
import { integrationIcon } from "@/components/dashboard/integrationIcons";
import { ACCENTS, ClayCard, IconBubble, PageHeader, Pill, SoftButton } from "@/components/dashboard/ui";
import { env } from "@/server/env";
import { APP_INTEGRATIONS } from "@/server/integrations";
import { googleRedirectUri } from "@/server/integrations/google/oauth";
import { providerStatuses } from "@/server/tools/registry";
import type { AgentRole } from "@/server/tools/types";

export const metadata = { title: "Integrations — Perrie" };

const ROLE_LABEL: Record<AgentRole, string> = {
  owner: "you",
  system: "tasks",
  delegate: "calls for you",
  guest: "callers",
};

const CATEGORY_LABEL: Record<string, string> = {
  calendar: "Calendar",
  contacts: "Contacts",
  documents: "Documents",
  spreadsheets: "Spreadsheets",
  developer: "Developer",
  communication: "Communication",
  other: "App",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const statuses = await providerStatuses(true);
  const googleReady = !!env.google();

  return (
    <>
      <PageHeader
        eyebrow="Integrations"
        title="Your apps"
        subtitle="The apps Perrie can work with on your behalf. Each one brings its own tools, and Perrie only uses a tool when the app is connected and the person it's acting for is allowed to use it."
      />

      {(sp.connected || sp.error) && (
        <p
          role={sp.error ? "alert" : "status"}
          className="mb-6 rounded-2xl px-4 py-3 text-sm font-bold"
          style={{
            background: sp.error ? ACCENTS.coral.soft : ACCENTS.mint.soft,
            color: sp.error ? ACCENTS.coral.ink : ACCENTS.mint.ink,
          }}
        >
          {sp.error ? sp.error : `Connected ${APP_INTEGRATIONS.find((i) => i.id === sp.connected)?.name ?? sp.connected}.`}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
        {APP_INTEGRATIONS.map((i) => {
          const st = statuses.get(i.id);
          const Icon = integrationIcon(i.icon);
          return (
            <ClayCard key={i.id} className="flex flex-col">
              <div className="flex items-start gap-4">
                <IconBubble icon={Icon} accent={i.accent} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate)]/45">
                    {CATEGORY_LABEL[i.category] ?? i.category}
                  </p>
                  <h2 className="font-heading text-xl font-semibold text-[color:var(--color-slate)]">{i.name}</h2>
                  <div className="mt-1">
                    {st?.connected ? (
                      <Pill tone="mint">
                        <Check className="h-3 w-3" aria-hidden="true" /> Connected
                      </Pill>
                    ) : st?.error ? (
                      <Pill tone="coral">{st.error}</Pill>
                    ) : (
                      <Pill tone="slate">Not connected</Pill>
                    )}
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--color-slate)]/70">{i.description}</p>
              {st?.label && <p className="mt-2 truncate text-sm font-bold text-[color:var(--color-slate)]/80">{st.label}</p>}
              {!st?.connected && st?.hint && <p className="mt-2 text-xs text-[color:var(--color-slate)]/55">{st.hint}</p>}

              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate)]/45">What Perrie can do</p>
                <ul className="mt-2 space-y-1.5">
                  {i.tools.map((t) => (
                    <li key={t.name} className="text-xs text-[color:var(--color-slate)]/70">
                      <code className="font-bold text-[color:var(--color-slate)]">{t.name}</code>
                      <span className="ml-1.5">for {t.roles.map((r) => ROLE_LABEL[r]).join(", ")}</span>
                      {t.sideEffect && <span className="ml-1.5 font-bold text-[#B5403A]">· asks first</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto pt-5">
                {i.connect.kind === "oauth" &&
                  (st?.connected || st?.error ? (
                    <form action={disconnectIntegrationAction}>
                      <input type="hidden" name="id" value={i.id} />
                      <SoftButton type="submit">
                        <LogOut className="h-4 w-4" aria-hidden="true" /> Disconnect
                      </SoftButton>
                    </form>
                  ) : googleReady ? (
                    <a
                      href={`/api/integrations/google/start?integration=${i.id}`}
                      className="focus-ring inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
                      style={{
                        background: `linear-gradient(135deg, ${ACCENTS[i.accent].light}, ${ACCENTS[i.accent].base})`,
                        boxShadow: `0 12px 22px -14px ${ACCENTS[i.accent].base}, inset -3px -4px 8px rgba(0,0,0,0.12), inset 3px 3px 7px rgba(255,255,255,0.45)`,
                      }}
                    >
                      <LogIn className="h-4 w-4" aria-hidden="true" /> Connect Google
                    </a>
                  ) : (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--color-slate)]/55">
                      <X className="h-3.5 w-3.5" aria-hidden="true" /> Add GOOGLE_CLIENT_ID / SECRET first
                    </p>
                  ))}
              </div>
            </ClayCard>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ClayCard title="More apps plug in here" icon={Code2} accent="lilac">
          <p className="-mt-1 mb-3 text-sm text-[color:var(--color-slate)]/70">
            Excel, GitHub, Gmail, Notion… each new app is one file:
          </p>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-[color:var(--color-slate)]/75">
            <li>
              Create <code className="font-bold">src/server/integrations/&lt;app&gt;.ts</code> exporting an{" "}
              <code className="font-bold">AppIntegration</code>: how to connect, a <code>status()</code> check, and its tools
              (zod input, who may use them, whether they change things).
            </li>
            <li>
              Add it to <code className="font-bold">APP_INTEGRATIONS</code> in <code>src/server/integrations/index.ts</code>.
            </li>
            <li>
              The phone agent, task planner, orchestrator and this page pick it up — with the same role checks, confirmations and
              logging.
            </li>
          </ol>
          {googleReady && (
            <p className="mt-4 text-xs text-[color:var(--color-slate)]/55">
              Google OAuth redirect URI to register: <code className="font-bold">{googleRedirectUri()}</code>
            </p>
          )}
        </ClayCard>
        <ClayCard>
          <p className="text-sm leading-relaxed text-[color:var(--color-slate)]/75">
            Looking for Twilio, Deepgram, Claude or Supabase? They&apos;re the engine Perrie runs on, not apps — see the{" "}
            <Link href="/dashboard/voice-stack" className="font-bold text-[#B83C76] hover:underline">
              Voice stack
            </Link>
            . Call quality and testing with Bluejay live under{" "}
            <Link href="/dashboard/monitoring" className="font-bold text-[#2A6FA8] hover:underline">
              Monitoring
            </Link>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/dashboard/voice-stack"
              className="focus-ring inline-flex items-center gap-1.5 rounded-full text-sm font-bold text-[color:var(--color-slate)]/70 hover:text-[color:var(--color-slate)]"
            >
              Voice stack <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/dashboard/monitoring"
              className="focus-ring inline-flex items-center gap-1.5 rounded-full text-sm font-bold text-[color:var(--color-slate)]/70 hover:text-[color:var(--color-slate)]"
            >
              Monitoring <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </ClayCard>
      </div>
    </>
  );
}
