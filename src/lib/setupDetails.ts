import "server-only";
import { redirect } from "next/navigation";
import type { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/phone";
import { startPlanCheckout } from "@/app/checkout/actions";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// The setup details on a form, for saving. Only the fields the form
// actually has are included, so Initiate Your Setup's DIY version (just the
// email provider and e-sign platform) doesn't blank out the business
// details given at sign-up.
function detailsFrom(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const row: Record<string, string | boolean | null> = {};
  if (formData.has("first_name")) {
    const owner = {
      first: text("first_name"),
      last: text("last_name"),
      cell: formatPhone(text("cell_phone")),
      email: text("email"),
    };
    Object.assign(row, {
      first_name: owner.first,
      last_name: owner.last,
      cell_phone: owner.cell,
      email: owner.email,
      // The OTC Guru is added as a teammate now; the decision maker stands in.
      guru_same_as_owner: true,
      guru_first_name: owner.first,
      guru_last_name: owner.last,
      guru_cell: owner.cell,
      guru_email: owner.email,
    });
  }
  if (formData.has("business_name")) {
    Object.assign(row, {
      business_name: text("business_name"),
      company_structure: text("company_structure"),
      states_serviced: text("states_serviced"),
      priority_state: text("priority_state") || null,
    });
  }
  if (formData.has("tms")) row.tms = text("tms") || null;
  if (formData.has("email_provider")) row.email_provider = text("email_provider") || null;
  if (formData.has("esign_platform")) {
    const esign = text("esign_platform");
    row.esign_platform = esign || null;
    row.esign_other = esign === "Other" ? text("esign_other") || null : null;
  }
  if (formData.has("otc_username")) row.otc_username = text("otc_username") || null;
  return row;
}

// Sign-up: saves the founders-form basics (business, states, current
// software, decision maker). The plan stays Free until the monthly
// membership is paid (see the Stripe webhook).
export async function saveSignupDetails(supabase: Supabase, userId: string, formData: FormData) {
  return supabase.from("setup_initiation").upsert(
    { client_id: userId, ...detailsFrom(formData), updated_at: new Date().toISOString() } as never,
    { onConflict: "client_id" },
  );
}

// Initiate Your Setup: saves their answers, then
// - DIY (staying on the monthly membership): the lesson is done and they
//   go on to the next one (or to checkout if they never paid at sign-up);
// - Setup: checkout for the setup; the lesson completes once it's paid
//   (see the Stripe webhook), or now if they already have a Setup.
export async function saveInitiationAndContinue(
  supabase: Supabase,
  user: { id: string },
  accountUserId: string,
  formData: FormData,
  errorPath: string,
) {
  const chosen = formData.get("engagement_type") === "custom" ? "custom" : "diy";

  const { error } = await supabase
    .from("setup_initiation")
    .update({ ...detailsFrom(formData), updated_at: new Date().toISOString() } as never)
    .eq("client_id", accountUserId);
  if (error) redirect(`${errorPath}?error=${encodeURIComponent(error.message)}`);

  // Not trimmed: spaces can be part of a password.
  const otcPassword = String(formData.get("otc_password") ?? "");
  if (chosen === "custom" && otcPassword) {
    const { error: passwordError } = await supabase.rpc("save_otc_password", {
      p_password: otcPassword,
    });
    if (passwordError) redirect(`${errorPath}?error=${encodeURIComponent(passwordError.message)}`);
  }

  const { data: current } = await supabase
    .from("setup_initiation")
    .select("engagement_type")
    .eq("client_id", accountUserId)
    .single();
  const currentPlan = current?.engagement_type ?? "free";

  if (chosen === "diy" || currentPlan === "custom") {
    await completeInitiation(supabase, user.id, accountUserId);
  }

  // The plan only changes once Stripe confirms payment.
  const needsCheckout =
    currentPlan === "free" || (currentPlan === "diy" && chosen === "custom");
  if (needsCheckout) {
    const checkout = new FormData();
    checkout.set("plan", chosen === "custom" ? "setup" : "diy");
    checkout.set("return_to", errorPath);
    await startPlanCheckout(checkout);
  }

  redirect("/portal");
}

// Marks Initiate Your Setup done for the account.
async function completeInitiation(supabase: Supabase, userId: string, accountUserId: string) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("client_accounts(setup_path)")
    .eq("id", userId)
    .single();
  const { data: step } = await supabase
    .from("setup_steps")
    .select("id")
    .eq("path", profile?.client_accounts?.setup_path ?? "custom")
    .eq("key", "setup_initiation")
    .maybeSingle();
  if (!step) return;
  await supabase.from("client_step_status").upsert(
    {
      client_id: accountUserId,
      step_id: step.id,
      status: "approved",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,step_id" },
  );
}
