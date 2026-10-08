import DemoPlanner from "@/components/DemoPlanner";

const STEPS = [
  { title: "Tell Perrie what you need", body: "Type it like you'd ask a person." },
  { title: "Review the proposed action", body: "See exactly what Perrie plans to do first." },
  { title: "Follow progress", body: "Watch it move, step by step, start to finish." },
];

export default function HowItWorksPanel() {
  return (
    <div className="max-w-2xl px-6 py-8 md:px-4">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-[color:var(--color-teal-deep)]">
        How it works
      </p>
      <h2 className="font-heading text-3xl font-bold leading-tight text-[color:var(--color-slate)] sm:text-4xl">
        Three simple steps
      </h2>
      <ol className="mt-5 space-y-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-lavender)] text-xs font-bold text-[color:var(--color-slate)]">
              {i + 1}
            </span>
            <div>
              <p className="text-sm font-semibold text-[color:var(--color-slate)]">{step.title}</p>
              <p className="text-sm text-[color:var(--color-slate)]/70">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6 max-w-md">
        <DemoPlanner compact />
      </div>
    </div>
  );
}
