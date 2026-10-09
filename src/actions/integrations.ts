"use server";

import { revalidatePath } from "next/cache";
import { disconnectGoogle, isGoogleIntegration } from "@/server/integrations/google/oauth";
import { invalidateProviderStatus } from "@/server/tools/registry";

export async function disconnectIntegrationAction(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  if (isGoogleIntegration(id)) await disconnectGoogle(id);
  invalidateProviderStatus();
  revalidatePath("/dashboard", "layout");
}
