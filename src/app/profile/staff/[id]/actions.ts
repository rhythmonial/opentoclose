"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/site-origin";

async function requireDev() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: viewer } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (viewer?.role !== "dev") {
    redirect("/profile");
  }

  return { supabase, actorId: user.id };
}

export async function updateStaffEmail(formData: FormData) {
  const targetId = String(formData.get("id") ?? "");
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!targetId || !email) {
    redirect(`/profile/staff/${targetId}?error=Enter+an+email+address`);
  }

  const { supabase, actorId } = await requireDev();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role, email")
    .eq("id", targetId)
    .in("role", ["dev", "dev_admin"])
    .single();

  if (!target) {
    redirect("/profile");
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(targetId, {
    email,
    email_confirm: true,
  });

  if (error) {
    redirect(`/profile/staff/${targetId}?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from("profiles").update({ email }).eq("id", targetId);

  await supabase.from("staff_activity_log").insert({
    profile_id: targetId,
    actor_id: actorId,
    event_type: "email_changed",
    detail: `Changed email from ${target.email ?? "(none)"} to ${email}`,
  });

  revalidatePath(`/profile/staff/${targetId}`);
  redirect(`/profile/staff/${targetId}?saved=1`);
}

export async function sendStaffPasswordReset(formData: FormData) {
  const targetId = String(formData.get("id") ?? "");

  const { supabase, actorId } = await requireDev();

  const { data: target } = await supabase
    .from("profiles")
    .select("id, role, email")
    .eq("id", targetId)
    .in("role", ["dev", "dev_admin"])
    .single();

  if (!target?.email) {
    redirect("/profile");
  }

  const origin = await siteOrigin();
  await supabase.auth.resetPasswordForEmail(target.email, {
    redirectTo: `${origin}/reset-password`,
  });

  await supabase.from("staff_activity_log").insert({
    profile_id: targetId,
    actor_id: actorId,
    event_type: "password_reset_requested",
  });

  revalidatePath(`/profile/staff/${targetId}`);
  redirect(`/profile/staff/${targetId}?reset=1`);
}
