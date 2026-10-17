"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { disconnectGoogle, isGoogleIntegration } from "@/server/integrations/google/oauth";
import { invalidateIntegrationStatus } from "@/server/integrations/registry";
import { connectTwilio } from "@/server/integrations/twilio";
import { disconnectTwilio } from "@/server/integrations/twilioCreds";

export async function disconnectIntegrationAction(form: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;
  const id = String(form.get("id") ?? "");
  if (isGoogleIntegration(id)) await disconnectGoogle(userId, id);
  if (id === "twilio") await disconnectTwilio(userId);
  invalidateIntegrationStatus(userId);
  revalidatePath("/dashboard", "layout");
}

export type ConnectCredentialsState = { ok: boolean; message?: string } | null;

/** Generic handler for `{kind: "credentials"}` integrations — currently just Twilio. */
export async function connectCredentialsAction(_prev: ConnectCredentialsState, form: FormData): Promise<ConnectCredentialsState> {
  const { userId } = await auth();
  if (!userId) return { ok: false, message: "Not signed in." };
  const id = String(form.get("__integration") ?? "");
  try {
    if (id === "twilio") {
      await connectTwilio(userId, Object.fromEntries(form));
    } else {
      return { ok: false, message: `Unknown integration "${id}".` };
    }
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
  invalidateIntegrationStatus(userId);
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}
