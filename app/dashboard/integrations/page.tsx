import { auth } from "@clerk/nextjs/server";
import { Check, LogIn, LogOut, X } from "lucide-react";
import { disconnectIntegrationAction } from "@/actions/integrations";
import CredentialsForm from "@/components/dashboard/CredentialsForm";
import { integrationIcon } from "@/components/dashboard/integrationIcons";
import { ACCENTS, ClayCard, IconBubble, PageHeader, Pill, SoftButton } from "@/components/dashboard/ui";
import { env } from "@/server/env";
import { INTEGRATIONS, integrationStatuses } from "@/server/integrations/registry";

export const metadata = { title: "Integrations — Perrie" };

const CATEGORY_LABEL: Record<string, string> = {
  core: "Built in",
  telephony: "Phone",
  calendar: "Calendar",
  contacts: "Contacts",
};

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) return null;
  const sp = await searchParams;
  const statuses = await integrationStatuses(userId, true);
  const googleReady = !!env.google();
  // "env"-connect integrations (Deepgram, Groq, Supabase, Bluejay) are
  // platform infrastructure configured once by the deployer, not something
  // any individual tenant connects -- showing their vendor names and
  // "API_KEY is set" badges to every signed-up user leaks backend/vendor
  // details for integrations they have no control over. Only show what a
  // tenant can actually connect themselves (plus the always-on built-in).
  const visibleIntegrations = INTEGRATIONS.filter((i) => i.connect.kind !== "env");

  return (
    <>
      <PageHeader
        eyebrow="Integrations"
        title="What Perrie can reach"
        subtitle="Each integration brings its own tools. Perrie only uses a tool when its integration is connected and the person it's acting for is allowed to use it."
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
          {sp.error ? sp.error : `Connected ${INTEGRATIONS.find((i) => i.id === sp.connected)?.name ?? sp.connected}.`}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
        {visibleIntegrations.map((i) => {
          const st = statuses.get(i.id);
          const Icon = integrationIcon(i.icon);
          return (
            <ClayCard key={i.id} className="flex flex-col">
              <div className="flex items-start gap-4">
                <IconBubble icon={Icon} accent={i.accent} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-slate)]/75">
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
              {!st?.connected && st?.hint && <p className="mt-2 text-xs text-[color:var(--color-slate)]/75">{st.hint}</p>}

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
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--color-slate)]/75">
                      <X className="h-3.5 w-3.5" aria-hidden="true" /> Google sign-in isn&apos;t available yet
                    </p>
                  ))}

                {i.connect.kind === "credentials" &&
                  (st?.connected ? (
                    <form action={disconnectIntegrationAction}>
                      <input type="hidden" name="id" value={i.id} />
                      <SoftButton type="submit">
                        <LogOut className="h-4 w-4" aria-hidden="true" /> Disconnect
                      </SoftButton>
                    </form>
                  ) : (
                    <CredentialsForm integrationId={i.id} fields={i.connect.fields} accent={i.accent} />
                  ))}
              </div>
            </ClayCard>
          );
        })}
      </div>
    </>
  );
}
