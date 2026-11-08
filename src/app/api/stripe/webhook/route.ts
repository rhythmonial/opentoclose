import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { PLAN_PRICES } from "@/lib/pricing";
import { syncSubscription } from "@/lib/billing";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) {
    return new Response("Webhook not configured", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    if (session.payment_status === "paid") {
      const error = await fulfill(session);
      if (error) {
        console.error(`Stripe fulfillment failed for ${session.id}: ${error}`);
        // Non-2xx makes Stripe retry later.
        return new Response(error, { status: 500 });
      }
    }
  }

  // The monthly access fee: renewals are logged as payments, and every
  // change to a subscription (canceled, renewed, payment failed) is saved.
  if (event.type === "invoice.paid") {
    const error = await logRenewal(event.data.object);
    if (error) return new Response(error, { status: 500 });
  }
  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const sub = event.data.object;
    const error = await syncSubscription(createAdminClient(), sub);
    if (error) return new Response(error, { status: 500 });
    if (event.type === "customer.subscription.deleted") await endAccess(sub);
  }

  return Response.json({ received: true });
}

// A monthly renewal (not the first charge, which checkout records).
async function logRenewal(invoice: Stripe.Invoice): Promise<string | null> {
  if (invoice.billing_reason !== "subscription_cycle") return null;
  const clientId = invoice.parent?.subscription_details?.metadata?.client_id;
  if (!clientId) return null;
  const { error } = await createAdminClient().from("payments").insert({
    client_id: clientId,
    kind: "monthly",
    amount_cents: invoice.amount_paid,
    stripe_session_id: invoice.id,
  });
  if (error && error.code !== "23505") return error.message;
  return null;
}

// When the monthly plan ends, DIY access ends with it (back to Free).
// Setup accounts keep their plan, since the team may be mid-build; staff
// see the canceled subscription on the client's page.
async function endAccess(sub: Stripe.Subscription) {
  const clientId = sub.metadata?.client_id;
  if (!clientId) return;
  await createAdminClient()
    .from("setup_initiation")
    .update({ engagement_type: "free", updated_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("engagement_type", "diy");
}

async function fulfill(session: Stripe.Checkout.Session): Promise<string | null> {
  const kind = session.metadata?.kind;
  const clientId = session.metadata?.client_id;
  if (!clientId || (kind !== "setup" && kind !== "diy" && kind !== "step" && kind !== "hours")) {
    return null;
  }
  // Steps and hour purchases carry their hours; plans have fixed ones.
  const boughtHours =
    kind === "step" || kind === "hours"
      ? Number(session.metadata?.hours ?? 0)
      : PLAN_PRICES[kind].hours;

  const admin = createAdminClient();
  const stepId = session.metadata?.step_id || null;

  // A plan with the monthly fee: save its subscription.
  if (session.mode === "subscription" && session.subscription) {
    const sub =
      typeof session.subscription === "string"
        ? await getStripe().subscriptions.retrieve(session.subscription)
        : session.subscription;
    const syncError = await syncSubscription(admin, sub);
    if (syncError) return syncError;
  }

  const { error: insertError } = await admin.from("payments").insert({
    client_id: clientId,
    kind,
    step_id: kind === "step" ? stepId : null,
    hours: boughtHours,
    amount_cents: session.amount_total ?? 0,
    stripe_session_id: session.id,
  });
  if (insertError) {
    // Already recorded: Stripe delivered this event before.
    if (insertError.code === "23505") return null;
    return insertError.message;
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("client_account_id")
    .eq("id", clientId)
    .single();
  const accountId = profile?.client_account_id;

  const { data: account } = accountId
    ? await admin
        .from("client_accounts")
        .select("hours_purchased, setup_path")
        .eq("id", accountId)
        .single()
    : { data: null };

  const addedHours = boughtHours;
  if (accountId && account && addedHours > 0) {
    await admin
      .from("client_accounts")
      .update({ hours_purchased: Number(account.hours_purchased) + addedHours })
      .eq("id", accountId);
  }

  if (kind === "setup" || kind === "diy") {
    const { data: updated } = await admin
      .from("setup_initiation")
      .update({
        engagement_type: kind === "setup" ? "custom" : "diy",
        upgrade_requested_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("client_id", clientId)
      .select("id");
    if (!updated?.length) {
      console.warn(
        `Paid ${kind} for ${clientId} but no setup initiation form exists; set the plan by hand.`,
      );
    }

    if (accountId) {
      await admin
        .from("leads")
        .update({ status: "won", updated_at: new Date().toISOString() })
        .eq("converted_client_account_id", accountId);
    }

    const { data: paidStep } = await admin
      .from("setup_steps")
      .select("id")
      .eq("path", account?.setup_path ?? "custom")
      .eq("key", "setup_paid")
      .maybeSingle();
    if (paidStep) {
      await admin.from("client_step_status").upsert(
        {
          client_id: clientId,
          step_id: paidStep.id,
          status: "approved",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id,step_id" },
      );
    }
  }

  return null;
}
