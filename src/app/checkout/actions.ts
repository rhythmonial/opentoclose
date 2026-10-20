"use server";

import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { getHourlyRate } from "@/lib/hourlyRate";
import { siteOrigin } from "@/lib/site-origin";
import { PLAN_PRICES, stepPriceCents, type PlanKind } from "@/lib/pricing";

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

export async function startPlanCheckout(formData: FormData) {
  const plan = (String(formData.get("plan") ?? "") === "diy"
    ? "diy"
    : "setup") as PlanKind;
  const returnTo = String(formData.get("return_to") ?? "/home");

  const { user } = await requireClient(returnTo);
  const price = PLAN_PRICES[plan];
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
          unit_amount: price.cents,
          product_data: {
            name: `OTC ${price.label}`,
            description:
              plan === "setup"
                ? `Josie's team builds your Open to Close setup (${price.hours}-hour bundle).`
                : "Self-guided Open to Close setup with video lessons and resources.",
          },
        },
      },
    ],
    metadata: { kind: plan, client_id: user.id },
    success_url: `${origin}/home?paid=${plan}`,
    cancel_url: `${origin}${returnTo}`,
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
  if (!step || hours <= 0 || !["setup", "both"].includes(step.completed_by)) {
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
