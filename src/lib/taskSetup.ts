import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { customSide, fromRow, SIDES, type PlannedTask, type SideInfo } from "@/lib/taskPlans";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type SetupTask = PlannedTask & { templateName: string; sideLabel: string };

// An account's tasks, each with its template's full name ("B - General"),
// in side order, then template, then their order.
export async function loadSetupTasks(supabase: Supabase, accountId: string): Promise<SetupTask[]> {
  const [{ data: rows }, { data: added }] = await Promise.all([
    supabase.from("client_task_plans").select("*").eq("client_account_id", accountId).order("sort_order"),
    supabase.from("client_task_sides").select("id, label, prefix").eq("client_account_id", accountId).order("sort_order"),
  ]);
  const sides: SideInfo[] = [...SIDES, ...(added ?? []).map(customSide)];
  const sideIndex = (v: string) => {
    const i = sides.findIndex((s) => s.value === v);
    return i < 0 ? sides.length : i;
  };
  return (rows ?? [])
    .map(fromRow)
    .map((t) => {
      const side = sides.find((s) => s.value === t.side);
      return {
        ...t,
        templateName: `${side?.prefix ?? ""} ${t.template}`.trim(),
        sideLabel: side?.label ?? "",
      };
    })
    .sort(
      (a, b) =>
        sideIndex(a.side) - sideIndex(b.side) ||
        a.template.localeCompare(b.template) ||
        a.sortOrder - b.sortOrder,
    );
}
