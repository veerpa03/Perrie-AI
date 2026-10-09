import Link from "next/link";
import { ArrowLeft, Info } from "lucide-react";
import SignInForm from "@/components/SignInForm";
import ClayShapes from "@/components/ClayShapes";
import ClayIcon from "@/components/ClayIcons";

export const metadata = {
  title: "Sign in — Perrie",
};

const CLUSTER = [
  { name: "calendar", cls: "left-[4%] top-[6%] h-24 w-24 rotate-[-10deg] sm:h-28 sm:w-28" },
  { name: "envelope", cls: "right-[2%] top-[0%] h-20 w-20 rotate-[12deg] sm:h-24 sm:w-24" },
  { name: "search", cls: "left-[18%] bottom-[0%] h-20 w-20 rotate-[8deg] sm:h-24 sm:w-24" },
  { name: "notebook", cls: "right-[12%] bottom-[6%] h-24 w-24 rotate-[-8deg] sm:h-28 sm:w-28" },
] as const;

export default function SignInPage() {
  return (
    <main
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden px-4 py-12"
      style={{
        background:
          "radial-gradient(60% 55% at 10% 12%, #E6DCFF 0%, transparent 70%), radial-gradient(55% 50% at 92% 14%, #FFE0EE 0%, transparent 70%), radial-gradient(60% 55% at 88% 92%, #FFEBCF 0%, transparent 70%), radial-gradient(60% 55% at 8% 90%, #D6F4E9 0%, transparent 70%), #FBF8F3",
      }}
    >
      <ClayShapes preset="login" />

      <div className="relative z-10 grid w-full max-w-5xl items-center gap-10 md:grid-cols-2">
        {/* Brand side — name only, no mascot icon. */}
        <div className="text-center md:text-left">
          <p className="font-display text-6xl leading-none text-[color:var(--color-slate)] sm:text-7xl">
            <span className="rainbow-text">Perrie</span>
          </p>
          <p className="mx-auto mt-4 max-w-sm text-base leading-relaxed text-[color:var(--color-slate)]/70 md:mx-0">
            Your personal AI assistant — a little help, all around you.
          </p>
          <div aria-hidden="true" className="relative mx-auto mt-8 hidden h-56 max-w-sm md:mx-0 md:block">
            {CLUSTER.map((c) => (
              <div key={c.name} className={`clay-drift absolute ${c.cls}`}>
                <ClayIcon name={c.name} className="h-full w-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Clay card */}
        <div
          className="mx-auto w-full max-w-md rounded-[40px] px-7 py-9 sm:px-10"
          style={{
            background: "#FFFCF7",
            boxShadow:
              "0 40px 70px -40px rgba(38,52,69,0.5), inset -10px -12px 26px rgba(38,52,69,0.07), inset 10px 10px 24px rgba(255,255,255,0.95)",
          }}
        >
          <h1 className="font-display text-4xl text-[color:var(--color-slate)]">Welcome back</h1>
          <p className="mt-1 text-sm text-[color:var(--color-slate)]/60">Sign in to keep your day moving.</p>

          <div
            role="note"
            className="mt-5 flex items-start gap-2 rounded-2xl px-4 py-3 text-xs leading-relaxed text-[color:var(--color-slate)]/75"
            style={{
              background: "linear-gradient(135deg, #EDE6FF, #FFE6F1)",
              boxShadow: "inset 2px 2px 6px rgba(255,255,255,0.85), inset -2px -3px 7px rgba(38,52,69,0.06)",
            }}
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9277EA]" aria-hidden="true" />
            <span>
              No accounts yet: this form doesn&apos;t create or check anything. Your dashboard runs on your own
              machine and only opens locally (or with your dashboard password).
            </span>
          </div>

          <SignInForm />

          <p className="mt-6 text-center text-sm">
            <Link
              href="/"
              className="focus-ring inline-flex items-center gap-1.5 rounded-full font-bold text-[color:var(--color-slate)]/70 transition hover:text-[color:var(--color-slate)]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
