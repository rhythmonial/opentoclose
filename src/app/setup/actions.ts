"use server";

import { redirect } from "next/navigation";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { startPlanCheckout } from "@/app/checkout/actions";
import { getSandboxTier } from "@/lib/devSandbox";

export async function submitSetupInitiation(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: actor } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  // Staff use the form in test mode: nothing is saved and there's no
  // checkout. In a sandbox, the step is ticked off in that sandbox.
  if (actor?.role === "dev" || actor?.role === "dev_admin") {
    const tier = await getSandboxTier();
    if (tier) {
      const { data: step } = await supabase
        .from("setup_steps")
        .select("id")
        .eq("key", "setup_initiation")
        .limit(1)
        .maybeSingle();
      if (step) {
        await supabase.from("dev_sandbox_step_status").upsert(
          {
            tier,
            step_id: step.id,
            status: "approved",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "tier,step_id" },
        );
      }
    }
    const tested = formData.get("engagement_type") === "diy" ? "diy" : "setup";
    redirect(`/setup?tested=${tested}`);
  }

  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const owner = {
    first: text("first_name"),
    last: text("last_name"),
    cell: formatPhone(text("cell_phone")),
    email: text("email"),
  };
  const guruSameAsOwner = formData.get("guru_same_as_owner") === "on";
  const esignPlatform = text("esign_platform");
  const chosen = formData.get("engagement_type") === "diy" ? "diy" : "custom";

  const { error } = await supabase.from("setup_initiation").upsert(
    {
      client_id: user.id,
      first_name: owner.first,
      last_name: owner.last,
      cell_phone: owner.cell,
      email: owner.email,
      guru_same_as_owner: guruSameAsOwner,
      guru_first_name: guruSameAsOwner ? owner.first : text("guru_first_name"),
      guru_last_name: guruSameAsOwner ? owner.last : text("guru_last_name"),
      guru_cell: guruSameAsOwner ? owner.cell : formatPhone(text("guru_cell")),
      guru_email: guruSameAsOwner ? owner.email : text("guru_email"),
      esign_platform: esignPlatform || null,
      esign_other: esignPlatform === "Other" ? text("esign_other") || null : null,
      tms: text("tms") || null,
      email_provider: text("email_provider") || null,
      ...(chosen === "custom" ? { otc_username: text("otc_username") || null } : {}),
      business_name: String(formData.get("business_name") ?? "").trim(),
      company_structure: String(formData.get("company_structure") ?? ""),
      states_serviced: String(formData.get("states_serviced") ?? "").trim(),
      priority_state: String(formData.get("priority_state") ?? "").trim() || null,
      transactions_under_contract:
        Number(formData.get("transactions_under_contract")) || 0,
      transactions_per_month:
        Number(formData.get("transactions_per_month")) || 0,
      tc_count: Number(formData.get("tc_count")) || 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );

  if (error) {
    redirect(`/setup?error=${encodeURIComponent(error.message)}`);
  }

  // Not trimmed: spaces can be part of a password.
  const otcPassword = String(formData.get("otc_password") ?? "");
  if (chosen === "custom" && otcPassword) {
    const { error: passwordError } = await supabase.rpc("save_otc_password", {
      p_password: otcPassword,
    });
    if (passwordError) {
      redirect(`/setup?error=${encodeURIComponent(passwordError.message)}`);
    }
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
