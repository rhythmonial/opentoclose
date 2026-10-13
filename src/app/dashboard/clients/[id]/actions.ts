"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function logHours(formData: FormData) {
  const accountId = String(formData.get("account_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  const hours = Number(formData.get("hours") ?? 0);
  const description = String(formData.get("description") ?? "");
  const loggedDate = String(formData.get("logged_date") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("hours_log").insert({
    client_id: clientId,
    logged_by: user?.id,
    hours,
    description: `Manual: ${description}`,
    logged_date: loggedDate || new Date().toISOString().slice(0, 10),
  });

  revalidatePath(`/dashboard/clients/${accountId}`);
  revalidatePath("/dashboard");
}

export async function logTimedHours({
  accountId,
  clientId,
  startedAt,
  stoppedAt,
}: {
  accountId: string;
  clientId: string;
  startedAt: string;
  stoppedAt: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hours =
    (new Date(stoppedAt).getTime() - new Date(startedAt).getTime()) /
    3600000;

  const { data: completed } = await supabase
    .from("client_step_status")
    .select("step_id, updated_at, setup_steps(title)")
    .eq("client_id", clientId)
    .eq("status", "approved")
    .gte("updated_at", startedAt)
    .lte("updated_at", stoppedAt);

  const items = (completed ?? [])
    .map((c) => c.setup_steps?.title)
    .filter((t): t is string => Boolean(t));

  const description =
    items.length > 0
      ? `Timed: ${items.join(", ")}`
      : "Timed: No checklist items completed during this session";

  await supabase.from("hours_log").insert({
    client_id: clientId,
    logged_by: user?.id,
    hours: Math.round(hours * 100) / 100,
    description,
    logged_date: new Date(stoppedAt).toISOString().slice(0, 10),
  });

  revalidatePath(`/dashboard/clients/${accountId}`);
  revalidatePath("/dashboard");
}
