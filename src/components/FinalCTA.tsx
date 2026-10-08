"use client";

import { motion } from "framer-motion";
import { useDemoModal } from "./DemoModal";

/**
 * Minimal closing call to action the carousel releases into. Anton display
 * headline, clay + liquid-glass primary action (opens the clearly-labelled
 * frontend demo), and a quiet sign-in link. Pastel clay surface.
 */
export default function FinalCTA() {
  const { open } = useDemoModal();
  return (
    <section
      className="relative overflow-hidden px-6 py-24"
      style={{ background: "var(--color-powder)" }}
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="font-display text-5xl text-[color:var(--color-slate)] sm:text-6xl"
        >
          A little help goes a long way.
        </motion.h2>
        <p className="mt-4 max-w-md text-[color:var(--color-slate)]/75">
          Start with a request, review the next step, and keep your day moving.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
          <motion.button
            type="button"
            onClick={open}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.96 }}
            className="focus-ring relative overflow-hidden rounded-full px-8 py-3.5 text-sm font-semibold text-white sm:text-base"
            style={{
              fontFamily: "var(--font-body)",
              background: "var(--color-teal-deep)",
              boxShadow:
                "8px 12px 26px -10px rgba(34,109,104,0.55), inset -4px -4px 10px rgba(0,0,0,0.14), inset 5px 5px 12px rgba(255,255,255,0.28)",
            }}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
              style={{
                background: "linear-gradient(to bottom, rgba(255,255,255,0.4), rgba(255,255,255,0))",
              }}
            />
            <span className="relative">See an example</span>
          </motion.button>
          <a
            href="/sign-in"
            className="focus-ring rounded-full px-7 py-3.5 text-sm font-semibold text-[color:var(--color-slate)] transition-transform hover:-translate-y-0.5 active:translate-y-0 sm:text-base"
            style={{
              fontFamily: "var(--font-body)",
              background: "var(--color-cream)",
              boxShadow:
                "8px 10px 22px -10px rgba(38,52,69,0.26), inset -4px -4px 10px rgba(38,52,69,0.12), inset 5px 5px 12px rgba(255,255,255,0.7)",
            }}
          >
            Sign in
          </a>
        </div>
      </div>
    </section>
  );
}
