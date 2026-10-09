"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { approveTask, cancelTask, taskInputSchema } from "@/server/orchestrator/executor";
import { createTask } from "@/server/orchestrator/planner";

export type TaskFormState = { ok: boolean; message: string } | null;

export async function createTaskAction(_prev: TaskFormState, form: FormData): Promise<TaskFormState> {
  const parsed = taskInputSchema.safeParse({ request: form.get("request") });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." };
  const { task } = await createTask({ request: parsed.data.request, source: "dashboard" });
  revalidatePath("/dashboard", "layout");
  redirect(`/dashboard/tasks/${task.id}`);
}

export async function approveTaskAction(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  await approveTask(id);
  revalidatePath(`/dashboard/tasks/${id}`);
}

export async function cancelTaskAction(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  await cancelTask(id);
  revalidatePath(`/dashboard/tasks/${id}`);
}

export async function replanTaskAction(form: FormData): Promise<void> {
  const id = String(form.get("id") ?? "");
  const task = await db().get("tasks", id);
  if (!task) return;
  const { task: fresh } = await createTask({ request: task.request, source: task.source, originCallId: task.origin_call_id });
  redirect(`/dashboard/tasks/${fresh.id}`);
}
