import "server-only";
import type Stripe from "stripe";
import type { createAdminClient } from "@/lib/supabase/admin";
import { MONTHLY_FEE_CENTS } from "@/lib/pricing";

type Admin = ReturnType<typeof createAdminClient>;

// A subscription that still gives access (and would be charged again).
export const LIVE_STATUSES = ["active", "trialing", "past_due"];

// The monthly access fee, as a Checkout line item.
export function monthlyLineItem(cents: number = MONTHLY_FEE_CENTS): Stripe.Checkout.SessionCreateParams.LineItem {
  return {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: cents,
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

const FEEDBACK: Record<string, string> = {
  customer_service: "Customer service",
  low_quality: "Quality",
  missing_features: "Missing features",
  other: "Other",
  switched_service: "Switched service",
  too_complex: "Too complicated",
  too_expensive: "Too expensive",
  unused: "Not using it",
};

// Why a subscription was cancelled: the comment (the client's, or staff's
// reason), else the client's picked reason, else a failed payment.
function cancelReason(sub: Stripe.Subscription): string | null {
  const d = sub.cancellation_details;
  if (!d) return null;
  if (d.comment?.trim()) return d.comment.trim().slice(0, 500);
  if (d.feedback) return FEEDBACK[d.feedback] ?? d.feedback;
  if (d.reason === "payment_failed") return "Payment failed";
  return null;
}

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
      cancel_reason: cancelReason(sub),
      canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
  if (error) return error.message;
  const { data: saved } = await admin
    .from("subscriptions")
    .select("client_account_id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (saved?.client_account_id) await syncAccountStatus(admin, saved.client_account_id);
  return null;
}

// A cancelled subscription (ending at the period's end, or already ended)
// moves the client to Completed / Churned; resuming or subscribing again
// brings them back. Goes by the account's latest subscription, so an old
// one's events can't undo a newer one.
async function syncAccountStatus(admin: Admin, accountId: string) {
  const { data: latest } = await admin
    .from("subscriptions")
    .select("status, cancel_at_period_end")
    .eq("client_account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!latest) return;
  const cancelled = !LIVE_STATUSES.includes(latest.status) || latest.cancel_at_period_end;
  if (cancelled) {
    await admin
      .from("client_accounts")
      .update({ status: "churned" })
      .eq("id", accountId)
      .in("status", ["active", "paused"]);
  } else {
    await admin
      .from("client_accounts")
      .update({ status: "active" })
      .eq("id", accountId)
      .eq("status", "churned");
  }
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
