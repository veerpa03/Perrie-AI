const cardShadow =
  "0 26px 50px -34px rgba(38,52,69,0.5), inset -6px -8px 18px rgba(38,52,69,0.06), inset 6px 6px 16px rgba(255,255,255,0.92)";

function Bar({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-full bg-[color:var(--color-slate)]/10 ${className}`} />;
}

/**
 * Loading skeleton shown while a dashboard route's server data is fetching
 * (every dashboard page is `force-dynamic`). Keeps navigation feeling instant
 * instead of a blank frozen page until the server responds.
 */
export default function DashboardSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Bar className="h-3 w-24" />
      <Bar className="mt-3 h-9 w-72 max-w-full" />
      <Bar className="mt-3 h-4 w-96 max-w-full" />

      <div className="mt-8 grid gap-6">
        {Array.from({ length: cards }).map((_, i) => (
          <section key={i} className="rounded-[28px] p-5 sm:p-6" style={{ background: "#FFFCF7", boxShadow: cardShadow }}>
            <Bar className="h-5 w-40" />
            <Bar className="mt-4 h-4 w-full" />
            <Bar className="mt-2.5 h-4 w-5/6" />
            <Bar className="mt-2.5 h-4 w-2/3" />
          </section>
        ))}
      </div>
    </div>
  );
}
