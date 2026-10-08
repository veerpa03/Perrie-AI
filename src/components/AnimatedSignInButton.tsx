"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LogIn } from "lucide-react";

const MotionLink = motion.create(Link);

/**
 * The landing page's only chrome: one compact Sign-in control, upper-right.
 * Clay silhouette (pastel fill + double inner shadow) with a liquid-glass
 * highlight, a gentle hover lift and a small press response (Framer Motion),
 * and a visible keyboard focus state. No constant bouncing. Routes to the
 * existing frontend sign-in preview (/sign-in).
 */
export default function AnimatedSignInButton() {
  return (
    <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6">
      <MotionLink
        href="/sign-in"
        aria-label="Sign in"
        className="focus-ring relative inline-flex items-center gap-2 overflow-hidden rounded-full px-5 py-2.5 text-sm font-semibold text-[color:var(--color-slate)]"
        style={{
          fontFamily: "var(--font-body)",
          background: "var(--color-cream)",
          boxShadow:
            "8px 10px 22px -10px rgba(38,52,69,0.28), inset -4px -4px 10px rgba(38,52,69,0.14), inset 5px 5px 12px rgba(255,255,255,0.75)",
        }}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        whileHover={{ y: -3 }}
        whileTap={{ scale: 0.96 }}
      >
        {/* Liquid-glass highlight across the top of the clay pill. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
          style={{
            background: "linear-gradient(to bottom, rgba(255,255,255,0.65), rgba(255,255,255,0))",
          }}
        />
        <LogIn className="relative h-4 w-4" aria-hidden="true" />
        <span className="relative">Sign in</span>
      </MotionLink>
    </div>
  );
}
