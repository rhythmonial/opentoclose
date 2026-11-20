"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, SUPPORT_INBOX } from "@/lib/email";
import { ACCESS_METHODS, AUDIT_REF_PREFIX, AUDIT_TEXT_NUMBER, auditClosed } from "@/lib/audits";
import { encryptCredential } from "@/lib/auditCredentials";

const text = (form: FormData, key: string, max = 200) =>
  String(form.get(key) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const long = (form: FormData, key: string, max = 4000) =>
  String(form.get(key) ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

// An audit request: saved as "requested", emailed to Josie, then on to the
// Stripe Payment Link with the request's id and email.
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
    !row.phone ||
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

  const link = process.env.STRIPE_AUDIT_LINK;
  if (!link) redirect("/audit/thanks?unpaid=1");
  const url = new URL(link);
  url.searchParams.set("client_reference_id", `${AUDIT_REF_PREFIX}${row.id}`);
  url.searchParams.set("prefilled_email", row.email);
  redirect(url.toString());
}
