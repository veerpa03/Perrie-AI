"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, Save, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { saveProfileAction, type FormState } from "@/actions/profile";
import { ClayCard, FieldLabel, fieldClass, insetField, RainbowButton } from "./ui";

export type ProfileFormValues = {
  full_name: string;
  preferred_name: string;
  pronouns: string;
  timezone: string;
  phone_numbers: string[];
  assistant_name: string;
  assistant_voice: string;
  rules: string[];
  hasPin: boolean;
};

const VOICES = [
  { id: "aura-2-thalia-en", label: "Thalia — warm, clear" },
  { id: "aura-2-asteria-en", label: "Asteria — bright, friendly" },
  { id: "aura-2-luna-en", label: "Luna — calm, soft" },
  { id: "aura-2-helena-en", label: "Helena — confident" },
  { id: "aura-2-andromeda-en", label: "Andromeda — easy-going" },
  { id: "aura-2-apollo-en", label: "Apollo — relaxed" },
  { id: "aura-2-arcas-en", label: "Arcas — natural" },
  { id: "aura-2-orion-en", label: "Orion — steady" },
  { id: "aura-2-zeus-en", label: "Zeus — deep" },
];

function Err({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs font-bold text-[#B5403A]">
      {msg}
    </p>
  );
}

export default function ProfileForm({
  initial,
  timezones,
  isNew,
}: {
  initial: ProfileFormValues;
  timezones: string[];
  isNew: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfileAction, null);
  const [tz, setTz] = useState(initial.timezone);
  const e = state?.errors ?? {};

  // New profile: default to the browser's timezone.
  useEffect(() => {
    if (!isNew) return;
    try {
      const local = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (local && timezones.includes(local)) setTz(local);
    } catch {
      /* keep default */
    }
  }, [isNew, timezones]);

  const describe = (field: string) => (e[field] ? `${field}-error` : undefined);

  return (
    <form action={action} className="space-y-6" aria-label="Owner profile">
      <ClayCard title="About you" icon={UserRound} accent="pink">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="full_name">Full name</FieldLabel>
            <input
              id="full_name"
              name="full_name"
              required
              defaultValue={initial.full_name}
              autoComplete="name"
              aria-invalid={!!e.full_name}
              aria-describedby={describe("full_name")}
              className={fieldClass}
              style={insetField}
              placeholder="Alex Morgan"
            />
            <Err id="full_name-error" msg={e.full_name} />
          </div>
          <div>
            <FieldLabel htmlFor="preferred_name" hint="what Perrie calls you">
              Preferred name
            </FieldLabel>
            <input
              id="preferred_name"
              name="preferred_name"
              defaultValue={initial.preferred_name}
              className={fieldClass}
              style={insetField}
              placeholder="Alex"
            />
          </div>
          <div>
            <FieldLabel htmlFor="pronouns">Pronouns</FieldLabel>
            <input
              id="pronouns"
              name="pronouns"
              defaultValue={initial.pronouns}
              className={fieldClass}
              style={insetField}
              placeholder="they/them"
            />
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="timezone" hint="used for every date and booking">
              Timezone
            </FieldLabel>
            <select
              id="timezone"
              name="timezone"
              value={tz}
              onChange={(ev) => setTz(ev.target.value)}
              aria-invalid={!!e.timezone}
              aria-describedby={describe("timezone")}
              className={fieldClass}
              style={insetField}
            >
              {timezones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <Err id="timezone-error" msg={e.timezone} />
          </div>
        </div>
      </ClayCard>

      <ClayCard title="Only you can give orders" icon={ShieldCheck} accent="mint">
        <p className="-mt-1 mb-4 text-sm leading-relaxed text-[color:var(--color-slate)]/70">
          Perrie works for you alone. It only takes instructions when you call from one of your numbers{" "}
          <strong>and</strong> type your PIN on the keypad. Anyone else reaches a polite receptionist that can take a
          message and share only what you mark as shareable.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="phone_numbers" hint="international format, one per line">
              Your phone numbers
            </FieldLabel>
            <textarea
              id="phone_numbers"
              name="phone_numbers"
              rows={2}
              defaultValue={initial.phone_numbers.join("\n")}
              aria-invalid={!!e.phone_numbers}
              aria-describedby={describe("phone_numbers")}
              className={fieldClass}
              style={insetField}
              placeholder="+14155550123"
            />
            <Err id="phone_numbers-error" msg={e.phone_numbers} />
          </div>
          <div>
            <FieldLabel htmlFor="pin" hint={initial.hasPin ? "leave blank to keep" : "4–8 digits"}>
              {initial.hasPin ? "Change PIN" : "Owner PIN"}
            </FieldLabel>
            <div className="relative">
              <input
                id="pin"
                name="pin"
                type="password"
                inputMode="numeric"
                autoComplete="new-password"
                pattern="\d{4,8}"
                aria-invalid={!!e.pin}
                aria-describedby={describe("pin")}
                className={`${fieldClass} pl-10`}
                style={insetField}
                placeholder="••••"
              />
              <KeyRound
                className="pointer-events-none absolute left-3.5 top-[calc(50%+4px)] h-4 w-4 -translate-y-1/2 text-[color:var(--color-slate)]/40"
                aria-hidden="true"
              />
            </div>
            <Err id="pin-error" msg={e.pin} />
          </div>
          <div className="flex items-end">
            {initial.hasPin ? (
              <div className="w-full space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-bold text-[#1C7F62]">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> PIN is set
                </p>
                <label className="flex items-center gap-2 text-xs font-semibold text-[color:var(--color-slate)]/65">
                  <input type="checkbox" name="clear_pin" className="h-4 w-4 accent-[#EC6FA6]" />
                  Remove PIN (your calls will be treated as a guest&apos;s)
                </label>
              </div>
            ) : (
              <p className="text-xs leading-relaxed text-[color:var(--color-slate)]/60">
                Without a PIN, calls from your number are treated like any other caller — caller ID alone can be faked.
              </p>
            )}
          </div>
        </div>
      </ClayCard>

      <ClayCard title="Your assistant" icon={Sparkles} accent="lilac">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="assistant_name">Assistant name</FieldLabel>
            <input
              id="assistant_name"
              name="assistant_name"
              required
              defaultValue={initial.assistant_name}
              aria-invalid={!!e.assistant_name}
              aria-describedby={describe("assistant_name")}
              className={fieldClass}
              style={insetField}
            />
            <Err id="assistant_name-error" msg={e.assistant_name} />
          </div>
          <div>
            <FieldLabel htmlFor="assistant_voice">Voice</FieldLabel>
            <select
              id="assistant_voice"
              name="assistant_voice"
              defaultValue={initial.assistant_voice || VOICES[0].id}
              className={fieldClass}
              style={insetField}
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <FieldLabel htmlFor="rules" hint="one per line — Perrie always follows these">
              Standing rules
            </FieldLabel>
            <textarea
              id="rules"
              name="rules"
              rows={4}
              defaultValue={initial.rules.join("\n")}
              aria-invalid={!!e.rules}
              aria-describedby={describe("rules")}
              className={fieldClass}
              style={insetField}
              placeholder={"Never book meetings before 9am.\nKeep calls with vendors under 5 minutes."}
            />
            <Err id="rules-error" msg={e.rules} />
          </div>
        </div>
      </ClayCard>

      <div className="flex flex-wrap items-center gap-4">
        <RainbowButton type="submit" disabled={pending} className="px-7 py-3 text-base">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          {isNew ? "Create my profile" : "Save profile"}
        </RainbowButton>
        <p
          role="status"
          aria-live="polite"
          className={`text-sm font-bold ${state?.ok ? "text-[#1C7F62]" : "text-[#B5403A]"}`}
        >
          {state?.message}
        </p>
      </div>
    </form>
  );
}
