"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import DemoPlanner from "./DemoPlanner";

interface DemoModalContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

const Ctx = createContext<DemoModalContextValue | null>(null);

export function DemoModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const titleId = "demo-modal-title";

  const open = useCallback(() => {
    triggerRef.current = (document.activeElement as HTMLElement) ?? null;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Remove the rest of the page from the tab order and the a11y tree while
    // the dialog is open, so focus physically cannot escape behind it.
    const bg = bgRef.current;
    if (bg) {
      bg.inert = true;
      bg.setAttribute("aria-hidden", "true");
    }

    dialogRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const root = overlayRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      const inTrap = active ? focusables.includes(active) : false;
      if (e.shiftKey) {
        if (!inTrap || active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (!inTrap || active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (bg) {
        bg.inert = false;
        bg.removeAttribute("aria-hidden");
      }
      // Restore focus to the trigger if it still exists, else a stable control.
      const t = triggerRef.current;
      if (t && t.isConnected && typeof t.focus === "function") {
        t.focus();
      } else {
        document
          .querySelector<HTMLElement>("[data-demo-return-focus]")
          ?.focus();
      }
    };
  }, [isOpen, close]);

  return (
    <Ctx.Provider value={{ open, close, isOpen }}>
      <div ref={bgRef}>{children}</div>
      {isOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
        >
          <button
            type="button"
            aria-label="Close demo"
            onClick={close}
            className="absolute inset-0 cursor-default bg-[color:var(--color-slate)]/40 backdrop-blur-sm"
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[color:var(--color-cloud)] p-6 shadow-2xl outline-none sm:p-8"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--color-teal-deep)]">
                  Interactive demo
                </p>
                <h2
                  id={titleId}
                  className="mt-1 font-heading text-xl font-bold text-[color:var(--color-slate)]"
                >
                  See how Perrie would plan it
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close demo"
                className="focus-ring -mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-slate)]/15 bg-white text-[color:var(--color-slate)] transition hover:bg-[color:var(--color-teal)]/40"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <DemoPlanner />
            <p className="mt-4 text-center text-xs text-[color:var(--color-slate)]/50">
              Example workflows only — nothing here is scheduled, sent, or stored.
            </p>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useDemoModal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDemoModal must be used within DemoModalProvider");
  return ctx;
}
