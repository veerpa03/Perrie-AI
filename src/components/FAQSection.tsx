import { FAQ } from "@/lib/constants";

export default function FAQSection() {
  return (
    <section id="faq" className="mx-auto max-w-3xl px-6 py-16 sm:px-6">
      <h2 className="text-center font-heading text-3xl font-bold text-[color:var(--color-slate)]">
        Frequently asked
      </h2>
      <div className="mt-8 divide-y divide-[color:var(--color-slate)]/10 rounded-2xl border border-[color:var(--color-slate)]/10 bg-white">
        {FAQ.map((item) => (
          <details key={item.q} className="group p-5">
            <summary className="focus-ring cursor-pointer list-none font-heading text-sm font-semibold text-[color:var(--color-slate)] marker:content-none">
              <span className="flex items-center justify-between gap-4">
                {item.q}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-[color:var(--color-teal-deep)] transition group-open:rotate-45"
                >
                  +
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-[color:var(--color-slate)]/75">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
