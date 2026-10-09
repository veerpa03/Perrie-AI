"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

const fieldStyle: React.CSSProperties = {
  background: "#F5EFE7",
  boxShadow: "inset 4px 4px 9px rgba(38,52,69,0.09), inset -4px -4px 9px rgba(255,255,255,0.95)",
};

/**
 * Placeholder sign-in form. Clay inset fields; nothing is submitted or checked —
 * accounts aren't built yet, so the button simply opens the (local-only) dashboard.
 */
export default function SignInForm() {
  return (
    <form className="mt-6 space-y-4" onSubmit={(e) => e.preventDefault()} aria-label="Demo sign-in form">
      <div>
        <label htmlFor="email" className="block text-sm font-bold text-[color:var(--color-slate)]">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="focus-ring mt-2 w-full rounded-2xl border-0 px-4 py-3 text-sm text-[color:var(--color-slate)] outline-none placeholder:text-[color:var(--color-slate)]/35"
          style={fieldStyle}
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-bold text-[color:var(--color-slate)]">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className="focus-ring mt-2 w-full rounded-2xl border-0 px-4 py-3 text-sm text-[color:var(--color-slate)] outline-none placeholder:text-[color:var(--color-slate)]/35"
          style={fieldStyle}
        />
      </div>
      <Link
        href="/dashboard"
        className="focus-ring group relative mt-2 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full px-5 py-3.5 text-sm font-bold text-white transition hover:-translate-y-0.5 active:translate-y-0"
        style={{
          background: "linear-gradient(100deg, #9277EA 0%, #EC6FA6 55%, #F0A23A 100%)",
          boxShadow:
            "0 16px 30px -14px rgba(236,111,166,0.75), inset -4px -5px 10px rgba(0,0,0,0.14), inset 5px 5px 10px rgba(255,255,255,0.35)",
        }}
      >
        Open my dashboard
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </form>
  );
}
