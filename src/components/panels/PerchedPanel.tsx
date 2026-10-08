export default function PerchedPanel() {
  return (
    <div className="max-w-xl px-6 py-8 md:px-4">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[color:var(--color-teal-deep)]">
        The payoff
      </p>
      <h2 className="font-heading text-3xl font-bold leading-tight text-[color:var(--color-slate)] sm:text-4xl">
        A little help. A lighter day.
      </h2>
      <p className="mt-5 max-w-md text-base leading-relaxed text-[color:var(--color-slate)]/80 sm:text-lg">
        Less time managing tasks, more time for the things that actually need
        you.
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <a
          href="/dashboard"
          className="focus-ring rounded-full bg-[color:var(--color-teal-deep)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 sm:text-base"
        >
          Try the demo dashboard
        </a>
        <a
          href="/sign-in"
          className="focus-ring rounded-full border border-[color:var(--color-slate)]/15 bg-white/70 px-6 py-3 text-sm font-semibold text-[color:var(--color-slate)] transition hover:bg-white sm:text-base"
        >
          Sign in
        </a>
      </div>
    </div>
  );
}
