"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { approveStep, configuratorAccount } from "@/lib/configuratorAccount";
import { SAMPLE_TASKS } from "@/lib/sampleTasks";
import {
  cleanTask,
  customSide,
  fromRow,
  SIDES,
  TASK_COMPLETED,
  type PlannedTask,
  type SideInfo,
  type TaskSide,
} from "@/lib/taskPlans";

const STEP_KEY = "plan_your_task_templates";
const PAGE = `/configurator/${STEP_KEY}`;
const UUID = /^[0-9a-f-]{36}$/i;

type Result = { ok: boolean; error?: string; id?: string };

// The sample sheet's date names, as OTC names those dates (the ones with a
// clear match; the rest stay as written).
const SAMPLE_DATE_NAMES: Record<string, string> = {
  "Contract Date": "Acceptance Date",
  "Earnest Money Due Date": "Earnest Money Due - Date",
  "Inspection Contingency Date": "Inspection Period Date",
  "Final Walkthrough Date": "Final Walkthough Date",
};

type Supabase = Awaited<ReturnType<typeof configuratorAccount>>["supabase"];

// The sides a client's tasks can be on: Buyer, Seller, Listing and the task
// lists they added.
async function sidesOf(supabase: Supabase, account: string) {
  const { data } = await supabase
    .from("client_task_sides")
    .select("id")
    .eq("client_account_id", account);
  return [...SIDES.map((s) => s.value), ...(data ?? []).map((r) => r.id)];
}

// Saves one task (adding it the first time).
export async function saveTask(accountId: string | null, task: PlannedTask): Promise<Result> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const row = cleanTask(task, await sidesOf(supabase, account));
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
  if (!account) return { ok: false, error: "Not signed in." };
  const sides = await sidesOf(supabase, account);
  if (!sides.includes(side)) return { ok: false, error: "Unknown side." };
  const { count } = await supabase
    .from("client_task_plans")
    .select("id", { count: "exact", head: true })
    .eq("client_account_id", account)
    .eq("side", side);
  if ((count ?? 0) > 0) return { ok: false, error: "This side already has tasks." };

  const rows = SAMPLE_TASKS.map((t, i) => ({
    ...cleanTask(
      {
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
      dateField: t.dateField === TASK_COMPLETED ? "" : (SAMPLE_DATE_NAMES[t.dateField] ?? t.dateField),
      parentTask: t.dateField === TASK_COMPLETED ? t.parent : "",
      sortOrder: i,
      emails: [],
      documents: [],
      },
      sides,
    )!,
    client_account_id: account,
  }));
  const { data, error } = await supabase.from("client_task_plans").insert(rows).select("*");
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return {
    ok: true,
    tasks: (data ?? []).sort((a, b) => a.sort_order - b.sort_order).map(fromRow),
  };
}

// Adds a task for each email (OTC sends an email only from a task), named
// for the email and sending it, in the side's "Emails" template. When and
// from which date are left for the client to fill in.
export async function addEmailTasks(
  accountId: string | null,
  side: TaskSide,
  emails: { title: string; name: string }[],
): Promise<Result & { tasks?: PlannedTask[] }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const sides = await sidesOf(supabase, account);
  if (!sides.includes(side) || emails.length === 0 || emails.length > 500) {
    return { ok: false, error: "Couldn't add those." };
  }
  const { data: last } = await supabase
    .from("client_task_plans")
    .select("sort_order")
    .eq("client_account_id", account)
    .eq("side", side)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const start = (last?.sort_order ?? 0) + 1;
  const rows = emails.map((e, i) => ({
    ...cleanTask(
      {
        side,
        template: "Emails",
        name: e.name,
        notes: "",
        critical: false,
        recurDays: null,
        dueDays: null,
        timeFrame: null,
        timing: null,
        dateField: "",
        parentTask: "",
        sortOrder: start + i,
        emails: [e.title],
        documents: [],
      },
      sides,
    )!,
    client_account_id: account,
  }));
  const { data, error } = await supabase.from("client_task_plans").insert(rows).select("*");
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true, tasks: (data ?? []).sort((a, b) => a.sort_order - b.sort_order).map(fromRow) };
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
  if (!account || !name) return { ok: false };
  if (!(await sidesOf(supabase, account)).includes(side)) return { ok: false };
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

// Adds a task list beside Buyer, Seller and Listing.
export async function addSide(
  accountId: string | null,
  label: string,
  prefix: string,
): Promise<Result & { side?: SideInfo }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  const trimmed = label.trim().slice(0, 40);
  const name = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  const short = prefix.trim().replace(/\s*-$/, "").slice(0, 6);
  if (!name || !short) return { ok: false, error: "Give it a name and a prefix." };
  const { count } = await supabase
    .from("client_task_sides")
    .select("id", { count: "exact", head: true })
    .eq("client_account_id", account);
  const { data, error } = await supabase
    .from("client_task_sides")
    .insert({ client_account_id: account, label: name, prefix: short, sort_order: count ?? 0 })
    .select("id, label, prefix")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true, side: customSide(data) };
}

// Removes a task list the client added, and its tasks.
export async function removeSide(accountId: string | null, id: string): Promise<Result> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account || !UUID.test(id)) return { ok: false };
  const { error: tasksError } = await supabase
    .from("client_task_plans")
    .delete()
    .eq("client_account_id", account)
    .eq("side", id);
  if (tasksError) return { ok: false, error: tasksError.message };
  const { error } = await supabase
    .from("client_task_sides")
    .delete()
    .eq("client_account_id", account)
    .eq("id", id);
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

// Adds the tasks from a file they uploaded in Upload Your Tasks (each on
// its side, or Buyer when it has none).
export async function importTasks(
  accountId: string | null,
  tasks: PlannedTask[],
): Promise<Result & { tasks?: PlannedTask[] }> {
  const { supabase, accountId: account } = await configuratorAccount(accountId);
  if (!account) return { ok: false, error: "Not signed in." };
  if (tasks.length === 0) return { ok: false, error: "No tasks with a name were found." };
  if (tasks.length > 1000) return { ok: false, error: "That's more than 1,000 tasks; split it up." };
  const sides = await sidesOf(supabase, account);
  const rows = tasks.flatMap((t, i) => {
    const row = cleanTask({ ...t, side: sides.includes(t.side) ? t.side : "buyer", sortOrder: i }, sides);
    return row ? [{ ...row, client_account_id: account }] : [];
  });
  const { data, error } = await supabase.from("client_task_plans").insert(rows).select("*");
  if (error) return { ok: false, error: error.message };
  revalidatePath(PAGE);
  return { ok: true, tasks: (data ?? []).sort((a, b) => a.sort_order - b.sort_order).map(fromRow) };
}
