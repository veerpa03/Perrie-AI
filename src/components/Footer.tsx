import Image from "next/image";
import { SITE } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="border-t border-[color:var(--color-slate)]/10 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Image src="/mascot/front.png" alt="" width={28} height={28} className="h-7 w-7" />
          <span className="font-heading text-base font-bold text-[color:var(--color-slate)]">
            {SITE.name}
          </span>
        </div>
        <p className="max-w-md text-sm text-[color:var(--color-slate)]/60">
          This site is a frontend preview. Sign-in, the dashboard, and task
          execution shown here are not yet connected to a live backend.
        </p>
        <p className="text-xs text-[color:var(--color-slate)]/40">
          &copy; {new Date().getFullYear()} {SITE.name}
        </p>
      </div>
    </footer>
  );
}
