import Image from "next/image";
import Link from "next/link";
import { Info } from "lucide-react";
import { SITE } from "@/lib/constants";
import SignInForm from "@/components/SignInForm";

export const metadata = {
  title: "Sign in — Perrie",
};

export default function SignInPage() {
  return (
    <main className="clay-canvas flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <Image src="/mascot/front.png" alt="" width={40} height={40} className="h-10 w-10" />
          <span className="font-heading text-xl font-bold text-[color:var(--color-slate)]">
            {SITE.name}
          </span>
        </div>

        <div className="rounded-3xl border border-[color:var(--color-slate)]/10 bg-white p-8 shadow-sm">
          <h1 className="font-heading text-xl font-bold text-[color:var(--color-slate)]">
            Sign in
          </h1>

          <div
            role="status"
            className="mt-3 flex items-start gap-2 rounded-xl bg-[color:var(--color-lavender)] px-3 py-2 text-xs leading-relaxed text-[color:var(--color-slate)]/80"
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Frontend preview only. Authentication isn&apos;t connected yet — this
              form doesn&apos;t create or check any account.
            </span>
          </div>

          <SignInForm />
        </div>

        <p className="mt-6 text-center text-sm text-[color:var(--color-slate)]/60">
          <Link href="/" className="focus-ring font-semibold text-[color:var(--color-teal-deep)]">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
