import "server-only";
import type Stripe from "stripe";
import type { createAdminClient } from "@/lib/supabase/admin";
import { MONTHLY_FEE_CENTS } from "@/lib/pricing";

type Admin = ReturnType<typeof createAdminClient>;

// A subscription that still gives access (and would be charged again).
export const LIVE_STATUSES = ["active", "trialing", "past_due"];

// The monthly access fee, as a Checkout line item.
export function monthlyLineItem(): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: MONTHLY_FEE_CENTS,
      recurring: { interval: "month" },
      product_data: {
        name: "OTC Setup monthly access",
        description: "Access to your setup checklist, lessons, resources and team.",
      },
    },
  };
}

const idOf = (v: string | { id: string } | null | undefined) =>
  typeof v === "string" ? v : (v?.id ?? null);

// Saves a Stripe subscription's current state (the webhook calls this on
// every change). Its metadata says whose it is (set at checkout).
export async function syncSubscription(admin: Admin, sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  const periodEnd = item?.current_period_end;
  const { error } = await admin.from("subscriptions").upsert(
    {
      stripe_subscription_id: sub.id,
      stripe_customer_id: idOf(sub.customer) ?? "",
      client_id: sub.metadata?.client_id || null,
      client_account_id: sub.metadata?.client_account_id || null,
      status: sub.status,
      cancel_at_period_end: sub.cancel_at_period_end || Boolean(sub.cancel_at),
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      amount_cents: item?.price?.unit_amount ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  return error?.message ?? null;
}

// The account's subscription that still gives access, if any, and the
// Stripe customer it (or an earlier one) belongs to.
export async function accountSubscription(admin: Admin, accountId: string) {
  const { data } = await admin
    .from("subscriptions")
    .select("*")
    .eq("client_account_id", accountId)
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  return {
    live: rows.find((r) => LIVE_STATUSES.includes(r.status)) ?? null,
    customerId: rows[0]?.stripe_customer_id ?? null,
  };
}
