export default function Footer() {
  return (
    <footer className="clay-canvas px-6 py-10 text-center">
      <p className="mx-auto max-w-md text-xs leading-relaxed text-[color:var(--color-slate)]/55">
        This site is a frontend preview. Sign-in and the task examples shown here
        are not yet connected to a live backend — nothing is scheduled, sent, or
        stored.
      </p>
      <p className="mt-2 text-xs text-[color:var(--color-slate)]/40">
        &copy; {new Date().getFullYear()} Perrie
      </p>
    </footer>
  );
}
