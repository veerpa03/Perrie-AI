"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import AudioToggle from "./AudioToggle";
import { scrollToId } from "@/lib/scrollTargets";
import { SITE } from "@/lib/constants";
import { useDemoModal } from "./DemoModal";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { open: openDemo } = useDemoModal();

  const links = [
    { label: "Discover", onClick: () => scrollToId("capabilities") },
    { label: "How it works", onClick: () => scrollToId("how-it-works") },
  ];

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[color:var(--color-slate)]/10 bg-[color:var(--color-cloud)]/70 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link href="/" data-demo-return-focus className="focus-ring flex items-center gap-2">
          <Image src="/mascot/front.png" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="font-heading text-lg font-bold tracking-tight text-[color:var(--color-slate)]">
            {SITE.name}
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <button
              key={l.label}
              type="button"
              onClick={l.onClick}
              className="focus-ring rounded-full px-3 py-2 text-sm font-semibold text-[color:var(--color-slate)]/80 transition hover:bg-[color:var(--color-teal)]/50 hover:text-[color:var(--color-slate)]"
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <AudioToggle />
          <Link
            href="/sign-in"
            className="focus-ring rounded-full px-4 py-2 text-sm font-semibold text-[color:var(--color-slate)] transition hover:bg-[color:var(--color-teal)]/50"
          >
            Sign in
          </Link>
          <button
            type="button"
            onClick={openDemo}
            className="focus-ring rounded-full bg-[color:var(--color-teal-deep)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
          >
            Meet Perrie
          </button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <AudioToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--color-slate)]/15 bg-white/70"
          >
            {open ? <X className="h-4 w-4" aria-hidden="true" /> : <Menu className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </nav>

      {open && (
        <div
          id="mobile-menu"
          className="flex flex-col gap-1 border-t border-[color:var(--color-slate)]/10 bg-[color:var(--color-cloud)] px-4 py-3 md:hidden"
        >
          {links.map((l) => (
            <button
              key={l.label}
              type="button"
              onClick={() => {
                l.onClick();
                setOpen(false);
              }}
              className="focus-ring rounded-lg px-3 py-2 text-left text-sm font-semibold text-[color:var(--color-slate)]"
            >
              {l.label}
            </button>
          ))}
          <Link href="/sign-in" className="focus-ring rounded-lg px-3 py-2 text-sm font-semibold text-[color:var(--color-slate)]">
            Sign in
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              openDemo();
            }}
            className="focus-ring mt-1 rounded-full bg-[color:var(--color-teal-deep)] px-4 py-2 text-center text-sm font-semibold text-white"
          >
            Meet Perrie
          </button>
        </div>
      )}
    </header>
  );
}
