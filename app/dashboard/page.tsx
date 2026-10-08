import Image from "next/image";
import Link from "next/link";
import { Info } from "lucide-react";
import { SITE } from "@/lib/constants";
import DemoPlanner from "@/components/DemoPlanner";

export const metadata = {
  title: "Dashboard — Perrie",
};

export default function DashboardPage() {
  return (
    <main className="clay-canvas min-h-screen">
      <header className="border-b border-[color:var(--color-slate)]/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="focus-ring flex items-center gap-2">
            <Image src="/mascot/front.png" alt="" width={32} height={32} className="h-8 w-8" />
            <span className="font-heading text-lg font-bold text-[color:var(--color-slate)]">
              {SITE.name}
            </span>
          </Link>
          <Link
            href="/"
            className="focus-ring rounded-full border border-[color:var(--color-slate)]/15 px-4 py-2 text-sm font-semibold text-[color:var(--color-slate)] hover:bg-[color:var(--color-teal)]/40"
          >
            Back to home
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <div
          role="status"
          className="mb-8 flex items-start gap-2 rounded-xl bg-[color:var(--color-lavender)] px-4 py-3 text-sm leading-relaxed text-[color:var(--color-slate)]/85"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            This dashboard is a frontend demonstration. Task plans shown here
            are example workflows, not real scheduling, messages, or
            research — nothing is executed or sent.
          </span>
        </div>

        <h1 className="font-heading text-2xl font-bold text-[color:var(--color-slate)]">
          Good to see you
        </h1>
        <p className="mt-1 text-sm text-[color:var(--color-slate)]/70">
          Pick an example below to see how Perrie would plan it.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
          <div className="space-y-3">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-[color:var(--color-slate)]/50">
              Recent activity (example data)
            </h2>
            {[
              { title: "Plan your day", status: "Preview", time: "Just now" },
              { title: "Draft a message", status: "Preview", time: "Yesterday" },
              { title: "Organize your tasks", status: "Preview", time: "2 days ago" },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center justify-between rounded-2xl border border-[color:var(--color-slate)]/10 bg-white px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[color:var(--color-slate)]">{item.title}</p>
                  <p className="text-xs text-[color:var(--color-slate)]/50">{item.time}</p>
                </div>
                <span className="rounded-full bg-[color:var(--color-teal)] px-3 py-1 text-xs font-semibold text-[color:var(--color-teal-deep)]">
                  {item.status}
                </span>
              </div>
            ))}
          </div>

          <div>
            <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wide text-[color:var(--color-slate)]/50">
              Try a request
            </h2>
            <DemoPlanner />
          </div>
        </div>
      </div>
    </main>
  );
}
