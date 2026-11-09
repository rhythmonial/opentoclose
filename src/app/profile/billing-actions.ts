"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { siteOrigin } from "@/lib/site-origin";
import { accountSubscription, syncSubscription } from "@/lib/billing";
import { redeemCoupon } from "@/lib/coupons";

const back = (params: string): never => redirect(`/profile?${params}#billing`);

// The signed-in account owner's subscription (only owners manage billing).
async function ownerSubscription() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_account_id")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "client_owner" || !profile.client_account_id) {
    return back(`billing_error=${encodeURIComponent("Only the account owner can change billing.")}`);
  }
  const admin = createAdminClient();
  return { admin, ...(await accountSubscription(admin, profile.client_account_id)) };
}

// Cancels the monthly plan at the end of the month already paid for.
export async function cancelSubscription() {
  const { admin, live } = await ownerSubscription();
  if (!live) return back(`billing_error=${encodeURIComponent("There's no monthly plan to cancel.")}`);
  try {
    const sub = await getStripe().subscriptions.update(live.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
    await syncSubscription(admin, sub);
  } catch (err) {
    return back(`billing_error=${encodeURIComponent(err instanceof Error ? err.message : "Couldn't cancel.")}`);
  }
  revalidatePath("/profile");
  back("billing=canceled");
}

// Undoes a cancellation before it takes effect.
export async function resumeSubscription() {
  const { admin, live } = await ownerSubscription();
  if (!live) return back(`billing_error=${encodeURIComponent("There's no monthly plan to keep.")}`);
  try {
    const sub = await getStripe().subscriptions.update(live.stripe_subscription_id, {
      cancel_at_period_end: false,
    });
    await syncSubscription(admin, sub);
  } catch (err) {
    return back(`billing_error=${encodeURIComponent(err instanceof Error ? err.message : "Couldn't update.")}`);
  }
  revalidatePath("/profile");
  back("billing=resumed");
}

// Stripe's billing portal: payment method, invoices and receipts.
export async function openBillingPortal() {
  const { customerId } = await ownerSubscription();
  if (!customerId) return back(`billing_error=${encodeURIComponent("No billing account yet.")}`);
  let url: string;
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${await siteOrigin()}/profile#billing`,
    });
    url = session.url;
  } catch (err) {
    return back(`billing_error=${encodeURIComponent(err instanceof Error ? err.message : "Couldn't open billing.")}`);
  }
  redirect(url);
}

// Cancels a paid plan given at no charge (no Stripe subscription, e.g. set
// up by our team). Like a paid plan ending: DIY goes back to Free, and the
// account moves to Completed / Churned.
export async function cancelComplimentaryPlan() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_account_id")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "client_owner" || !profile.client_account_id) {
    return back(`billing_error=${encodeURIComponent("Only the account owner can change billing.")}`);
  }
  const admin = createAdminClient();
  const { count } = await admin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("client_account_id", profile.client_account_id);
  if (count) {
    return back(`billing_error=${encodeURIComponent("Your plan is billed monthly; cancel it above.")}`);
  }
  await admin
    .from("setup_initiation")
    .update({ engagement_type: "free", updated_at: new Date().toISOString() })
    .eq("client_id", user.id)
    .eq("engagement_type", "diy");
  await admin
    .from("client_accounts")
    .update({ status: "churned" })
    .eq("id", profile.client_account_id)
    .in("status", ["active", "paused"]);
  revalidatePath("/profile");
  revalidatePath("/dashboard/clients", "layout");
  back("billing=canceled");
}

// Applies a coupon code from the Billing section (a free month of DIY).
export async function redeemCouponCode(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const result = await redeemCoupon(formData.get("code"), user.id);
  if (!result.ok) return back(`billing_error=${encodeURIComponent(result.error)}`);
  revalidatePath("/profile");
  revalidatePath("/portal");
  revalidatePath("/home");
  back("billing=coupon");
}
