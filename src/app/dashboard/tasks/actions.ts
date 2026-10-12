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

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
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

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}
