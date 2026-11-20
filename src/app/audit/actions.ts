"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, SUPPORT_INBOX } from "@/lib/email";
import { ACCESS_METHODS, AUDIT_FEE, AUDIT_REF_PREFIX, AUDIT_TEXT_NUMBER, auditClosed } from "@/lib/audits";
import { getStripe } from "@/lib/stripe";
import { siteOrigin } from "@/lib/site-origin";
import { encryptCredential } from "@/lib/auditCredentials";

const text = (form: FormData, key: string, max = 200) =>
  String(form.get(key) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const long = (form: FormData, key: string, max = 4000) =>
  String(form.get(key) ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

// An audit request: saved as "requested", emailed to Josie, then on to
// Stripe Checkout to pay.
export async function submitAuditRequest(form: FormData) {
  if (auditClosed()) redirect("/audit");
  const access = text(form, "access_method", 40);
  const username = text(form, "otc_username");
  const password = String(form.get("otc_password") ?? "").slice(0, 200);
  const row = {
    id: crypto.randomUUID(),
    name: text(form, "name", 120),
    email: text(form, "email"),
    phone: text(form, "phone", 40),
    team_name: text(form, "team_name"),
    frustrations: long(form, "frustrations"),
    access_method: access,
    otc_username: access === "provide_below" ? username : null,
    otc_password_enc: null as string | null,
  };
  if (
    !row.name ||
    !/^\S+@\S+\.\S+$/.test(row.email) ||
    !/^\d{3}-\d{3}-\d{4}$/.test(row.phone) ||
    !row.team_name ||
    !row.frustrations ||
    !ACCESS_METHODS.some((a) => a.value === access) ||
    (access === "provide_below" && (!username || !password))
  ) {
    redirect("/audit?error=Please+fill+in+every+required+field.");
  }
  if (access === "provide_below") {
    try {
      row.otc_password_enc = encryptCredential(password);
    } catch {
      redirect("/audit?error=Something+went+wrong.+Please+try+again.");
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("audit_requests").insert(row);
  if (error) redirect("/audit?error=Something+went+wrong.+Please+try+again.");

  // The login itself stays out of email (it's on the admin page).
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://otcsetup.vercel.app";
  await sendEmail({
    to: process.env.AUDIT_INBOX_EMAIL ?? SUPPORT_INBOX,
    subject: `New OTC Audit request: ${row.team_name}`,
    heading: "New OTC Audit request",
    body: [
      `${row.name} (${row.email}, ${row.phone})`,
      row.team_name,
      `Login: ${access === "provide_below" ? "provided on the form (see the admin page)" : `they'll text it to ${AUDIT_TEXT_NUMBER}`}`,
      "",
      `About their setup:\n${row.frustrations}`,
    ].join("\n"),
    ctaLabel: "Open the request",
    ctaUrl: `${site}/admin/audits/${row.id}`,
  });

  // Stripe Checkout for the $55 (as the app's other payments are made),
  // tied to the request; back to the thank-you page once paid.
  const origin = await siteOrigin();
  let checkoutUrl: string | null = null;
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: row.email,
      client_reference_id: `${AUDIT_REF_PREFIX}${row.id}`,
      metadata: { kind: "audit", audit_request_id: row.id },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: AUDIT_FEE * 100,
            product_data: {
              name: "OTC Audit",
              description: "A recorded walkthrough and written report of your Open to Close account.",
            },
          },
        },
      ],
      success_url: `${origin}/audit/thanks?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/audit`,
    });
    checkoutUrl = session.url;
  } catch (err) {
    console.error(`Audit checkout failed for ${row.id}:`, err);
  }
  if (!checkoutUrl) {
    redirect(
      `/audit?error=${encodeURIComponent(`We saved your request but couldn't open payment. Please text ${AUDIT_TEXT_NUMBER} and we'll help.`)}`,
    );
  }
  redirect(checkoutUrl);
}
