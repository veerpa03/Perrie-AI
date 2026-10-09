"use client";

import { useActionState, useEffect, useRef } from "react";
import { BookHeart, Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";
import {
  addFactAction,
  deleteFactAction,
  toggleFactVisibilityAction,
  type FormState,
} from "@/actions/profile";
import { ClayCard, FieldLabel, fieldClass, insetField, Pill, SoftButton } from "./ui";

export type FactView = { id: string; category: string; label: string; value: string; visibility: "private" | "shareable" };

export const FACT_CATEGORIES = ["About", "Work", "Contact", "Preferences", "Schedule", "People", "Other"] as const;

export default function FactsEditor({ facts, disabled }: { facts: FactView[]; disabled: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addFactAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  const e = state?.errors ?? {};

  return (
    <ClayCard title="What Perrie knows about you" icon={BookHeart} accent="amber">
      <p className="-mt-1 mb-4 text-sm leading-relaxed text-[color:var(--color-slate)]/70">
        Perrie answers questions about you <strong>only</strong> from these facts — if it isn&apos;t here, it says it
        doesn&apos;t know. <Pill tone="mint">Shareable</Pill> facts may be told to other callers;{" "}
        <Pill tone="slate">Private</Pill> ones are only ever used with you.
      </p>

      {facts.length > 0 ? (
        <ul className="mb-5 space-y-2.5">
          {facts.map((f) => (
            <li
              key={f.id}
              className="flex items-start gap-3 rounded-2xl px-4 py-3"
              style={{ background: "rgba(255,255,255,0.75)", boxShadow: "inset 0 0 0 1px rgba(38,52,69,0.06)" }}
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[color:var(--color-slate)]">
                  {f.label}
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--color-slate)]/40">
                    {f.category}
                  </span>
                </p>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[color:var(--color-slate)]/75">{f.value}</p>
              </div>
              <form action={toggleFactVisibilityAction}>
                <input type="hidden" name="id" value={f.id} />
                <button
                  type="submit"
                  className="focus-ring rounded-full"
                  aria-label={`${f.label}: ${f.visibility}. Make ${f.visibility === "private" ? "shareable" : "private"}`}
                  title="Toggle who can hear this"
                >
                  {f.visibility === "shareable" ? (
                    <Pill tone="mint">
                      <Eye className="h-3 w-3" aria-hidden="true" /> Shareable
                    </Pill>
                  ) : (
                    <Pill tone="slate">
                      <EyeOff className="h-3 w-3" aria-hidden="true" /> Private
                    </Pill>
                  )}
                </button>
              </form>
              <form action={deleteFactAction}>
                <input type="hidden" name="id" value={f.id} />
                <button
                  type="submit"
                  className="focus-ring rounded-full p-1 text-[color:var(--color-slate)]/40 transition hover:text-[#B5403A]"
                  aria-label={`Delete ${f.label}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-5 rounded-2xl px-4 py-4 text-sm text-[color:var(--color-slate)]/60" style={insetField}>
          No facts yet. Add things like your role, your assistant-friendly bio, or how people should reach you.
        </p>
      )}

      <form ref={formRef} action={action} className="space-y-3" aria-label="Add a fact">
        <fieldset disabled={disabled || pending} className="grid gap-3 sm:grid-cols-[9rem_1fr]">
          <div>
            <FieldLabel htmlFor="fact-category">Category</FieldLabel>
            <select id="fact-category" name="category" className={fieldClass} style={insetField} defaultValue="About">
              {FACT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel htmlFor="fact-label">Label</FieldLabel>
            <input
              id="fact-label"
              name="label"
              className={fieldClass}
              style={insetField}
              placeholder="Job title"
              aria-invalid={!!e.label}
            />
            {e.label && <p className="mt-1 text-xs font-bold text-[#B5403A]">{e.label}</p>}
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="fact-value">Detail</FieldLabel>
            <textarea
              id="fact-value"
              name="value"
              rows={2}
              className={fieldClass}
              style={insetField}
              placeholder="Product designer at Northwind"
              aria-invalid={!!e.value}
            />
            {e.value && <p className="mt-1 text-xs font-bold text-[#B5403A]">{e.value}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
            <fieldset className="flex items-center gap-4 text-sm font-semibold text-[color:var(--color-slate)]/75">
              <legend className="sr-only">Who can hear this</legend>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="visibility" value="private" defaultChecked className="accent-[#7A8796]" />
                Private
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="visibility" value="shareable" className="accent-[#3FBF9B]" />
                Shareable with callers
              </label>
            </fieldset>
            <SoftButton type="submit" className="ml-auto">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
              Add fact
            </SoftButton>
          </div>
        </fieldset>
        {disabled && (
          <p className="text-xs font-semibold text-[color:var(--color-slate)]/55">Create your profile first to add facts.</p>
        )}
        <p role="status" aria-live="polite" className={`text-xs font-bold ${state?.ok ? "text-[#1C7F62]" : "text-[#B5403A]"}`}>
          {state && !state.ok ? state.message : ""}
        </p>
      </form>
    </ClayCard>
  );
}
