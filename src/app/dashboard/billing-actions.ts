"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { accountSubscription, syncSubscription } from "@/lib/billing";

// Staff cancel a client's monthly plan (at the end of the month they've paid
// for), with an optional reason that's kept with the subscription.
export async function cancelClientSubscription(
  accountId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "dev" && profile?.role !== "dev_admin") {
    return { ok: false, error: "Only staff can do that." };
  }

  const admin = createAdminClient();
  const { live } = await accountSubscription(admin, accountId);
  if (!live) return { ok: false, error: "There's no active subscription to cancel." };
  try {
    const sub = await getStripe().subscriptions.update(live.stripe_subscription_id, {
      cancel_at_period_end: true,
      ...(reason.trim()
        ? { cancellation_details: { comment: reason.trim().slice(0, 500) } }
        : {}),
    });
    const error = await syncSubscription(admin, sub);
    if (error) return { ok: false, error };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't cancel." };
  }
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${accountId}`);
  return { ok: true };
}
