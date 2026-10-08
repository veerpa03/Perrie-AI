"use client";

import Link from "next/link";

export default function SignInForm() {
  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={(e) => e.preventDefault()}
      aria-label="Demo sign-in form"
    >
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-[color:var(--color-slate)]">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="focus-ring mt-1 w-full rounded-xl border border-[color:var(--color-slate)]/15 px-3 py-2 text-sm text-[color:var(--color-slate)] outline-none"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-[color:var(--color-slate)]">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className="focus-ring mt-1 w-full rounded-xl border border-[color:var(--color-slate)]/15 px-3 py-2 text-sm text-[color:var(--color-slate)] outline-none"
        />
      </div>
      <Link
        href="/dashboard"
        className="focus-ring block w-full rounded-full bg-[color:var(--color-teal-deep)] px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:brightness-110"
      >
        Continue to demo dashboard
      </Link>
    </form>
  );
}
