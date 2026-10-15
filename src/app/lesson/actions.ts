"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { effectiveOwner, type PlanType } from "@/lib/stepOwnership";

export async function toggleLessonComplete(formData: FormData) {
  const stepId = String(formData.get("step_id") ?? "");
  const currentlyApproved = formData.get("currently_approved") === "true";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const nextStatus = currentlyApproved ? "not_started" : "approved";

  await supabase.from("client_step_status").upsert(
    {
      client_id: user.id,
      step_id: stepId,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id,step_id" },
  );

  revalidatePath(`/lesson/${stepId}`);
  revalidatePath("/portal");

  if (nextStatus !== "approved") return;

  const { data: step } = await supabase
    .from("setup_steps")
    .select("path, sort_order")
    .eq("id", stepId)
    .maybeSingle();

  if (!step) return;

  const [{ data: allSteps }, { data: statuses }, { data: initiation }] =
    await Promise.all([
      supabase
        .from("setup_steps")
        .select("id, sort_order, completed_by")
        .eq("path", step.path)
        .order("sort_order"),
      supabase
        .from("client_step_status")
        .select("step_id, status")
        .eq("client_id", user.id),
      supabase
        .from("setup_initiation")
        .select("engagement_type")
        .eq("client_id", user.id)
        .maybeSingle(),
    ]);

  // Free accounts haven't paid for staff to handle anything yet, so they're
  // treated like DIY for the purpose of "is this the client's to do next".
  const plan: PlanType =
    initiation?.engagement_type === "custom" ? "custom" : "diy";
  const approvedStepIds = new Set(
    (statuses ?? [])
      .filter((s) => s.status === "approved")
      .map((s) => s.step_id),
  );

  const next = (allSteps ?? []).find(
    (s) =>
      s.sort_order > step.sort_order &&
      effectiveOwner(s.completed_by, plan) === "client" &&
      !approvedStepIds.has(s.id),
  );

  redirect(next ? `/lesson/${next.id}` : "/portal");
}
