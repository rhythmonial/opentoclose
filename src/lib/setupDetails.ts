import "server-only";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/phone";
import { startPlanCheckout } from "@/app/checkout/actions";
import { INVITE_COOKIE, inviteStatus, redeemCoupon } from "@/lib/coupons";

type Supabase = Awaited<ReturnType<typeof createClient>>;

// Saves the setup details (business, states, tools, decision maker, plan
// and OTC login) for an account, then sends them on: an invite link they're
// holding gives DIY free for its days; otherwise straight to checkout for
// their plan, unless they already have it. Used by sign-up and /setup.
// errorPath: where to send them back with an error.
export async function saveSetupDetailsAndContinue(
  supabase: Supabase,
  user: { id: string; email?: string | null },
  accountUserId: string,
  formData: FormData,
  errorPath: string,
) {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const owner = {
    first: text("first_name"),
    last: text("last_name"),
    cell: formatPhone(text("cell_phone")),
    email: text("email"),
  };
  const esignPlatform = text("esign_platform");
  const chosen = formData.get("engagement_type") === "diy" ? "diy" : "custom";

  const { error } = await supabase.from("setup_initiation").upsert(
    {
      client_id: accountUserId,
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
      esign_platform: esignPlatform || null,
      esign_other: esignPlatform === "Other" ? text("esign_other") || null : null,
      tms: text("tms") || null,
      email_provider: text("email_provider") || null,
      ...(chosen === "custom" ? { otc_username: text("otc_username") || null } : {}),
      business_name: String(formData.get("business_name") ?? "").trim(),
      company_structure: String(formData.get("company_structure") ?? ""),
      states_serviced: String(formData.get("states_serviced") ?? "").trim(),
      priority_state: String(formData.get("priority_state") ?? "").trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );

  if (error) {
    redirect(`${errorPath}?error=${encodeURIComponent(error.message)}`);
  }

  // Not trimmed: spaces can be part of a password.
  const otcPassword = String(formData.get("otc_password") ?? "");
  if (chosen === "custom" && otcPassword) {
    const { error: passwordError } = await supabase.rpc("save_otc_password", {
      p_password: otcPassword,
    });
    if (passwordError) {
      redirect(`${errorPath}?error=${encodeURIComponent(passwordError.message)}`);
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
        client_id: accountUserId,
        step_id: step.id,
        status: "approved",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,step_id" },
    );
  }

  // An invite link they're holding (DIY only) gives a free month instead
  // of checkout.
  const jar = await cookies();
  const inviteToken = jar.get(INVITE_COOKIE)?.value;
  if (chosen === "diy" && inviteToken && (await inviteStatus(inviteToken))) {
    const result = await redeemCoupon(inviteToken, user.id);
    jar.delete(INVITE_COOKIE);
    if (!result.ok) {
      redirect(`${errorPath}?error=${encodeURIComponent(result.error)}`);
    }
    redirect("/portal?coupon=1");
  }

  // The plan only changes once Stripe confirms payment (see the webhook),
  // so send them to checkout unless they already have this plan or better.
  const { data: current } = await supabase
    .from("setup_initiation")
    .select("engagement_type")
    .eq("client_id", accountUserId)
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
