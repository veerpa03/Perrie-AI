"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { connectCredentialsAction, type ConnectCredentialsState } from "@/actions/integrations";
import { ACCENTS, fieldClass, insetField } from "./ui";
import type { Accent } from "./ui";

type Field = { name: string; label: string; placeholder?: string; secret?: boolean };

/** Manual credential entry for `{kind: "credentials"}` integrations (e.g. bring-your-own Twilio account). */
export default function CredentialsForm({ integrationId, fields, accent }: { integrationId: string; fields: Field[]; accent: Accent }) {
  const [state, action, pending] = useActionState<ConnectCredentialsState, FormData>(connectCredentialsAction, null);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="__integration" value={integrationId} />
      {fields.map((f) => (
        <div key={f.name}>
          <label htmlFor={`cred-${integrationId}-${f.name}`} className="block text-xs font-bold text-[color:var(--color-slate)]/70">
            {f.label}
          </label>
          <input
            id={`cred-${integrationId}-${f.name}`}
            name={f.name}
            type={f.secret ? "password" : "text"}
            autoComplete="off"
            placeholder={f.placeholder}
            required
            className={`${fieldClass} mt-1`}
            style={insetField}
          />
        </div>
      ))}
      {state?.message && <p className="text-xs font-bold text-[#B5403A]">{state.message}</p>}
      <button
        type="submit"
        disabled={pending}
        className="focus-ring inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        style={{
          background: `linear-gradient(135deg, ${ACCENTS[accent].light}, ${ACCENTS[accent].base})`,
          boxShadow: `0 12px 22px -14px ${ACCENTS[accent].base}, inset -3px -4px 8px rgba(0,0,0,0.12), inset 3px 3px 7px rgba(255,255,255,0.45)`,
        }}
      >
        <LogIn className="h-4 w-4" aria-hidden="true" /> {pending ? "Connecting…" : "Connect"}
      </button>
    </form>
  );
}
