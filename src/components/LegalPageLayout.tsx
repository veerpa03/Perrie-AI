import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * Shared shell for the legal pages (Privacy Policy, Terms of Service):
 * same clay-canvas background and card language as the rest of the
 * marketing site, but laid out for long-form reading instead of a hero.
 */
export default function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="clay-canvas min-h-screen px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="focus-ring inline-flex items-center gap-1.5 rounded-full text-sm font-bold text-[color:var(--color-slate)]/70 transition hover:text-[color:var(--color-slate)]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Perrie
        </Link>

        <div
          className="mt-6 rounded-[40px] px-6 py-10 sm:px-12 sm:py-12"
          style={{
            background: "#FFFCF7",
            boxShadow:
              "0 40px 70px -40px rgba(38,52,69,0.5), inset -10px -12px 26px rgba(38,52,69,0.07), inset 10px 10px 24px rgba(255,255,255,0.95)",
          }}
        >
          <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-[color:var(--color-slate)]/75">
            <span className="accent-text">Perrie</span>
          </p>
          <h1 className="mt-2 font-display text-3xl text-[color:var(--color-slate)] sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-[color:var(--color-slate)]/60">Last updated: {lastUpdated}</p>

          <div className="legal-prose mt-8 text-[color:var(--color-slate)]/85">{children}</div>
        </div>
      </div>
    </main>
  );
}
