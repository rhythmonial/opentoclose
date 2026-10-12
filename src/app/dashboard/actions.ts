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
