"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitSetupInitiation(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const tools = formData.getAll("tools").map(String);
  const toolsOther = String(formData.get("tools_other") ?? "").trim();

  if (tools.length === 0 && !toolsOther) {
    redirect(
      `/setup?error=${encodeURIComponent(
        "Select at least one tool you're currently using, or tell us under Other.",
      )}`,
    );
  }

  const { error } = await supabase.from("setup_initiation").upsert(
    {
      client_id: user.id,
      first_name: String(formData.get("first_name") ?? "").trim(),
      last_name: String(formData.get("last_name") ?? "").trim(),
      cell_phone: String(formData.get("cell_phone") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      business_name: String(formData.get("business_name") ?? "").trim(),
      company_structure: String(formData.get("company_structure") ?? ""),
      states_serviced: String(formData.get("states_serviced") ?? "").trim(),
      priority_state: String(formData.get("priority_state") ?? "").trim() || null,
      engagement_type:
        String(formData.get("engagement_type") ?? "custom") === "diy"
          ? "diy"
          : "custom",
      transactions_under_contract:
        Number(formData.get("transactions_under_contract")) || 0,
      transactions_per_month:
        Number(formData.get("transactions_per_month")) || 0,
      tc_count: Number(formData.get("tc_count")) || 0,
      tools_used: tools,
      tools_other: toolsOther || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );

  if (error) {
    redirect(`/setup?error=${encodeURIComponent(error.message)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("client_account_id")
    .eq("id", user.id)
    .single();

  const { data: account } = profile?.client_account_id
    ? await supabase
        .from("client_accounts")
        .select("setup_path")
        .eq("id", profile.client_account_id)
        .single()
    : { data: null };

  const { data: step } = await supabase
    .from("setup_steps")
    .select("id")
    .eq("path", account?.setup_path ?? "custom")
    .eq("key", "setup_initiation")
    .maybeSingle();

  if (step) {
    await supabase.from("client_step_status").upsert(
      {
        client_id: user.id,
        step_id: step.id,
        status: "approved",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,step_id" },
    );
  }

  redirect("/portal");
}
