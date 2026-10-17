import Link from "next/link";

export const metadata = { title: "Page not found — Perrie" };

export default function NotFound() {
  return (
    <main id="main" className="clay-canvas flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-[#263445]/50">404</p>
      <h1 className="font-display accent-text mt-2 text-4xl sm:text-5xl">Lost in the clouds</h1>
      <p className="mt-4 max-w-sm text-base text-[#263445]/70">
        That page doesn&apos;t exist, or it flew off somewhere. Let&apos;s get you back on the ground.
      </p>
      <Link
        href="/"
        className="focus-ring mt-8 rounded-full px-6 py-3 font-display text-sm font-semibold text-white shadow-lg transition hover:scale-105"
        style={{ background: "linear-gradient(90deg, #9277EA, #EC6FA6, #F0A23A)" }}
      >
        Back home
      </Link>
    </main>
  );
}
