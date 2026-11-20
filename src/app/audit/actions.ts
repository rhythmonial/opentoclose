"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendEmail, SUPPORT_INBOX } from "@/lib/email";
import { ACCESS_METHODS, accessLabel, AUDIT_REF_PREFIX, TEAM_SIZES } from "@/lib/audits";

const text = (form: FormData, key: string, max = 200) =>
  String(form.get(key) ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const long = (form: FormData, key: string, max = 4000) =>
  String(form.get(key) ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

// An audit request: saved as "requested", emailed to Josie, then on to the
// Stripe Payment Link with the request's id and email.
export async function submitAuditRequest(form: FormData) {
  const row = {
    id: crypto.randomUUID(),
    name: text(form, "name", 120),
    email: text(form, "email"),
    phone: text(form, "phone", 40) || null,
    team_name: text(form, "team_name"),
    team_size: text(form, "team_size", 40),
    frustrations: long(form, "frustrations"),
    access_method: text(form, "access_method", 40),
    anything_else: long(form, "anything_else") || null,
  };
  if (
    !row.name ||
    !/^\S+@\S+\.\S+$/.test(row.email) ||
    !row.team_name ||
    !TEAM_SIZES.includes(row.team_size) ||
    !row.frustrations ||
    !ACCESS_METHODS.some((a) => a.value === row.access_method)
  ) {
    redirect("/audit?error=Please+fill+in+every+required+field.");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("audit_requests").insert(row);
  if (error) redirect("/audit?error=Something+went+wrong.+Please+try+again.");

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://otcsetup.vercel.app";
  await sendEmail({
    to: process.env.AUDIT_INBOX_EMAIL ?? SUPPORT_INBOX,
    subject: `New OTC Audit request: ${row.team_name}`,
    heading: "New OTC Audit request",
    body: [
      `${row.name} (${row.email}${row.phone ? `, ${row.phone}` : ""})`,
      `${row.team_name} · ${row.team_size}`,
      `Access: ${accessLabel(row.access_method)}`,
      "",
      `What's frustrating them:\n${row.frustrations}`,
      row.anything_else ? `\nAnything else:\n${row.anything_else}` : "",
    ]
      .filter((l) => l !== null)
      .join("\n"),
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
