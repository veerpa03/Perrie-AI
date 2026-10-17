"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";

export async function markMessageReadAction(form: FormData): Promise<void> {
  const { userId } = await auth();
  if (!userId) return;
  const id = String(form.get("id") ?? "");
  const msg = id ? await db().get("messages", id) : null;
  if (!msg || msg.user_id !== userId) return;
  await db().update("messages", id, { read: !msg.read });
  revalidatePath("/dashboard");
}
