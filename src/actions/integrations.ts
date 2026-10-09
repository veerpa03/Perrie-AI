"use server";

import { revalidatePath } from "next/cache";
import { disconnectGoogle, isGoogleIntegration } from "@/server/integrations/google/oauth";
import { invalidateIntegrationStatus } from "@/server/integrations/registry";

export async function disconnectIntegrationAction(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  if (isGoogleIntegration(id)) await disconnectGoogle(id);
  invalidateIntegrationStatus();
  revalidatePath("/dashboard", "layout");
}
