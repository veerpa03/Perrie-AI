"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import ClayIcon from "./ClayIcons";
import type { OrbitFeature } from "@/lib/constants";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface Props {
  feature: OrbitFeature | null;
  onClose: () => void;
  onTryDemo: (feature: OrbitFeature) => void;
}

/**
 * Pop-up clay card with a short gist of one feature, opened by clicking its
 * clay object in the carousel. Accessible modal dialog: focus moves into the
 * card, Tab is trapped, Escape / backdrop / close button dismiss it, and the
 * page behind is scroll-locked. Content is an illustrative example workflow.
 */
export default function FeaturePopup({ feature, onClose, onTryDemo }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!feature) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const card = cardRef.current;
    // Focus the card itself first so screen readers announce the dialog.
    requestAnimationFrame(() => card?.focus());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !card) return;
      const items = Array.from(
        card.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inside = active ? items.includes(active) : false;
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [feature, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {feature && (
        <motion.div
          key={feature.id}
          className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            tabIndex={-1}
            className="absolute inset-0 cursor-default bg-[color:var(--color-slate)]/30 backdrop-blur-[6px]"
          />

          <motion.div
            ref={cardRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`feature-title-${feature.id}`}
            aria-describedby={`feature-gist-${feature.id}`}
            tabIndex={-1}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 24 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="relative z-10 w-full max-w-md rounded-[36px] px-7 pb-7 pt-20 outline-none sm:px-9"
            style={{
              background: "#FFFCF7",
              boxShadow:
                "0 30px 60px -24px rgba(38,52,69,0.45), inset -8px -10px 22px rgba(38,52,69,0.08), inset 8px 8px 20px rgba(255,255,255,0.9)",
            }}
          >
            {/* Coloured clay halo + the 3D object popping out of the card. */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-0 grid h-36 w-36 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
              style={{
                background: `radial-gradient(circle at 35% 30%, #ffffff 0%, ${feature.glow} 45%, ${feature.color}55 100%)`,
                boxShadow: `0 18px 34px -14px ${feature.color}99, inset 6px 6px 14px rgba(255,255,255,0.8), inset -6px -8px 16px ${feature.color}33`,
              }}
            >
              <ClayIcon name={feature.icon} className="h-28 w-28" />
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close feature card"
              className="focus-ring absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full text-[color:var(--color-slate)] transition hover:-translate-y-0.5"
              style={{
                background: "#F4EEE6",
                boxShadow: "4px 6px 12px -6px rgba(38,52,69,0.3), inset 3px 3px 6px rgba(255,255,255,0.9), inset -3px -3px 6px rgba(38,52,69,0.08)",
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <p
              className="text-center text-xs font-bold uppercase tracking-[0.2em]"
              style={{ color: feature.color }}
            >
              Example workflow
            </p>
            <h3
              id={`feature-title-${feature.id}`}
              className="font-display mt-2 text-center text-3xl text-[color:var(--color-slate)]"
            >
              {feature.label.replace(/\.$/, "")}
            </h3>
            <p
              id={`feature-gist-${feature.id}`}
              className="mt-3 text-center text-[0.95rem] leading-relaxed text-[color:var(--color-slate)]/80"
            >
              {feature.gist}
            </p>

            <p className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--color-slate)]/50">
              For example
            </p>
            <ul className="mt-2 space-y-2">
              {feature.examples.map((ex) => (
                <li
                  key={ex}
                  className="flex items-start gap-3 rounded-2xl px-4 py-2.5 text-sm text-[color:var(--color-slate)]/85"
                  style={{
                    background: feature.glow,
                    boxShadow: "inset 2px 2px 5px rgba(255,255,255,0.8), inset -2px -3px 6px rgba(38,52,69,0.06)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: feature.color }}
                  />
                  <span>&ldquo;{ex}&rdquo;</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => onTryDemo(feature)}
                className="focus-ring relative flex-1 overflow-hidden rounded-full px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: feature.color,
                  boxShadow: `0 14px 26px -12px ${feature.color}, inset -4px -5px 10px rgba(0,0,0,0.15), inset 5px 5px 10px rgba(255,255,255,0.35)`,
                }}
              >
                <span className="relative inline-flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  See it in the demo
                </span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="focus-ring rounded-full px-6 py-3 text-sm font-bold text-[color:var(--color-slate)] transition hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: "#F4EEE6",
                  boxShadow: "6px 8px 16px -10px rgba(38,52,69,0.35), inset 3px 3px 7px rgba(255,255,255,0.9), inset -3px -4px 8px rgba(38,52,69,0.08)",
                }}
              >
                Close
              </button>
            </div>

            <p className="mt-5 text-center text-[0.7rem] text-[color:var(--color-slate)]/50">
              Frontend preview — nothing is scheduled, sent, or stored.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
