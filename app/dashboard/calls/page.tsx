import Link from "next/link";
import { Bot, PhoneCall, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import AutoRefresh from "@/components/dashboard/AutoRefresh";
import { CallStatusBadge, RoleBadge } from "@/components/dashboard/badges";
import { ACCENTS, ClayCard, EmptyState, PageHeader } from "@/components/dashboard/ui";
import { fmtDateTime, fmtDuration } from "@/lib/format";
import { getProfile, listCalls } from "@/server/db";
import { prettyPhone } from "@/server/phone";

export const metadata = { title: "Calls — Perrie" };

const FILTERS = [
  { id: "all", label: "All" },
  { id: "inbound", label: "Incoming" },
  { id: "outbound", label: "On your behalf" },
  { id: "web", label: "Playground" },
] as const;

export default async function CallsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type = "all" } = await searchParams;
  const [profile, all] = await Promise.all([getProfile(), listCalls(200)]);
  const tz = profile?.timezone ?? "UTC";
  const calls = type === "all" ? all : all.filter((c) => c.direction === type);

  return (
    <>
      <AutoRefresh active={all.some((c) => c.status === "in-progress")} />
      <PageHeader
        eyebrow="Calls"
        title="Every conversation"
        subtitle="What each call was about, how it ended, and the full transcript — owner calls, callers who left a message, and calls Perrie made for you."
      />

      <nav aria-label="Filter calls" className="mb-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.id === type;
          return (
            <Link
              key={f.id}
              href={f.id === "all" ? "/dashboard/calls" : `/dashboard/calls?type=${f.id}`}
              aria-current={active ? "page" : undefined}
              className="focus-ring rounded-full px-4 py-2 text-sm font-bold transition"
              style={
                active
                  ? { background: ACCENTS.mint.base, color: "#fff", boxShadow: `0 8px 16px -10px ${ACCENTS.mint.base}` }
                  : { background: "rgba(255,255,255,0.7)", color: "#4A5868" }
              }
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      <ClayCard>
        {calls.length ? (
          <ul className="divide-y divide-[color:var(--color-slate)]/[0.07]">
            {calls.map((c) => {
              const Dir = c.direction === "outbound" ? PhoneOutgoing : c.direction === "web" ? Bot : PhoneIncoming;
              const who =
                c.counterpart_name ??
                (c.direction === "outbound"
                  ? prettyPhone(c.to_number)
                  : c.direction === "web"
                    ? "Playground conversation"
                    : prettyPhone(c.from_number));
              return (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/calls/${c.id}`}
                    className="focus-ring -mx-2 flex flex-wrap items-start gap-3 rounded-2xl px-2 py-4 transition hover:bg-white/70 sm:flex-nowrap"
                  >
                    <span
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
                      style={{ background: ACCENTS.mint.soft, color: ACCENTS.mint.ink }}
                      aria-hidden="true"
                    >
                      <Dir className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-bold text-[color:var(--color-slate)]">
                        {who}
                        <RoleBadge role={c.role} />
                        <CallStatusBadge status={c.status} />
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-[color:var(--color-slate)]/65">
                        {c.summary ?? (c.mission ? `Mission: ${c.mission}` : "No summary yet.")}
                      </p>
                    </div>
                    <div className="w-full shrink-0 text-xs font-semibold text-[color:var(--color-slate)]/50 sm:w-36 sm:text-right">
                      {fmtDateTime(c.started_at ?? c.created_at, tz)}
                      <br />
                      {fmtDuration(c.duration_seconds)}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={PhoneCall} accent="mint" title={type === "all" ? "No calls yet" : "Nothing here yet"}>
            Point your Twilio number&apos;s voice webhook at <code className="font-bold">/api/twilio/voice</code> on your
            public URL, or try a conversation in the playground.
          </EmptyState>
        )}
      </ClayCard>
    </>
  );
}
