import Link from "next/link";
import { ArrowLeft, Database, HardDrive } from "lucide-react";
import DashboardNav from "@/components/dashboard/DashboardNav";
import { db } from "@/server/db";

export const metadata = {
  title: "Dashboard — Perrie",
};

// Always render with fresh data (calls and tasks change while you watch).
export const dynamic = "force-dynamic";

function StorageBadge() {
  const kind = db().kind;
  const Icon = kind === "supabase" ? Database : HardDrive;
  return (
    <p
      className="flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-[color:var(--color-slate)]/65"
      style={{ background: "rgba(255,255,255,0.55)" }}
      title={kind === "supabase" ? "Data is stored in Supabase" : "Supabase isn't configured: data is kept in .perrie/ on this machine"}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {kind === "supabase" ? "Supabase connected" : "Local dev storage"}
    </p>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="clay-canvas min-h-screen">
      <div className="mx-auto flex max-w-[1400px] gap-8 px-4 sm:px-6 lg:px-8">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col py-8 lg:flex">
          <Link href="/" className="focus-ring mb-8 inline-block rounded-xl px-3">
            <span className="font-display text-4xl">
              <span className="rainbow-text">Perrie</span>
            </span>
            <span className="mt-1 block text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--color-slate)]/45">
              Your assistant
            </span>
          </Link>
          <DashboardNav orientation="vertical" />
          <div className="mt-auto space-y-2 px-1">
            <StorageBadge />
            <Link
              href="/"
              className="focus-ring flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold text-[color:var(--color-slate)]/60 hover:text-[color:var(--color-slate)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to site
            </Link>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Mobile top bar */}
          <div className="sticky top-0 z-20 -mx-4 mb-2 bg-[#FBF8F3]/85 px-4 pb-2 pt-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:hidden">
            <div className="mb-3 flex items-center justify-between">
              <Link href="/" className="focus-ring rounded-xl font-display text-3xl">
                <span className="rainbow-text">Perrie</span>
              </Link>
              <StorageBadge />
            </div>
            <DashboardNav orientation="horizontal" />
          </div>

          <main id="main" className="py-6 lg:py-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
