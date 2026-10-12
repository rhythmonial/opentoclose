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
    description,
    logged_date: loggedDate || new Date().toISOString().slice(0, 10),
  });

  revalidatePath(`/dashboard/clients/${accountId}`);
  revalidatePath("/dashboard");
}
