"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { INVITE_COOKIE } from "@/lib/coupons";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhone } from "@/lib/phone";
import { saveSignupDetails } from "@/lib/setupDetails";
import { startPlanCheckout } from "@/app/checkout/actions";

// Creates the account from the sign-up form (the founders-form basics plus
// a password), then sends them to checkout for the monthly membership.
// (Whether they add a Setup is decided later, in Initiate Your Setup.)
export async function signUp(formData: FormData) {
  // Not open yet (see the sign-up page): invite links only.
  if (!(await cookies()).get(INVITE_COOKIE)) redirect("/");
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const email = text("email").toLowerCase();
  // Not trimmed: spaces can be part of a password.
  const password = String(formData.get("password") ?? "");
  const businessName = text("business_name");
  const firstName = text("first_name");
  const lastName = text("last_name");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { business_name: businessName } },
  });
  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  const user = data.user;
  if (!user || !data.session) {
    redirect(`/login?error=${encodeURIComponent("Check your email to confirm your account, then sign in.")}`);
  }

  await supabase
    .from("profiles")
    .update({
      name: [firstName, lastName].filter(Boolean).join(" ") || null,
      phone: formatPhone(text("cell_phone")) || null,
    })
    .eq("id", user.id);

  await applyFoundingApplication(user.id, email);

  const { error: detailsError } = await saveSignupDetails(supabase, user.id, formData);
  if (detailsError) console.error("Couldn't save sign-up details", detailsError.message);
  // The invite link has done its job (getting them in).
  (await cookies()).delete(INVITE_COOKIE);

  const checkout = new FormData();
  checkout.set("plan", "diy");
  // If they leave checkout, their portal asks them to choose a plan.
  checkout.set("return_to", "/portal");
  await startPlanCheckout(checkout);
}

// A founding group applicant gets founding pricing, and their application
// is marked won (as a won lead linked to their new account).
async function applyFoundingApplication(userId: string, email: string) {
  const admin = createAdminClient();
  const { data: app } = await admin
    .from("founding_applications")
    .select("id, status, first_name, last_name, phone, business_name, company_structure, states_serviced, priority_state, tms, answers")
    .ilike("email", email)
    .neq("status", "lost")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!app) return;
  const { data: profile } = await admin
    .from("profiles")
    .select("client_account_id")
    .eq("id", userId)
    .single();
  const accountId = profile?.client_account_id;
  if (!accountId) return;

  await admin.from("client_accounts").update({ price_offer: "founding" }).eq("id", accountId);
  if (app.status === "won") {
    // Already a won lead: the sign-up linked it by email.
    return;
  }
  await admin.from("founding_applications").update({ status: "won" }).eq("id", app.id);
  const answers = (app.answers ?? {}) as Record<string, string>;
  await admin.from("leads").insert({
    name: `${app.first_name} ${app.last_name}`,
    email,
    phone: app.phone,
    source: "founding",
    status: "won",
    heard_about: answers.referral ?? null,
    converted_client_account_id: accountId,
    details: {
      company_structure: app.company_structure,
      business_name: app.business_name,
      states_serviced: app.states_serviced,
      priority_state: app.priority_state,
      tms: app.tms,
    },
  });
}
