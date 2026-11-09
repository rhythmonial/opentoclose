"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { effectiveOwner, isDelegable, type PlanType } from "@/lib/stepOwnership";
import { getSandboxTier } from "@/lib/devSandbox";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, client_account_id")
    .eq("id", user.id)
    .single();
  const isStaff =
    profile?.role === "dev" || profile?.role === "dev_admin";
  const sandboxTier = isStaff ? await getSandboxTier() : null;

  const nextStatus = currentlyApproved ? "not_started" : "approved";

  if (sandboxTier) {
    await supabase.from("dev_sandbox_step_status").upsert(
      {
        tier: sandboxTier,
        step_id: stepId,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tier,step_id" },
    );
  } else {
    await supabase.from("client_step_status").upsert(
      {
        client_id: user.id,
        step_id: stepId,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_id,step_id" },
    );
  }

  // Done themselves: any set up they'd requested for it is no longer needed.
  if (!sandboxTier && nextStatus === "approved" && profile?.client_account_id) {
    await supabase
      .from("setup_requests")
      .update({ done_at: new Date().toISOString() })
      .eq("client_account_id", profile.client_account_id)
      .eq("step_id", stepId)
      .is("done_at", null);
    revalidatePath("/dashboard/clients", "layout");
  }

  revalidatePath(`/lesson/${stepId}`);
  revalidatePath("/portal");
  revalidatePath("/home");

  if (nextStatus !== "approved") return;

  const { data: step } = await supabase
    .from("setup_steps")
    .select("path, sort_order")
    .eq("id", stepId)
    .maybeSingle();

  if (!step) return;

  const [{ data: allSteps }, { data: statuses }, { data: initiation }, { data: requests }] =
    await Promise.all([
      supabase
        .from("setup_steps")
        .select("id, sort_order, completed_by")
        .eq("path", step.path)
        .order("sort_order"),
      sandboxTier
        ? supabase
            .from("dev_sandbox_step_status")
            .select("step_id, status")
            .eq("tier", sandboxTier)
        : supabase
            .from("client_step_status")
            .select("step_id, status")
            .eq("client_id", user.id),
      sandboxTier
        ? Promise.resolve({ data: { engagement_type: sandboxTier } })
        : supabase
            .from("setup_initiation")
            .select("engagement_type")
            .eq("client_id", user.id)
            .maybeSingle(),
      !sandboxTier && profile?.client_account_id
        ? supabase
            .from("setup_requests")
            .select("step_id")
            .eq("client_account_id", profile.client_account_id)
            .is("done_at", null)
        : Promise.resolve({ data: [] as { step_id: string }[] }),
    ]);
  const requested = new Set((requests ?? []).map((r) => r.step_id));

  // Free accounts follow the DIY checklist.
  const plan: PlanType =
    initiation?.engagement_type === "custom" ? "custom" : "diy";
  const approvedStepIds = new Set(
    (statuses ?? [])
      .filter((s) => s.status === "approved")
      .map((s) => s.step_id),
  );

  // Next: their own lessons, and lessons our team handles that they can do
  // or request (unless already requested). (These never block them.)
  const next = (allSteps ?? []).find(
    (s) =>
      s.sort_order > step.sort_order &&
      (effectiveOwner(s.completed_by, plan) === "client" ||
        (isDelegable(s.completed_by, initiation?.engagement_type) && !requested.has(s.id))) &&
      !approvedStepIds.has(s.id),
  );

  redirect(next ? `/lesson/${next.id}` : "/home");
}
