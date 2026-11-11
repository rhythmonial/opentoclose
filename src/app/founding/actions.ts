"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { COMPANY_STRUCTURES, QUESTIONS } from "./questions";

const text = (form: FormData, key: string, max = 200) =>
  String(form.get(key) ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// A founding group application: saved, and emailed to Josie.
export async function submitFoundingApplication(form: FormData) {
  const first = text(form, "first_name", 100);
  const last = text(form, "last_name", 100);
  const email = text(form, "email");
  const structure = text(form, "company_structure", 80);
  const business = text(form, "business_name");
  if (!first || !last || !/^\S+@\S+\.\S+$/.test(email) || !business || !COMPANY_STRUCTURES.includes(structure)) {
    redirect("/founding?error=Please+fill+in+every+required+field.");
  }
  const answers: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const v = String(form.get(q.key) ?? "").trim().slice(0, q.long ? 2000 : 200);
    if (q.options && v && !q.options.includes(v)) continue;
    if (q.required && !v) redirect("/founding?error=Please+answer+every+required+question.");
    if (v) answers[q.key] = v;
  }

  const row = {
    company_structure: structure,
    business_name: business,
    first_name: first,
    last_name: last,
    email,
    phone: text(form, "cell_phone", 40) || null,
    states_serviced: text(form, "states_serviced", 1000) || null,
    priority_state: text(form, "priority_state", 80) || null,
    tms: text(form, "tms", 120) || null,
    email_provider: text(form, "email_provider", 120) || null,
    esign_platform: text(form, "esign_platform", 120) || null,
    esign_other: text(form, "esign_other", 120) || null,
    answers,
  };
  const supabase = await createClient();
  const { error } = await supabase.from("founding_applications").insert(row);
  if (error) redirect("/founding?error=Something+went+wrong.+Please+try+again.");

  // They're a lead too, with their setup initiation answers.
  await supabase.from("leads").insert({
    name: `${first} ${last}`,
    email,
    phone: row.phone,
    status: "new",
    source: "founding",
    heard_about: answers.referral ?? null,
    details: {
      company_structure: structure,
      business_name: business,
      states_serviced: row.states_serviced,
      priority_state: row.priority_state,
      tms: row.tms,
      email_provider: row.email_provider,
      esign_platform: row.esign_other || row.esign_platform,
    },
  });

  const lines = [
    `${first} ${last} (${email}${row.phone ? `, ${row.phone}` : ""})`,
    `${business} · ${structure}`,
    row.states_serviced ? `States: ${row.states_serviced}` : "",
    ...QUESTIONS.filter((q) => answers[q.key]).map((q) => `${q.label} ${answers[q.key]}`),
  ].filter(Boolean);
  await sendEmail({
    to: process.env.FOUNDING_INBOX_EMAIL ?? "rhythmonial@gmail.com",
    subject: `Founding group application: ${business}`,
    heading: "New founding group application",
    body: lines.join("\n"),
    ctaLabel: "See applications",
    ctaUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://otcsetup.vercel.app"}/dashboard/founding`,
  });
  redirect("/founding?sent=1");
}
