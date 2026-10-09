import Link from "next/link";
import { Bot, LayoutDashboard, ListChecks, PhoneCall, Wand2 } from "lucide-react";
import AutoRefresh from "@/components/dashboard/AutoRefresh";
import TaskForm from "@/components/dashboard/TaskForm";
import { TaskStatusBadge } from "@/components/dashboard/badges";
import { ClayCard, EmptyState, PageHeader } from "@/components/dashboard/ui";
import { fmtDateTime } from "@/lib/format";
import { getProfile, listSteps, listTasks } from "@/server/db";

export const metadata = { title: "Tasks — Perrie" };

const SOURCE = { dashboard: LayoutDashboard, voice: PhoneCall, playground: Bot } as const;

export default async function TasksPage() {
  const [profile, tasks] = await Promise.all([getProfile(), listTasks(100)]);
  const tz = profile?.timezone ?? "UTC";
  const withSteps = await Promise.all(tasks.map(async (t) => ({ t, steps: await listSteps(t.id) })));
  const live = tasks.some((t) => ["planning", "running", "waiting"].includes(t.status));

  return (
    <>
      <AutoRefresh active={live} />
      <PageHeader
        eyebrow="Tasks"
        title="Tell Perrie what you need"
        subtitle="Each request becomes a short plan of steps using your connected integrations. You approve it, Perrie runs it, and you can watch every step."
      />

      <ClayCard id="new" title="New task" icon={Wand2} accent="amber" className="mb-6">
        <TaskForm />
      </ClayCard>

      <ClayCard title="All tasks" icon={ListChecks} accent="lilac">
        {withSteps.length ? (
          <ul className="space-y-2.5">
            {withSteps.map(({ t, steps }) => {
              const done = steps.filter((s) => s.status === "succeeded").length;
              const Src = SOURCE[t.source] ?? LayoutDashboard;
              return (
                <li key={t.id}>
                  <Link
                    href={`/dashboard/tasks/${t.id}`}
                    className="focus-ring flex flex-wrap items-center gap-3 rounded-2xl px-3 py-3.5 transition hover:bg-white/80 sm:flex-nowrap"
                  >
                    <Src className="h-4 w-4 shrink-0 text-[color:var(--color-slate)]/40" aria-label={`From ${t.source}`} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-[color:var(--color-slate)]">{t.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-sm text-[color:var(--color-slate)]/60">
                        {t.result_summary ?? t.error ?? t.plan_summary ?? t.request}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-[color:var(--color-slate)]/45">
                      {steps.length ? `${done}/${steps.length} steps · ` : ""}
                      {fmtDateTime(t.created_at, tz)}
                    </span>
                    <TaskStatusBadge status={t.status} />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState icon={ListChecks} accent="lilac" title="No tasks yet">
            Type a request above — or ask Perrie on the phone and it&apos;ll appear here too.
          </EmptyState>
        )}
      </ClayCard>
    </>
  );
}
