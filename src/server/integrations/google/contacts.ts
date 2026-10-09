import { z } from "zod";
import { db } from "../../db";
import { env } from "../../env";
import { digitsOnly, normalizePhone } from "../../phone";
import type { IntegrationDef, ToolDef } from "../types";
import { GOOGLE_SCOPES, googleFetch } from "./oauth";

const ID = "google_contacts";
const API = "https://people.googleapis.com/v1";
const READ_MASK = "names,phoneNumbers,emailAddresses,organizations";

type Person = {
  names?: { displayName?: string }[];
  phoneNumbers?: { value?: string; canonicalForm?: string; type?: string }[];
  emailAddresses?: { value?: string }[];
  organizations?: { name?: string; title?: string }[];
};

export type ContactView = {
  name: string;
  phones: { number: string; type: string | null }[];
  emails: string[];
  organization: string | null;
};

function view(p: Person): ContactView {
  return {
    name: p.names?.[0]?.displayName ?? "(no name)",
    phones: (p.phoneNumbers ?? [])
      .map((n) => ({ number: n.canonicalForm ?? normalizePhone(n.value ?? "") ?? n.value ?? "", type: n.type ?? null }))
      .filter((n) => n.number),
    emails: (p.emailAddresses ?? []).map((e) => e.value ?? "").filter(Boolean),
    organization: p.organizations?.[0]?.name ?? null,
  };
}

async function search(query: string): Promise<ContactView[]> {
  const url = (q: string) =>
    `${API}/people:searchContacts?${new URLSearchParams({ query: q, readMask: READ_MASK, pageSize: "10" })}`;
  let res = await googleFetch<{ results?: { person: Person }[] }>(ID, url(query));
  if (!res.results?.length) {
    // Google asks clients to send a warm-up request to refresh its cache.
    await googleFetch(ID, url(""));
    res = await googleFetch<{ results?: { person: Person }[] }>(ID, url(query));
  }
  return (res.results ?? []).map((r) => view(r.person));
}

/** Caller-ID lookup: who is this number in the owner's contacts? (null if unknown / not connected) */
export async function lookupContactByPhone(phone: string): Promise<ContactView | null> {
  try {
    const rec = await db().get("integrations", ID);
    if (rec?.status !== "connected") return null;
    const target = digitsOnly(phone).slice(-10);
    const hits = await search(phone);
    return hits.find((c) => c.phones.some((p) => digitsOnly(p.number).endsWith(target))) ?? null;
  } catch {
    return null;
  }
}

const contactsSearch: ToolDef = {
  name: "contacts_search",
  integration: ID,
  description:
    "Search the owner's Google Contacts by name, company, e-mail or number. Returns names, phone numbers (E.164) and e-mails. Never guess a number — look it up.",
  input: z.object({ query: z.string().min(1).max(100) }),
  roles: ["owner", "system"],
  sideEffect: false,
  async run(input: { query: string }) {
    const contacts = await search(input.query);
    return { count: contacts.length, contacts };
  },
};

export const googleContacts: IntegrationDef = {
  id: ID,
  name: "Google Contacts",
  category: "contacts",
  description: "Look up people's numbers and recognise who is calling.",
  accent: "mint",
  icon: "contacts",
  connect: { kind: "oauth", provider: "google", scopes: GOOGLE_SCOPES.google_contacts },
  async status() {
    if (!env.google()) return { connected: false, hint: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." };
    const rec = await db().get("integrations", ID);
    if (rec?.status === "error") return { connected: false, label: rec.account_label, error: "Reconnect needed." };
    return rec?.status === "connected"
      ? { connected: true, label: rec.account_label }
      : { connected: false, hint: "Connect your Google account." };
  },
  tools: [contactsSearch],
};
