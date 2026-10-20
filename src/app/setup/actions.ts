"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startPlanCheckout } from "@/app/checkout/actions";

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

  // The plan only changes once Stripe confirms payment (see the webhook),
  // so send them to checkout unless they already have this plan or better.
  const chosen = formData.get("engagement_type") === "diy" ? "diy" : "custom";
  const { data: current } = await supabase
    .from("setup_initiation")
    .select("engagement_type")
    .eq("client_id", user.id)
    .single();
  const currentPlan = current?.engagement_type ?? "free";
  const needsCheckout =
    currentPlan === "free" || (currentPlan === "diy" && chosen === "custom");

  if (needsCheckout) {
    const checkout = new FormData();
    checkout.set("plan", chosen === "custom" ? "setup" : "diy");
    checkout.set("return_to", "/setup");
    await startPlanCheckout(checkout);
  }

  redirect("/home");
}
