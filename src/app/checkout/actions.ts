"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getHourlyRate } from "@/lib/hourlyRate";
import { siteOrigin } from "@/lib/site-origin";
import {
  HOUR_BUNDLE,
  MAX_HOURLY_PURCHASE,
  MONTHLY_FEE_LABEL,
  PLAN_PRICES,
  stepPriceCents,
  type PlanKind,
} from "@/lib/pricing";
import { accountSubscription, monthlyLineItem } from "@/lib/billing";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireClient(returnTo: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "dev" || profile?.role === "dev_admin") {
    redirect(
      `${returnTo}?error=${encodeURIComponent("Payments are turned off for staff and sandboxes.")}`,
    );
  }

  return { supabase, user };
}

async function openCheckout(
  returnTo: string,
  params: Stripe.Checkout.SessionCreateParams,
) {
  let url: string | null = null;
  try {
    const session = await getStripe().checkout.sessions.create(params);
    url = session.url;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Checkout failed.";
    redirect(`${returnTo}?error=${encodeURIComponent(message)}`);
  }
  if (!url) {
    redirect(`${returnTo}?error=${encodeURIComponent("Checkout failed.")}`);
  }
  redirect(url);
}

// Starts paying for a plan. Every plan includes the monthly access fee, a
// subscription that starts now (so access is paid for however long the
// setup takes): DIY is the monthly fee alone; Setup is the one-time setup
// plus the monthly fee. An account already paying monthly only pays the
// one-time setup.
export async function startPlanCheckout(formData: FormData) {
  const plan = (String(formData.get("plan") ?? "") === "diy"
    ? "diy"
    : "setup") as PlanKind;
  const returnTo = String(formData.get("return_to") ?? "/home");

  const { supabase, user } = await requireClient(returnTo);
  const { data: profile } = await supabase
    .from("profiles")
    .select("client_account_id")
    .eq("id", user.id)
    .single();
  const accountId = profile?.client_account_id ?? null;
  const { live, customerId } = accountId
    ? await accountSubscription(createAdminClient(), accountId)
    : { live: null, customerId: null };

  if (plan === "diy" && live) {
    redirect(
      `${returnTo}?error=${encodeURIComponent("You already have the monthly plan.")}`,
    );
  }

  const price = PLAN_PRICES[plan];
  const origin = await siteOrigin();
  const setupItem: Stripe.Checkout.SessionCreateParams.LineItem = {
    quantity: 1,
    price_data: {
      currency: "usd",
      unit_amount: price.cents,
      product_data: {
        name: `OTC ${price.label}`,
        description: `Josie's team builds your Open to Close setup (${price.hours}-hour bundle).`,
      },
    },
  };
  const metadata = { kind: plan, client_id: user.id };
  const customer = customerId ? { customer: customerId } : { customer_email: user.email };

  await openCheckout(returnTo, {
    ...(live
      ? // Already paying monthly: just the one-time setup.
        { mode: "payment" as const, line_items: [setupItem] }
      : {
          mode: "subscription" as const,
          line_items: plan === "setup" ? [setupItem, monthlyLineItem()] : [monthlyLineItem()],
          subscription_data: {
            metadata: { client_id: user.id, client_account_id: accountId ?? "" },
          },
        }),
    ...customer,
    client_reference_id: user.id,
    metadata,
    ...(live
      ? {}
      : {
          custom_text: {
            submit: {
              message: `Your ${MONTHLY_FEE_LABEL} monthly access renews automatically each month until you cancel it from your profile.`,
            },
          },
        }),
    // Back to their setup checklist, with a "payment received" message.
    success_url: `${origin}/portal?paid=${plan}`,
    cancel_url: `${origin}${returnTo}`,
  });
}

// Buys more setup hours: the 10-hour bundle, or some number of hours at the
// hourly rate. They're added to the account's hours when paid.
export async function startHoursCheckout(formData: FormData) {
  // Back to the profile, or the lesson they bought hours from.
  const asked = String(formData.get("return_to") ?? "");
  const returnTo =
    /^\/lesson\/[0-9a-f-]{36}$/i.test(asked) || asked === "/portal" ? asked : "/profile";
  const anchor = returnTo === "/profile" ? "#hours" : "";
  const option = String(formData.get("option") ?? "") === "bundle" ? "bundle" : "hourly";
  const { supabase, user } = await requireClient(returnTo);

  const hours =
    option === "bundle" ? HOUR_BUNDLE.hours : Math.trunc(Number(formData.get("hours")));
  if (!Number.isFinite(hours) || hours < 1 || hours > MAX_HOURLY_PURCHASE) {
    redirect(
      `${returnTo}?hours_error=${encodeURIComponent(`Choose between 1 and ${MAX_HOURLY_PURCHASE} hours.`)}${anchor}`,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("client_account_id")
    .eq("id", user.id)
    .single();
  const { customerId } = profile?.client_account_id
    ? await accountSubscription(createAdminClient(), profile.client_account_id)
    : { customerId: null };
  const rate = await getHourlyRate();
  const origin = await siteOrigin();

  await openCheckout(returnTo, {
    mode: "payment",
    ...(customerId ? { customer: customerId } : { customer_email: user.email }),
    client_reference_id: user.id,
    line_items: [
      option === "bundle"
        ? {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: HOUR_BUNDLE.cents,
              product_data: {
                name: `${HOUR_BUNDLE.hours}-hour setup bundle`,
                description: "Setup hours with Josie's team.",
              },
            },
          }
        : {
            quantity: hours,
            price_data: {
              currency: "usd",
              unit_amount: Math.round(rate * 100),
              product_data: {
                name: "Setup hours",
                description: `Setup hours with Josie's team at $${rate}/hr.`,
              },
            },
          },
    ],
    metadata: { kind: "hours", client_id: user.id, hours: String(hours) },
    success_url: `${origin}${returnTo}?hours=purchased${anchor}`,
    cancel_url: `${origin}${returnTo}${anchor}`,
  });
}

export async function startStepCheckout(formData: FormData) {
  const stepId = String(formData.get("step_id") ?? "");
  const returnTo = `/lesson/${stepId}`;

  const { supabase, user } = await requireClient(returnTo);

  const { data: step } = await supabase
    .from("setup_steps")
    .select("id, title, estimated_hours, completed_by")
    .eq("id", stepId)
    .single();

  const hours = Number(step?.estimated_hours ?? 0);
  if (!step || hours <= 0 || step.completed_by === "staff") {
    redirect(
      `${returnTo}?error=${encodeURIComponent("This step isn't available to purchase.")}`,
    );
  }

  const rate = await getHourlyRate();
  const origin = await siteOrigin();

  await openCheckout(returnTo, {
    mode: "payment",
    customer_email: user.email,
    client_reference_id: user.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: stepPriceCents(hours, rate),
          product_data: {
            name: `Done-for-you: ${step.title}`,
            description: `${hours} hour${hours === 1 ? "" : "s"} at $${rate}/hr`,
          },
        },
      },
    ],
    metadata: {
      kind: "step",
      client_id: user.id,
      step_id: step.id,
      hours: String(hours),
    },
    success_url: `${origin}${returnTo}?paid=1`,
    cancel_url: `${origin}${returnTo}`,
  });
}
