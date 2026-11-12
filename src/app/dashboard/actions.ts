"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function approveSubmission(formData: FormData) {
  const submissionId = String(formData.get("submission_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  const stepId = String(formData.get("step_id") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("submissions")
    .update({
      status: "approved",
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  await supabase
    .from("client_step_status")
    .update({ status: "approved", updated_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("step_id", stepId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clients", "layout");
}

export async function returnSubmission(formData: FormData) {
  const submissionId = String(formData.get("submission_id") ?? "");
  const clientId = String(formData.get("client_id") ?? "");
  const stepId = String(formData.get("step_id") ?? "");
  const feedback = String(formData.get("feedback") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("submissions")
    .update({
      status: "returned",
      specialist_feedback: feedback,
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", submissionId);

  await supabase
    .from("client_step_status")
    .update({ status: "returned", updated_at: new Date().toISOString() })
    .eq("client_id", clientId)
    .eq("step_id", stepId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clients", "layout");
}

export async function markStaffStepComplete(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");
  const stepId = String(formData.get("step_id") ?? "");

  const supabase = await createClient();
  await supabase.from("client_step_status").upsert(
    {
      client_id: clientId,
      step_id: stepId,
      status: "approved",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,step_id" },
  );

  // A set up they requested is done.
  const { data: client } = await supabase
    .from("profiles")
    .select("client_account_id")
    .eq("id", clientId)
    .single();
  if (client?.client_account_id) {
    await supabase
      .from("setup_requests")
      .update({ done_at: new Date().toISOString() })
      .eq("client_account_id", client.client_account_id)
      .eq("step_id", stepId)
      .is("done_at", null);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clients", "layout");
}

export async function markUpgraded(formData: FormData) {
  const clientId = String(formData.get("client_id") ?? "");

  const supabase = await createClient();
  await supabase
    .from("setup_initiation")
    .update({ engagement_type: "custom", upgrade_requested_at: null })
    .eq("client_id", clientId);

  const { data: client } = await supabase
    .from("profiles")
    .select("client_account_id")
    .eq("id", clientId)
    .single();
  if (client?.client_account_id) {
    await supabase
      .from("leads")
      .update({ status: "won", updated_at: new Date().toISOString() })
      .eq("converted_client_account_id", client.client_account_id);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clients", "layout");
}

export async function updateClientStatus(formData: FormData) {
  const accountId = String(formData.get("account_id") ?? "");
  const status = String(formData.get("status") ?? "");

  const supabase = await createClient();
  await supabase
    .from("client_accounts")
    .update({ status: status as never })
    .eq("id", accountId);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/clients", "layout");
}

export async function updateClientOutcome(formData: FormData) {
  const accountId = String(formData.get("account_id") ?? "");
  const outcome = String(formData.get("outcome") ?? "").trim();

  const supabase = await createClient();
  await supabase
    .from("client_accounts")
    .update({ outcome: outcome || null })
    .eq("id", accountId);

  revalidatePath("/dashboard/clients", "layout");
}

// Staff: an account's special pricing (founding member, or past client /
// referral), used at their next checkout. Blank takes it off.
export async function updatePriceOffer(formData: FormData) {
  const accountId = String(formData.get("account_id") ?? "");
  const offer = String(formData.get("price_offer") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(accountId)) return;
  const supabase = await createClient();
  await supabase
    .from("client_accounts")
    .update({ price_offer: offer === "founding" || offer === "first_month" ? offer : null })
    .eq("id", accountId);
  revalidatePath(`/dashboard/clients/${accountId}`);
}

// Staff: where they are with a founding group application. Won takes it off
// the list (they're a client once they sign up); lost files it under the
// archived leads.
export async function setFoundingStatus(
  id: string,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!["new", "contacted", "link_sent", "won", "lost"].includes(status)) return { ok: false, error: "Unknown status." };
  const supabase = await createClient();
  const { data: app, error } = await supabase
    .from("founding_applications")
    .update({ status })
    .eq("id", id)
    .select("first_name, last_name, email, phone, business_name, company_structure, states_serviced, priority_state, tms, answers")
    .maybeSingle();
  if (error || !app) return { ok: false, error: error?.message ?? "Application not found." };
  if (status === "lost") {
    const answers = (app.answers ?? {}) as Record<string, string>;
    await supabase.from("leads").insert({
      name: `${app.first_name} ${app.last_name}`,
      email: app.email,
      phone: app.phone,
      source: "founding",
      status: "lost",
      heard_about: answers.referral ?? null,
      archived_at: new Date().toISOString(),
      details: {
        company_structure: app.company_structure,
        business_name: app.business_name,
        states_serviced: app.states_serviced,
        priority_state: app.priority_state,
        tms: app.tms,
      },
    });
  }
  revalidatePath("/dashboard/clients");
  return { ok: true };
}
