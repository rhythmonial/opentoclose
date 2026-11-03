"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import { SAMPLE_TASKS } from "@/lib/sampleTasks";
import {
  cleanTask,
  SIDES,
  TASK_COMPLETED,
  type PlannedTask,
  type TaskSide,
} from "@/lib/taskPlans";

const STEP_KEY = "plan_your_task_templates";
const PAGE = `/configurator/${STEP_KEY}`;
const UUID = /^[0-9a-f-]{36}$/i;

type Result = { ok: boolean; error?: string; id?: string };

const isSide = (s: unknown): s is TaskSide => SIDES.some((x) => x.value === s);

// Saves one task (adding it the first time).
export async function saveTask(accountId: string | null, task: PlannedTask): Promise<Result> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const row = cleanTask(task);
  if (!row) return { ok: false, error: "Unknown side." };

  if (task.id) {
    if (!UUID.test(task.id)) return { ok: false, error: "Unknown task." };
    const { error } = await supabase
      .from("client_task_plans")
      .update({ ...row, updated_at: new Date().toISOString() })
      .eq("id", task.id)
      .eq("client_account_id", account);
    if (error) return { ok: false, error: error.message };
    revalidatePath(PAGE);
    return { ok: true, id: task.id };
  }
  const { data, error } = await supabase
    .from("client_task_plans")
    .insert({ ...row, client_account_id: account })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true, id: data.id };
}

export async function deleteTask(accountId: string | null, id: string): Promise<Result> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account || !UUID.test(id)) return { ok: false };
  const { error } = await supabase
    .from("client_task_plans")
    .delete()
    .eq("id", id)
    .eq("client_account_id", account);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

// Starts a side from the sample tasks (only when it has none yet).
export async function addSampleTasks(
  accountId: string | null,
  side: TaskSide,
): Promise<Result & { tasks?: PlannedTask[] }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account || !isSide(side)) return { ok: false, error: "Not signed in." };
  const { count } = await supabase
    .from("client_task_plans")
    .select("id", { count: "exact", head: true })
    .eq("client_account_id", account)
    .eq("side", side);
  if ((count ?? 0) > 0) return { ok: false, error: "This side already has tasks." };

  const rows = SAMPLE_TASKS.map((t, i) => ({
    ...cleanTask({
      side,
      template: t.template,
      name: t.name,
      notes: t.notes,
      critical: t.critical,
      recurDays: null,
      dueDays: t.days,
      timeFrame: null,
      timing: t.timing,
      // "Task Completed" means due from the parent task; otherwise the date
      // field stands (a few samples name an email there, not a task).
      dateField: t.dateField === TASK_COMPLETED ? "" : t.dateField,
      parentTask: t.dateField === TASK_COMPLETED ? t.parent : "",
      sortOrder: i,
    })!,
    client_account_id: account,
  }));
  const { data, error } = await supabase.from("client_task_plans").insert(rows).select("*");
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return {
    ok: true,
    tasks: (data ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((r) => ({
        id: r.id,
        side: r.side as TaskSide,
        template: r.template,
        name: r.name,
        notes: r.notes,
        critical: r.critical,
        recurDays: r.recur_days,
        dueDays: r.due_days,
        timeFrame: r.time_frame as PlannedTask["timeFrame"],
        timing: r.timing as PlannedTask["timing"],
        dateField: r.date_field,
        parentTask: r.parent_task,
        sortOrder: r.sort_order,
      })),
  };
}

// Renames one of a side's templates (every task in it).
export async function renameTemplate(
  accountId: string | null,
  side: TaskSide,
  from: string,
  to: string,
): Promise<Result> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  const name = to.trim().slice(0, 80);
  if (!account || !isSide(side) || !name) return { ok: false };
  const { error } = await supabase
    .from("client_task_plans")
    .update({ template: name, updated_at: new Date().toISOString() })
    .eq("client_account_id", account)
    .eq("side", side)
    .eq("template", from);
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true };
}

export async function finishTaskPlans() {
  const { supabase, user, accountId } = await configuratorAccount(null);
  if (!user) redirect("/login");
  if (!accountId) redirect("/portal");
  const { count } = await supabase
    .from("client_task_plans")
    .select("id", { count: "exact", head: true })
    .eq("client_account_id", accountId);
  if (!count) redirect(PAGE);
  await approveStep(supabase, user.id, accountId, STEP_KEY);
  redirect("/portal");
}
