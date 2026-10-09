"use client";

import Link from "next/link";
import { ArrowUp, Sparkles } from "lucide-react";
import ClayShapes from "./ClayShapes";
import { useDemoModal } from "./DemoModal";
import { scrollToId } from "@/lib/scrollTargets";

const linkClass =
  "focus-ring rounded-full text-left text-sm font-semibold text-[color:var(--color-slate)]/75 transition hover:text-[color:var(--color-slate)]";

/**
 * Site footer: a rounded clay slab in a soft rainbow pastel gradient with the
 * Perrie name (text only — no mascot icon), a few honest links to things that
 * exist (features, the demo, the dashboard preview, sign-in), the frontend
 * preview note, and a back-to-top button.
 */
export default function Footer() {
  const { open: openDemo } = useDemoModal();

  return (
    <footer className="clay-canvas px-3 pb-3 pt-10 sm:px-5 sm:pb-5">
      <div
        className="relative overflow-hidden rounded-[44px] px-7 pb-8 pt-12 sm:px-12"
        style={{
          background:
            "linear-gradient(135deg, #EDE6FF 0%, #FFE6F1 34%, #FFF1DC 64%, #DDF7EE 100%)",
          boxShadow:
            "0 30px 60px -36px rgba(38,52,69,0.45), inset 10px 12px 26px rgba(255,255,255,0.85), inset -10px -12px 26px rgba(38,52,69,0.07)",
        }}
      >
        {/* Rainbow clay strip */}
        <div
          aria-hidden="true"
          className="absolute inset-x-10 top-0 h-2 rounded-b-full"
          style={{ background: "linear-gradient(90deg, #9277EA, #EC6FA6, #F0A23A, #3FBF9B, #5BA7DE)" }}
        />
        <ClayShapes preset="footer" />

        <div className="relative z-10 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1.3fr]">
          <div>
            <p className="font-display text-5xl text-[color:var(--color-slate)]">
              Perrie<span className="rainbow-text">.</span>
            </p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-[color:var(--color-slate)]/70">
              Your personal AI assistant. A little help, all around you.
            </p>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="focus-ring mt-6 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-[color:var(--color-slate)] transition hover:-translate-y-0.5 active:translate-y-0"
              style={{
                background: "#FFFDF9",
                boxShadow:
                  "8px 10px 20px -12px rgba(38,52,69,0.35), inset 4px 4px 9px rgba(255,255,255,0.95), inset -4px -5px 10px rgba(38,52,69,0.08)",
              }}
            >
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
              Back to top
            </button>
          </div>

          <nav aria-label="Explore">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--color-slate)]/45">Explore</p>
            <ul className="mt-4 space-y-3">
              <li>
                <button type="button" className={linkClass} onClick={() => scrollToId("features")}>
                  Features
                </button>
              </li>
              <li>
                <button type="button" className={linkClass} onClick={openDemo}>
                  Try the demo
                </button>
              </li>
              <li>
                <Link href="/dashboard" className={linkClass}>
                  Dashboard preview
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Account">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--color-slate)]/45">Account</p>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/sign-in" className={linkClass}>
                  Sign in
                </Link>
              </li>
            </ul>
          </nav>

          <div
            className="self-start rounded-[28px] p-5"
            style={{
              background: "rgba(255,255,255,0.55)",
              boxShadow: "inset 3px 3px 8px rgba(255,255,255,0.9), inset -3px -4px 10px rgba(38,52,69,0.06)",
            }}
          >
            <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--color-slate)]">
              <Sparkles className="h-4 w-4 text-[#EC6FA6]" aria-hidden="true" />
              Frontend preview
            </p>
            <p className="mt-2 text-xs leading-relaxed text-[color:var(--color-slate)]/65">
              Sign-in and the task examples here aren&apos;t connected to a live backend yet — nothing is
              scheduled, sent, or stored.
            </p>
          </div>
        </div>

        <div className="relative z-10 mt-10 flex flex-col items-start justify-between gap-2 border-t border-[color:var(--color-slate)]/10 pt-6 text-xs text-[color:var(--color-slate)]/50 sm:flex-row sm:items-center">
          <p>&copy; {new Date().getFullYear()} Perrie</p>
          <p>Made with a little help.</p>
        </div>
      </div>
    </footer>
  );
}
