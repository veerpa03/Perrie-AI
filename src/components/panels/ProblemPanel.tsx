export default function ProblemPanel() {
  return (
    <div className="max-w-xl px-6 py-8 md:px-4">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[color:var(--color-teal-deep)]">
        The everyday problem
      </p>
      <h2 className="font-heading text-3xl font-bold leading-tight text-[color:var(--color-slate)] sm:text-4xl">
        Your day has enough moving parts.
      </h2>
      <p className="mt-5 max-w-md text-base leading-relaxed text-[color:var(--color-slate)]/80 sm:text-lg">
        Scattered to-dos, half-written messages, tabs you meant to close hours
        ago. Switching between a dozen tools just to get through the basics
        shouldn&apos;t be the job.
      </p>
    </div>
  );
}
