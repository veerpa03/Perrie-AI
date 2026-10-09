"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hashPin } from "@/server/crypto";
import { db, getProfile, listFacts, saveProfile } from "@/server/db";
import { normalizePhone } from "@/server/phone";

export type FormState = { ok: boolean; message: string; errors?: Record<string, string> } | null;

const isValidTz = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const lines = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Your name is required.").max(120),
  preferred_name: z.string().trim().max(60),
  pronouns: z.string().trim().max(40),
  timezone: z.string().refine(isValidTz, "Pick a valid timezone."),
  phone_numbers: z.string().max(400),
  assistant_name: z.string().trim().min(1, "Give your assistant a name.").max(40),
  assistant_voice: z.string().trim().max(60),
  rules: z.string().max(6000),
  pin: z.string().trim(),
  clear_pin: z.string().optional(),
});

export async function saveProfileAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { ok: false, message: "Please fix the highlighted fields.", errors };
  }
  const v = parsed.data;

  const rawPhones = v.phone_numbers.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean);
  const phones: string[] = [];
  for (const p of rawPhones) {
    const n = normalizePhone(p);
    if (!n) {
      return {
        ok: false,
        message: "Please fix the highlighted fields.",
        errors: { phone_numbers: `"${p}" isn't a full international number (e.g. +14155550123).` },
      };
    }
    if (!phones.includes(n)) phones.push(n);
  }
  if (phones.length > 5) return { ok: false, message: "Up to 5 numbers.", errors: { phone_numbers: "Up to 5 numbers." } };

  const rules = lines(v.rules);
  if (rules.length > 25) return { ok: false, message: "Up to 25 rules.", errors: { rules: "Up to 25 rules." } };
  if (rules.some((r) => r.length > 300))
    return { ok: false, message: "Keep each rule under 300 characters.", errors: { rules: "Keep each rule under 300 characters." } };

  let pin_hash: string | null | undefined;
  if (v.clear_pin === "on") pin_hash = null;
  else if (v.pin) {
    if (!/^\d{4,8}$/.test(v.pin))
      return { ok: false, message: "Please fix the highlighted fields.", errors: { pin: "Use 4–8 digits." } };
    pin_hash = hashPin(v.pin);
  }

  await saveProfile({
    full_name: v.full_name,
    preferred_name: v.preferred_name || null,
    pronouns: v.pronouns || null,
    timezone: v.timezone,
    phone_numbers: phones,
    assistant_name: v.assistant_name,
    assistant_voice: v.assistant_voice || null,
    rules,
    ...(pin_hash !== undefined ? { pin_hash } : {}),
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true, message: "Profile saved." };
}

// ---------------------------------------------------------------------------
// Facts
// ---------------------------------------------------------------------------

const factSchema = z.object({
  category: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1, "Add a short label.").max(80),
  value: z.string().trim().min(1, "Add the detail.").max(1000),
  visibility: z.enum(["private", "shareable"]),
});

export async function addFactAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (!(await getProfile())) return { ok: false, message: "Save your profile first." };
  const parsed = factSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[String(issue.path[0])] ??= issue.message;
    return { ok: false, message: "Please fix the highlighted fields.", errors };
  }
  if ((await listFacts()).length >= 100) return { ok: false, message: "Up to 100 facts for now." };
  await db().insert("profile_facts", parsed.data);
  revalidatePath("/dashboard/profile");
  return { ok: true, message: "Added." };
}

export async function toggleFactVisibilityAction(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  const fact = id ? await db().get("profile_facts", id) : null;
  if (!fact) return;
  await db().update("profile_facts", id, { visibility: fact.visibility === "private" ? "shareable" : "private" });
  revalidatePath("/dashboard/profile");
}

export async function deleteFactAction(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  if (id) await db().remove("profile_facts", id);
  revalidatePath("/dashboard/profile");
}
